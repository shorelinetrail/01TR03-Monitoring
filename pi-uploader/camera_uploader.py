#!/usr/bin/env python3
"""
Camera Snapshot Uploader for Raspberry Pi
Captures snapshots from local cameras and uploads to Supabase Storage
"""

import os
import time
import logging
from datetime import datetime
from typing import Optional
import requests
from requests.auth import HTTPDigestAuth
from supabase import create_client, Client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration from environment variables
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')  # Use service key for storage uploads
UPLOAD_INTERVAL = int(os.environ.get('UPLOAD_INTERVAL', '5'))  # seconds
BUCKET_NAME = os.environ.get('BUCKET_NAME', 'camera-snapshots')

# Camera configurations
CAMERAS = [
    {
        'id': 'cam1',
        'name': 'Oil & Winding Temperatures',
        'type': os.environ.get('CAM1_TYPE', 'reolink'),
        'host': os.environ.get('CAM1_HOST', '192.168.0.100'),
        'username': os.environ.get('CAM1_USERNAME', 'admin'),
        'password': os.environ.get('CAM1_PASSWORD', ''),
    },
    {
        'id': 'cam2',
        'name': 'Oil Level',
        'type': os.environ.get('CAM2_TYPE', 'reolink'),
        'host': os.environ.get('CAM2_HOST', '192.168.0.101'),
        'username': os.environ.get('CAM2_USERNAME', 'admin'),
        'password': os.environ.get('CAM2_PASSWORD', ''),
    },
]


def get_camera_url(camera: dict) -> str:
    """Build the snapshot URL based on camera type"""
    host = camera['host']
    cam_type = camera['type'].lower()
    username = camera['username']
    password = camera['password']

    if cam_type in ('hikvision', 'annke'):
        # Hikvision/Annke ISAPI - use substream (102) for less load
        return f"http://{host}/ISAPI/Streaming/channels/102/picture"
    elif cam_type == 'reolink':
        # Reolink with credentials in URL
        return f"http://{host}/cgi-bin/api.cgi?cmd=Snap&channel=0&rs={int(time.time())}&user={username}&password={password}"
    elif cam_type == 'dahua':
        return f"http://{host}/cgi-bin/snapshot.cgi"
    else:
        # Generic
        return f"http://{host}/snapshot.jpg"


def fetch_snapshot(camera: dict) -> Optional[bytes]:
    """Fetch a snapshot from the camera"""
    try:
        url = get_camera_url(camera)
        cam_type = camera['type'].lower()

        # Set up authentication
        auth = None
        if cam_type in ('hikvision', 'annke', 'dahua'):
            auth = HTTPDigestAuth(camera['username'], camera['password'])

        logger.debug(f"Fetching from {camera['id']}: {url}")

        response = requests.get(
            url,
            auth=auth,
            timeout=10,
            stream=True
        )

        if response.status_code == 200:
            content = response.content
            # Validate it's a JPEG (starts with FFD8)
            if len(content) > 1000 and content[0:2] == b'\xff\xd8':
                logger.info(f"Got snapshot from {camera['id']}: {len(content)} bytes")
                return content
            else:
                logger.warning(f"Invalid image from {camera['id']}: {len(content)} bytes")
                return None
        else:
            logger.error(f"HTTP {response.status_code} from {camera['id']}")
            return None

    except requests.exceptions.Timeout:
        logger.error(f"Timeout fetching from {camera['id']}")
        return None
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching from {camera['id']}: {e}")
        return None


def upload_to_supabase(supabase: Client, camera_id: str, image_data: bytes) -> bool:
    """Upload snapshot to Supabase Storage"""
    try:
        file_path = f"{camera_id}/latest.jpg"

        # Upload with upsert to overwrite existing
        result = supabase.storage.from_(BUCKET_NAME).upload(
            path=file_path,
            file=image_data,
            file_options={
                "content-type": "image/jpeg",
                "upsert": "true"
            }
        )

        logger.info(f"Uploaded {camera_id}/latest.jpg to Supabase Storage")
        return True

    except Exception as e:
        # Handle "already exists" by trying update
        if "already exists" in str(e).lower() or "Duplicate" in str(e):
            try:
                supabase.storage.from_(BUCKET_NAME).update(
                    path=file_path,
                    file=image_data,
                    file_options={"content-type": "image/jpeg"}
                )
                logger.info(f"Updated {camera_id}/latest.jpg in Supabase Storage")
                return True
            except Exception as e2:
                logger.error(f"Error updating {camera_id}: {e2}")
                return False
        else:
            logger.error(f"Error uploading {camera_id}: {e}")
            return False


def main():
    """Main loop"""
    # Validate configuration
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables")
        return

    # Initialize Supabase client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info(f"Connected to Supabase: {SUPABASE_URL}")

    # Filter cameras that have hosts configured
    active_cameras = [c for c in CAMERAS if c['host']]
    logger.info(f"Monitoring {len(active_cameras)} cameras")

    # Main loop
    while True:
        for camera in active_cameras:
            if not camera['host']:
                continue

            # Fetch snapshot
            image_data = fetch_snapshot(camera)

            if image_data:
                # Upload to Supabase
                upload_to_supabase(supabase, camera['id'], image_data)

        # Wait before next cycle
        time.sleep(UPLOAD_INTERVAL)


if __name__ == '__main__':
    logger.info("Starting Camera Uploader")
    logger.info(f"Upload interval: {UPLOAD_INTERVAL} seconds")

    try:
        main()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
