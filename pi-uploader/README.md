# Camera Snapshot Uploader for Raspberry Pi

This script runs on a Raspberry Pi Zero 2 W (or any Pi) on your local network. It captures snapshots from your cameras and uploads them to Supabase Storage, making them accessible from your Vercel-hosted dashboard.

## Architecture

```
[Local Network]                         [Cloud]

Cameras ──→ Raspberry Pi ──→ Internet ──→ Supabase Storage ──→ Vercel Dashboard
         (fetches snapshots)           (uploads every 5s)    (fetches for display)
```

## Prerequisites

- Raspberry Pi Zero 2 W (or any Pi with network)
- Raspberry Pi OS Lite (headless)
- Network connection to cameras
- Supabase project with Storage enabled

## Supabase Setup

1. Go to your Supabase dashboard → Storage
2. Create a new bucket called `camera-snapshots`
3. Set the bucket to **Public** (for read access)
4. Get your **Service Role Key** from Settings → API (NOT the anon key)

## Pi Setup

### 1. Flash Raspberry Pi OS Lite

Use Raspberry Pi Imager:
- Choose "Raspberry Pi OS Lite (64-bit)"
- Click the gear icon to pre-configure:
  - Enable SSH
  - Set username: `pi`
  - Set password
  - Configure WiFi (your local network)

### 2. SSH into the Pi

```bash
ssh pi@raspberrypi.local
# or use the IP address
```

### 3. Install Dependencies

```bash
sudo apt update
sudo apt install -y python3-pip python3-venv git
```

### 4. Clone and Setup

```bash
# Create directory
mkdir ~/camera-uploader
cd ~/camera-uploader

# Copy files (or clone repo)
# If cloning:
# git clone https://github.com/your-repo/Temperature-Monitoring.git
# cp Temperature-Monitoring/pi-uploader/* .

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python packages
pip install -r requirements.txt
```

### 5. Configure Environment

```bash
cp .env.example .env
nano .env
```

Edit with your actual values:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
UPLOAD_INTERVAL=5

CAM1_TYPE=reolink
CAM1_HOST=192.168.0.100
CAM1_USERNAME=admin
CAM1_PASSWORD=your-camera-password

CAM2_TYPE=reolink
CAM2_HOST=192.168.0.101
CAM2_USERNAME=admin
CAM2_PASSWORD=your-camera-password
```

### 6. Test Manually

```bash
source venv/bin/activate
python camera_uploader.py
```

You should see logs like:
```
2024-01-15 10:30:00 - INFO - Starting Camera Uploader
2024-01-15 10:30:00 - INFO - Got snapshot from cam1: 45632 bytes
2024-01-15 10:30:01 - INFO - Uploaded cam1/latest.jpg to Supabase Storage
```

### 7. Install as Service (Auto-start on Boot)

```bash
sudo cp camera-uploader.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable camera-uploader
sudo systemctl start camera-uploader
```

Check status:
```bash
sudo systemctl status camera-uploader
sudo journalctl -u camera-uploader -f  # Follow logs
```

## Vercel Configuration

In your Vercel project, set these environment variables:

```
CAM1_HOST=cam1
CAM1_TYPE=supabase
CAM1_USERNAME=
CAM1_PASSWORD=

CAM2_HOST=cam2
CAM2_TYPE=supabase
CAM2_USERNAME=
CAM2_PASSWORD=

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
CAMERA_BUCKET_NAME=camera-snapshots
```

Note: `CAM1_HOST=cam1` is the folder name in Supabase Storage, not an IP address.

## Camera Types Supported

| Type | Auth | Notes |
|------|------|-------|
| `reolink` | Query params | Default |
| `hikvision` | Digest | Also works for Annke |
| `annke` | Digest | Alias for hikvision |
| `dahua` | Digest | |

## Troubleshooting

### Camera not responding
- Check camera IP is correct
- Verify credentials
- Try accessing camera in browser first

### Upload failing
- Verify SUPABASE_SERVICE_KEY (not anon key)
- Check bucket exists and is named correctly
- Check bucket is public for reads

### Service not starting
```bash
sudo journalctl -u camera-uploader -n 50
```
