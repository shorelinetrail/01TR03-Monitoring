import { NextRequest, NextResponse } from 'next/server';

/**
 * Camera Snapshot Proxy API
 *
 * This endpoint proxies camera snapshot requests to handle CORS and authentication.
 * For Reolink cameras, it supports both direct HTTP access and Reolink Cloud.
 */

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

    // Build auth header for cameras that need it
    let authHeader: string | null = null;

    // If cameraId provided, construct URL from environment variables
    if (cameraId && !url) {
      const host = process.env[`CAM${cameraId}_HOST`];
      const username = process.env[`CAM${cameraId}_USERNAME`] || 'admin';
      const password = process.env[`CAM${cameraId}_PASSWORD`] || '';
      const type = process.env[`CAM${cameraId}_TYPE`] || 'hikvision';

      if (!host) {
        return NextResponse.json(
          { error: `Camera ${cameraId} not configured` },
          { status: 404 }
        );
      }

      // Create Basic Auth header
      authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

      // Build URL based on camera type
      switch (type.toLowerCase()) {
        case 'hikvision':
        case 'annke':
          // Hikvision/Annke snapshot - matches BlueIris path /Streaming/Channels/101
          targetUrl = `http://${host}/Streaming/Channels/101/picture`;
          // Basic Auth header is used (set above)
          break;
        case 'reolink':
          // Reolink uses query params for auth
          targetUrl = `http://${host}/cgi-bin/api.cgi?cmd=Snap&channel=0&rs=${Date.now()}&user=${username}&password=${password}`;
          authHeader = null; // Reolink uses URL params
          break;
        case 'dahua':
          targetUrl = `http://${host}/cgi-bin/snapshot.cgi`;
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
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // Fetch the image from the camera
    const response = await fetch(targetUrl, {
      headers,
      // Don't follow redirects automatically
      redirect: 'follow',
      // Set a reasonable timeout
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`Camera fetch failed: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Camera returned ${response.status}` },
        { status: response.status }
      );
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

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
