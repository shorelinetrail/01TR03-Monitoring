import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import http from 'http';
import { execSync } from 'child_process';

/**
 * Camera Snapshot Proxy API
 *
 * This endpoint proxies camera snapshot requests to handle CORS and authentication.
 * Supports Basic Auth and Digest Auth for Hikvision/Annke cameras.
 */

// Helper to make HTTP request with digest auth support
function fetchWithDigestAuth(
  targetUrl: string,
  username: string,
  password: string,
  timeout = 10000
): Promise<{ data: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(targetUrl);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      timeout,
    };

    // First request to get digest challenge
    const req1 = http.request(options, (res1) => {
      if (res1.statusCode === 401) {
        const wwwAuth = res1.headers['www-authenticate'];
        if (wwwAuth && wwwAuth.toLowerCase().startsWith('digest')) {
          // Parse digest challenge and retry
          const challenge = parseDigestChallenge(wwwAuth);
          const uri = urlObj.pathname + urlObj.search;
          const digestHeader = generateDigestAuth(username, password, 'GET', uri, challenge);

          const options2 = {
            ...options,
            headers: { 'Authorization': digestHeader },
          };

          const req2 = http.request(options2, (res2) => {
            if (res2.statusCode !== 200) {
              reject(new Error(`HTTP ${res2.statusCode} after digest auth`));
              return;
            }
            const chunks: Buffer[] = [];
            res2.on('data', (chunk) => chunks.push(chunk));
            res2.on('end', () => {
              resolve({
                data: Buffer.concat(chunks),
                contentType: res2.headers['content-type'] || 'image/jpeg',
              });
            });
          });
          req2.on('error', reject);
          req2.on('timeout', () => reject(new Error('Request timeout')));
          req2.end();
        } else {
          reject(new Error('Camera requires unsupported auth type'));
        }
      } else if (res1.statusCode === 200) {
        // No auth needed
        const chunks: Buffer[] = [];
        res1.on('data', (chunk) => chunks.push(chunk));
        res1.on('end', () => {
          resolve({
            data: Buffer.concat(chunks),
            contentType: res1.headers['content-type'] || 'image/jpeg',
          });
        });
      } else {
        reject(new Error(`HTTP ${res1.statusCode}`));
      }
    });

    req1.on('error', reject);
    req1.on('timeout', () => reject(new Error('Request timeout')));
    req1.end();
  });
}

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

