import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Camera Snapshot Proxy API
 *
 * This endpoint proxies camera snapshot requests to handle CORS and authentication.
 * Supports Basic Auth and Digest Auth for Hikvision/Annke cameras.
 */

// Parse WWW-Authenticate header for Digest auth
function parseDigestChallenge(header: string): Record<string, string> {
  const params: Record<string, string> = {};
  const regex = /(\w+)=(?:"([^"]+)"|([^\s,]+))/g;
  let match;
  while ((match = regex.exec(header)) !== null) {
    params[match[1]] = match[2] || match[3];
  }
  return params;
}

// Generate Digest Auth response
function generateDigestAuth(
  username: string,
  password: string,
  method: string,
  uri: string,
  challenge: Record<string, string>
): string {
  const { realm, nonce, qop, opaque } = challenge;
  const nc = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');

  // HA1 = MD5(username:realm:password)
  const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');

  // HA2 = MD5(method:uri)
  const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');

  // Response = MD5(HA1:nonce:nc:cnonce:qop:HA2) if qop is present
  let response: string;
  if (qop) {
    response = crypto.createHash('md5')
      .update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
      .digest('hex');
  } else {
    response = crypto.createHash('md5')
      .update(`${ha1}:${nonce}:${ha2}`)
      .digest('hex');
  }

  let authHeader = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", algorithm=MD5, response="${response}"`;
  if (qop) {
    authHeader += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  }
  if (opaque) {
    authHeader += `, opaque="${opaque}"`;
  }

  return authHeader;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const cameraId = searchParams.get('camera');

  if (!url && !cameraId) {
    return NextResponse.json(
      { error: 'Missing url or camera parameter' },
      { status: 400 }
    );
  }

  try {
    let targetUrl = url;

    // Store credentials for potential digest auth retry
    let username = '';
    let password = '';
    let useDigestAuth = false;

    // If cameraId provided, construct URL from environment variables
    if (cameraId && !url) {
      const host = process.env[`CAM${cameraId}_HOST`];
      username = process.env[`CAM${cameraId}_USERNAME`] || 'admin';
      password = process.env[`CAM${cameraId}_PASSWORD`] || '';
      const type = process.env[`CAM${cameraId}_TYPE`] || 'hikvision';

      if (!host) {
        return NextResponse.json(
          { error: `Camera ${cameraId} not configured` },
          { status: 404 }
        );
      }

      // Build URL based on camera type
      switch (type.toLowerCase()) {
        case 'hikvision':
        case 'annke':
          // Hikvision/Annke - use path that works in BlueIris (no ISAPI prefix)
          targetUrl = `http://${host}/Streaming/channels/101/httpPreview`;
          useDigestAuth = true;
          break;
        case 'reolink':
          // Reolink uses query params for auth
          targetUrl = `http://${host}/cgi-bin/api.cgi?cmd=Snap&channel=0&rs=${Date.now()}&user=${username}&password=${password}`;
          break;
        case 'dahua':
          targetUrl = `http://${host}/cgi-bin/snapshot.cgi`;
          useDigestAuth = true;
          break;
        case 'onvif':
          targetUrl = `http://${host}/onvif-http/snapshot`;
          break;
        default:
          // Generic - try direct URL
          targetUrl = `http://${host}/snapshot.jpg`;
      }
    }

    if (!targetUrl) {
      return NextResponse.json(
        { error: 'Could not construct camera URL' },
        { status: 400 }
      );
    }

    // Build headers
    const headers: Record<string, string> = {
      'Accept': 'image/jpeg,image/png,image/*',
    };

    // First request - no auth to get digest challenge (or with basic auth for cameras that support it)
    let response = await fetch(targetUrl, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    // If 401 and WWW-Authenticate header present, try Digest Auth
    if (response.status === 401 && useDigestAuth) {
      const wwwAuth = response.headers.get('WWW-Authenticate');

      if (wwwAuth && wwwAuth.toLowerCase().startsWith('digest')) {
        console.log('Camera requires Digest Auth, retrying...');
        console.log('WWW-Authenticate:', wwwAuth);
        const challenge = parseDigestChallenge(wwwAuth);
        console.log('Parsed challenge:', JSON.stringify(challenge));
        const urlObj = new URL(targetUrl);
        const uri = urlObj.pathname + urlObj.search;
        console.log('URI for digest:', uri);

        const digestHeader = generateDigestAuth(username, password, 'GET', uri, challenge);
        console.log('Generated Digest header:', digestHeader);
        console.log('Using username:', username, 'password length:', password.length, 'first char:', password[0]);
        headers['Authorization'] = digestHeader;

        response = await fetch(targetUrl, {
          headers,
          redirect: 'follow',
          signal: AbortSignal.timeout(10000),
        });
      } else if (wwwAuth && wwwAuth.toLowerCase().startsWith('basic')) {
        // Try Basic Auth
        console.log('Camera requires Basic Auth, retrying...');
        headers['Authorization'] = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

        response = await fetch(targetUrl, {
          headers,
          redirect: 'follow',
          signal: AbortSignal.timeout(10000),
        });
      }
    }

    if (!response.ok) {
      console.error(`Camera fetch failed: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Camera returned ${response.status}` },
        { status: response.status }
      );
    }

    // Get content type to check if it's MJPEG stream
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    console.log('Response content-type:', contentType);

    // Handle MJPEG stream (multipart/x-mixed-replace)
    if (contentType.includes('multipart')) {
      console.log('Detected MJPEG stream, extracting first frame...');
      const reader = response.body?.getReader();
      if (!reader) {
        return NextResponse.json({ error: 'No response body' }, { status: 500 });
      }

      // Read chunks until we get a complete JPEG frame
      const chunks: Uint8Array[] = [];
      let totalSize = 0;
      const maxSize = 5 * 1024 * 1024; // 5MB max

      while (totalSize < maxSize) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalSize += value.length;

        // Check if we have a complete JPEG (look for FFD8 start and FFD9 end)
        const combined = new Uint8Array(totalSize);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }

        // Find JPEG markers
        let jpegStart = -1;
        let jpegEnd = -1;
        for (let i = 0; i < combined.length - 1; i++) {
          if (combined[i] === 0xFF && combined[i + 1] === 0xD8) {
            jpegStart = i;
          }
          if (jpegStart >= 0 && combined[i] === 0xFF && combined[i + 1] === 0xD9) {
            jpegEnd = i + 2;
            break;
          }
        }

        if (jpegStart >= 0 && jpegEnd > jpegStart) {
          reader.cancel();
          const jpegData = combined.slice(jpegStart, jpegEnd);
          console.log('Extracted JPEG frame:', jpegData.length, 'bytes');
          return new NextResponse(jpegData, {
            headers: {
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
      }

      reader.cancel();
      return NextResponse.json({ error: 'Could not extract JPEG from stream' }, { status: 500 });
    }

    // Regular image response
    const imageBuffer = await response.arrayBuffer();

    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Camera snapshot error:', error);

    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Camera connection timeout' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch camera snapshot' },
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
