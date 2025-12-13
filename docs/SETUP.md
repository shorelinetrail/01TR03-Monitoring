# Temperature Monitoring System - Setup Guide

Complete step-by-step instructions for setting up the temperature monitoring system.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Hardware Assembly](#hardware-assembly)
3. [Supabase Database Setup](#supabase-database-setup)
4. [Firmware Configuration & Upload](#firmware-configuration--upload)
5. [Dashboard Deployment](#dashboard-deployment)
6. [Grafana Cloud Setup](#grafana-cloud-setup)
7. [Camera Configuration](#camera-configuration)
8. [System Testing](#system-testing)

---

## Prerequisites

### Hardware Required

| Item | Quantity | Notes |
|------|----------|-------|
| NodeMCU-32S | 1 | ESP32 development board |
| Thermocouple | 1-4 | Type K, J, T, N, S, E, B, or R |
| Seeed Grove MCP9600 | 1-4 | I2C thermocouple amplifier |
| SSD1322 OLED Display | 1 | 256x64, 3.12", SPI interface |
| Network Cameras | 0-2 | Optional, for visual monitoring |
| WiFi Router/4G Modem | 1 | For internet connectivity |
| Power Supply | 1 | 5V for NodeMCU |
| Enclosure | 1 | Weather-rated for outdoor installation |

### Software Required

- [PlatformIO IDE](https://platformio.org/install) (VSCode extension)
- [Node.js](https://nodejs.org/) v18+ (for dashboard)
- [Git](https://git-scm.com/)
- [Vercel CLI](https://vercel.com/cli) (optional)

### Accounts Required

- [Supabase](https://supabase.com/) - Free tier available
- [Vercel](https://vercel.com/) - Free tier available
- [Grafana Cloud](https://grafana.com/products/cloud/) - Free tier available (optional)

---

## Hardware Assembly

### Pin Connections

#### SSD1322 OLED Display (SPI)

| Display Pin | NodeMCU-32S GPIO | Notes |
|-------------|------------------|-------|
| VCC | 3.3V | Power |
| GND | GND | Ground |
| DIN (MOSI) | GPIO 23 | SPI Data |
| CLK (SCLK) | GPIO 18 | SPI Clock |
| CS | GPIO 5 | Chip Select |
| DC | GPIO 16 | Data/Command |
| RST | GPIO 17 | Reset |

#### MCP9600 Sensors (I2C)

| MCP9600 Pin | NodeMCU-32S GPIO | Notes |
|-------------|------------------|-------|
| VCC | 3.3V | Power |
| GND | GND | Ground |
| SDA | GPIO 25 | I2C Data |
| SCL | GPIO 26 | I2C Clock |

**I2C Addresses:**
- Sensor 1: `0x60` (ADDR pin to GND)
- Sensor 2: `0x61` (47k to VCC, 10k to GND)
- Sensor 3: `0x65` (3.9k to VCC, 10k to GND)
- Sensor 4: `0x67` (ADDR pin to VCC)

### Wiring Diagram

```
                                    NodeMCU-32S
                              ┌─────────────────────┐
                              │                     │
    MCP9600 #1 ──── SDA ──────┤ GPIO25         3.3V├──── VCC (All devices)
    (Sensor 1)     SCL ──────┤ GPIO26          GND├──── GND (All devices)
                              │                     │
    MCP9600 #2 ──── SDA ──────┤ GPIO25              │
    (Sensor 2)     SCL ──────┤ GPIO26              │
                              │                     │
    SSD1322 ────── MOSI ─────┤ GPIO23              │
    Display        CLK ──────┤ GPIO18              │
                   CS ───────┤ GPIO5               │
                   DC ───────┤ GPIO16              │
                   RST ──────┤ GPIO17              │
                              │                     │
                              └─────────────────────┘
```

---

## Supabase Database Setup

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com/) and sign in
2. Click "New Project"
3. Enter project details:
   - Name: `Temperature-Monitoring`
   - Database Password: (save this securely)
   - Region: Choose closest to your location
4. Click "Create new project"

### Step 2: Run Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy the contents of `/database/schema.sql`
4. Paste into the query editor
5. Click "Run" to execute

### Step 3: Get API Credentials

1. Go to **Settings** > **API**
2. Copy these values (you'll need them later):
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIs...`

### Step 4: Enable Real-time

1. Go to **Database** > **Replication**
2. Enable replication for these tables:
   - `temperature_readings`
   - `alerts`
   - `devices`

---

## Firmware Configuration & Upload

### Step 1: Clone Repository

```bash
git clone https://github.com/your-repo/Temperature-Monitoring.git
cd Temperature-Monitoring/firmware
```

### Step 2: Configure Sensor Type

Edit `/firmware/src/main.cpp`:

```cpp
// Uncomment ONE of the following:
#define USE_MCP9600   // For Grove MCP9600 (I2C) - recommended
// #define USE_MAX6675    // For MAX6675 (SPI)
```

### Step 3: Build and Upload

Using PlatformIO:

```bash
# Build
pio run

# Upload
pio run --target upload

# Monitor serial output
pio device monitor
```

### Step 4: Initial Configuration

1. Power on the NodeMCU-32S
2. The display will show "SETUP MODE"
3. Connect to WiFi network: `TempMonitor-Setup`
4. Open browser: `http://192.168.4.1`
5. Enter your WiFi credentials and Supabase settings
6. Click "Save & Connect"
7. Device will restart and connect to your network

---

## Dashboard Deployment

### Step 1: Configure Environment

```bash
cd Temperature-Monitoring/dashboard
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# Grafana (optional)
NEXT_PUBLIC_GRAFANA_URL=https://your-instance.grafana.net
NEXT_PUBLIC_GRAFANA_DASHBOARD_ID=your-dashboard-id

# Cameras (optional)
CAM1_HOST=192.168.1.100
CAM1_USERNAME=admin
CAM1_PASSWORD=your-password
CAM2_HOST=192.168.1.101
CAM2_USERNAME=admin
CAM2_PASSWORD=your-password

# Device
NEXT_PUBLIC_DEVICE_ID=DEVICE01
```

### Step 2: Test Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` to verify the dashboard works.

### Step 3: Deploy to Vercel

**Option A: Via Vercel CLI**

```bash
npm i -g vercel
vercel
```

Follow the prompts to deploy.

**Option B: Via GitHub**

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com/)
3. Click "Import Project"
4. Select your GitHub repository
5. Configure environment variables (copy from `.env.local`)
6. Click "Deploy"

### Step 4: Configure Production Environment Variables

In Vercel dashboard:
1. Go to your project
2. Click **Settings** > **Environment Variables**
3. Add all variables from `.env.local`

---

## Grafana Cloud Setup

### Step 1: Create Grafana Cloud Account

1. Go to [grafana.com/products/cloud](https://grafana.com/products/cloud/)
2. Sign up for free tier
3. Note your instance URL: `https://xxxxx.grafana.net`

### Step 2: Add Supabase as Data Source

1. In Grafana, go to **Connections** > **Data Sources**
2. Click "Add data source"
3. Select "PostgreSQL"
4. Configure connection:
   - Host: `db.xxxxx.supabase.co:5432`
   - Database: `postgres`
   - User: `postgres`
   - Password: (your Supabase database password)
   - SSL Mode: `require`

### Step 3: Create Dashboard

1. Go to **Dashboards** > **New Dashboard**
2. Add panels:

**Temperature Gauge Panel:**
- Visualization: Gauge
- Query:
```sql
SELECT main_tank_temp as "Sensor 1"
FROM temperature_readings
WHERE device_id = 'DEVICE01'
ORDER BY recorded_at DESC
LIMIT 1
```
- Thresholds: 0-85 (green), 85-95 (yellow), 95+ (red)

**Temperature Trend Panel:**
- Visualization: Time series
- Query:
```sql
SELECT
  recorded_at as time,
  main_tank_temp as "Sensor 1",
  tap_changer_temp as "Sensor 2"
FROM temperature_readings
WHERE device_id = 'DEVICE01'
  AND recorded_at > now() - interval '24 hours'
ORDER BY recorded_at
```

### Step 4: Get Embed URL

1. Click the panel title > **Share**
2. Click **Embed**
3. Copy the dashboard ID and panel ID
4. Add to your dashboard `.env`:
```env
NEXT_PUBLIC_GRAFANA_URL=https://your-instance.grafana.net
NEXT_PUBLIC_GRAFANA_DASHBOARD_ID=your-dashboard-id
```

---

## Camera Configuration

### Step 1: Install Cameras

1. Mount cameras to view desired areas
2. Connect cameras to network (PoE recommended)
3. Note the IP addresses assigned to each camera

### Step 2: Configure Camera Network

For 4G connection, ensure your router:
1. Has port forwarding enabled for camera RTSP/HTTP ports
2. Or use camera cloud service for remote access

### Step 3: Update Dashboard Configuration

Edit `.env.local` with camera details:

```env
CAM1_HOST=192.168.1.100
CAM1_USERNAME=admin
CAM1_PASSWORD=your-camera-password

CAM2_HOST=192.168.1.101
CAM2_USERNAME=admin
CAM2_PASSWORD=your-camera-password
```

### Step 4: Test Camera Access

```bash
# Test snapshot URL (replace with your values)
curl "http://192.168.1.100/cgi-bin/api.cgi?cmd=Snap&channel=0&user=admin&password=your-password"
```

---

## System Testing

### Checklist

- [ ] **Hardware**
  - [ ] Display shows boot sequence
  - [ ] Thermocouples reading temperatures
  - [ ] WiFi connects successfully
  - [ ] NTP time syncs

- [ ] **Database**
  - [ ] Readings appear in Supabase `temperature_readings` table
  - [ ] Device status updates in `devices` table
  - [ ] Alerts generated when thresholds exceeded

- [ ] **Dashboard**
  - [ ] Temperature gauges display correctly
  - [ ] Chart shows historical data
  - [ ] Real-time updates working
  - [ ] Camera feeds loading (if configured)

- [ ] **Alerts**
  - [ ] Warning threshold triggers warning status
  - [ ] Alarm threshold triggers alarm status
  - [ ] Alerts can be acknowledged

### Troubleshooting

**Display shows "ERROR":**
- Check thermocouple connections
- Verify I2C addresses (run I2C scanner)
- Check sensor power supply

**No data in Supabase:**
- Verify Supabase URL and API key in device config
- Check WiFi connection
- Monitor serial output for errors

**Camera feeds not loading:**
- Verify camera IP addresses
- Check camera credentials
- Test direct snapshot URL access

**Dashboard not updating:**
- Check browser console for errors
- Verify Supabase real-time is enabled
- Check network connectivity

---

## Support

For issues and questions:
- Check the GitHub issues page
- Review the serial monitor output for error messages
- Verify all environment variables are set correctly