// Helper to sleep for retry backoff
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch snapshot with curl and retry logic for 503 Device Busy
async function fetchCameraSnapshot(
  host: string,
  username: string,
  password: string,
  maxRetries = 3
): Promise<{ success: true; data: Buffer } | { success: false; error: string; status: number }> {
  // Use channel 102 (substream) which is less resource-intensive than main stream
  // Format: 1=main ch1, 101=main ch1 alt, 102=sub ch1
  const camUrl = `http://${host}/ISAPI/Streaming/channels/102/picture`;
  const delimiter = '---HTTP_CODE---';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Fetching camera (attempt ${attempt}/${maxRetries}):`, camUrl);

    try {
      const resultWithCode = execSync(
        `curl -s --digest -u "${username}:${password}" --max-time 10 -w "${delimiter}%{http_code}" "${camUrl}"`,
        { maxBuffer: 10 * 1024 * 1024 }
      );

      // Extract HTTP status code from delimiter
      const delimiterIndex = resultWithCode.lastIndexOf(delimiter);
      let httpCode = '';
      let result: Buffer;
      if (delimiterIndex >= 0) {
        httpCode = resultWithCode.subarray(delimiterIndex + delimiter.length).toString('utf-8').trim();
        result = resultWithCode.subarray(0, delimiterIndex);
      } else {
        result = resultWithCode;
      }
      console.log('HTTP response code:', httpCode || 'unknown');

      // Check for retryable errors (503 Device Busy)
      if (httpCode === '503') {
        console.log(`Camera busy (503), ${attempt < maxRetries ? 'retrying...' : 'giving up'}`);
        if (attempt < maxRetries) {
          await sleep(500 * attempt); // 500ms, 1000ms backoff
          continue;
        }
        return { success: false, error: 'Camera busy - try reducing refresh rate or close other streams', status: 503 };
      }

      // Check for HTTP errors
      if (httpCode === '401') {
        return { success: false, error: 'Camera authentication failed - check username/password', status: 401 };
      }
      if (httpCode === '403') {
        return { success: false, error: 'Camera access forbidden - check user permissions', status: 403 };
      }

      // Check for valid JPEG
      if (result.length > 1000 && result[0] === 0xFF && result[1] === 0xD8) {
        console.log('Got valid JPEG:', result.length, 'bytes');
        return { success: true, data: result };
      }

      // Got response but not a JPEG
      const text = result.toString('utf-8');
      console.log('Non-JPEG response:', result.length, 'bytes');
      console.log('Content:', text.substring(0, 300));

      // Parse Hikvision XML error
      if (text.includes('<statusString>')) {
        const match = text.match(/<statusString>([^<]+)<\/statusString>/);
        if (match) {
          // Device Busy should retry
          if (match[1].toLowerCase().includes('busy')) {
            if (attempt < maxRetries) {
              await sleep(500 * attempt);
              continue;
            }
          }
          return { success: false, error: `Camera: ${match[1]}`, status: 500 };
        }
      }

      return { success: false, error: 'Camera returned invalid response', status: 500 };

    } catch (err: unknown) {
      const exitStatus = (err as { status?: number })?.status;

      if (exitStatus === 28) {
        return { success: false, error: 'Camera timeout - check if online and reachable', status: 504 };
      }
      if (exitStatus === 7) {
        return { success: false, error: 'Could not connect - check IP and port', status: 503 };
      }
      if (exitStatus === 6) {
        return { success: false, error: 'Could not resolve hostname', status: 503 };
      }

      console.error('Curl error:', err);
      return { success: false, error: 'Camera connection failed', status: 500 };
    }
  }

  return { success: false, error: 'Camera unavailable after retries', status: 503 };
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
    let useBasicAuth = false;

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
        case 'supabase':
          // Fetch from Supabase Storage (for remote/cloud deployment)
          {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const bucketName = process.env.CAMERA_BUCKET_NAME || 'camera-snapshots';
            if (!supabaseUrl) {
              return NextResponse.json(
                { error: 'Supabase URL not configured' },
                { status: 500 }
              );
            }
            // host contains the camera ID for supabase type (e.g., "cam1")
            const storageUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${host}/latest.jpg?t=${Date.now()}`;
            console.log('Fetching from Supabase Storage:', storageUrl);

            try {
              const response = await fetch(storageUrl);
              if (!response.ok) {
                return NextResponse.json(
                  { error: `Storage fetch failed: ${response.status}` },
                  { status: response.status }
                );
              }
              const imageBuffer = await response.arrayBuffer();
              return new NextResponse(imageBuffer, {
                headers: {
                  'Content-Type': 'image/jpeg',
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'Access-Control-Allow-Origin': '*',
                },
              });
            } catch (err) {
              console.error('Supabase Storage error:', err);
              return NextResponse.json(
                { error: 'Failed to fetch from storage' },
                { status: 500 }
              );
            }
          }
        case 'hikvision':
        case 'annke':
          // Hikvision/Annke - use curl with digest auth and retry for busy camera
          {
            const result = await fetchCameraSnapshot(host, username, password);
            if (result.success) {
              // Convert Buffer to Uint8Array for NextResponse compatibility
              return new NextResponse(new Uint8Array(result.data), {
                headers: {
                  'Content-Type': 'image/jpeg',
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'Access-Control-Allow-Origin': '*',
                },
              });
            } else {
              return NextResponse.json(
                { error: result.error },
                { status: result.status }
              );
            }
          }
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

    // Add Basic Auth if configured
    if (useBasicAuth && username && password) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    }

    // First request - with basic auth if set, or no auth to get digest challenge
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
