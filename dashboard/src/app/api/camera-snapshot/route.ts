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

    // If cameraId provided, construct URL from environment variables
    if (cameraId && !url) {
      const host = process.env[`REOLINK_CAM${cameraId}_HOST`];
      const username = process.env[`REOLINK_CAM${cameraId}_USERNAME`] || 'admin';
      const password = process.env[`REOLINK_CAM${cameraId}_PASSWORD`];

      if (!host || !password) {
        return NextResponse.json(
          { error: `Camera ${cameraId} not configured` },
          { status: 404 }
        );
      }

      // Reolink snapshot URL format
      // For direct HTTP access: http://{host}/cgi-bin/api.cgi?cmd=Snap&channel=0&rs=randomstring&user={user}&password={pass}
      targetUrl = `http://${host}/cgi-bin/api.cgi?cmd=Snap&channel=0&rs=${Date.now()}&user=${username}&password=${password}`;
    }

    if (!targetUrl) {
      return NextResponse.json(
        { error: 'Could not construct camera URL' },
        { status: 400 }
      );
    }

    // Fetch the image from the camera
    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'image/jpeg,image/png,image/*',
      },
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
