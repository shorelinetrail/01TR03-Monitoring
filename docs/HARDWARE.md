# 01TR03 Transformer Monitoring System - Hardware Guide

Detailed hardware specifications and wiring information.

## Bill of Materials

### Core Components

| Item | Part Number | Quantity | Supplier | Notes |
|------|-------------|----------|----------|-------|
| NodeMCU-32S | ESP32 DevKit | 1 | Various | ESP32 with 4MB flash |
| Type J Thermocouple | Various | 2 | Omega, RS | -40°C to +750°C range |

### Sensor Options

#### Option A: MCP9600 (Recommended)

| Item | Part Number | Quantity | Notes |
|------|-------------|----------|-------|
| Grove MCP9600 | 101020934 | 2 | Seeed Studio, I2C interface |

**Advantages:**
- I2C interface (only 2 wires + power)
- Configurable thermocouple type
- 18-bit resolution
- Built-in cold junction compensation
- Configurable filtering

#### Option B: MAX31855

| Item | Part Number | Quantity | Notes |
|------|-------------|----------|-------|
| MAX31855 Breakout | ADA269 | 2 | Adafruit, SPI interface |

**Advantages:**
- Lower cost
- Faster reads
- Simpler protocol

### Display

| Item | Part Number | Quantity | Notes |
|------|-------------|----------|-------|
| SSD1322 OLED 3.12" | Various | 1 | 256x64 pixels, SPI interface |

### Cameras

| Item | Part Number | Quantity | Notes |
|------|-------------|----------|-------|
| Reolink DLP4K | DLP4K-UK | 2 | 4K PoE camera |
| PoE Injector | Various | 2 | If not using PoE switch |

### Power & Connectivity

| Item | Quantity | Notes |
|------|----------|-------|
| 5V Power Supply | 1 | 2A minimum for NodeMCU |
| 4G Router | 1 | For internet connectivity |
| PoE Switch | 1 | Optional, for camera power |

### Enclosure & Mounting

| Item | Quantity | Notes |
|------|----------|-------|
| IP65 Enclosure | 1 | Weather-rated for outdoor use |
| Cable Glands | As needed | For cable entry |
| DIN Rail | Optional | For mounting |

---

## Wiring Diagrams

### MCP9600 Configuration (Option A)

```
                           NodeMCU-32S
                      ┌─────────────────────┐
                      │                     │
                      │     ┌───────────────┤ 3.3V
                      │     │   ┌───────────┤ GND
                      │     │   │           │
                      │     │   │   ┌───────┤ GPIO21 (SDA)
                      │     │   │   │   ┌───┤ GPIO22 (SCL)
                      │     │   │   │   │   │
                      │     │   │   │   │   │
  ┌───────────────────┼─────┼───┼───┼───┼───┼───────────────────┐
  │                   │     │   │   │   │   │                   │
  │   MCP9600 #1      │     │   │   │   │   │   MCP9600 #2      │
  │   (Main Tank)     │     │   │   │   │   │   (Tap Changer)   │
  │   Addr: 0x60      │     │   │   │   │   │   Addr: 0x67      │
  │   ┌──────────┐    │     │   │   │   │   │   ┌──────────┐    │
  │   │ VCC  ────┼────┼─────┘   │   │   │   │   │ VCC  ────┼────┘
  │   │ GND  ────┼────┼─────────┘   │   │   │   │ GND  ────┼────┘
  │   │ SDA  ────┼────┼─────────────┘   │   │   │ SDA  ────┼────┘
  │   │ SCL  ────┼────┼─────────────────┘   │   │ SCL  ────┼────┘
  │   │ ADDR ────┼─┐  │                     │   │ ADDR ────┼─┐
  │   └──────────┘ │  │                     │   └──────────┘ │
  │                │  │                     │                │
  │           to GND  │                     │           to VCC
  │                   │                     │
  │   ┌──────────┐    │                     │   ┌──────────┐
  │   │Type J TC │    │                     │   │Type J TC │
  │   │(+) Red   │    │                     │   │(+) Red   │
  │   │(-) White │    │                     │   │(-) White │
  │   └──────────┘    │                     │   └──────────┘
  │                   │                     │
  └───────────────────┼─────────────────────┼───────────────────┘
                      │                     │
                      │                     │
                      │     SSD1322 OLED    │
                      │     ┌──────────┐    │
                      │     │ VCC  ────┼────┤ 3.3V
                      │     │ GND  ────┼────┤ GND
                      │     │ DIN  ────┼────┤ GPIO23 (MOSI)
                      │     │ CLK  ────┼────┤ GPIO18 (SCLK)
                      │     │ CS   ────┼────┤ GPIO5
                      │     │ DC   ────┼────┤ GPIO16
                      │     │ RST  ────┼────┤ GPIO17
                      │     └──────────┘    │
                      │                     │
                      └─────────────────────┘
```

### MAX31855 Configuration (Option B)

```
                           NodeMCU-32S
                      ┌─────────────────────┐
                      │                     │
                      │     ┌───────────────┤ 3.3V
                      │     │   ┌───────────┤ GND
                      │     │   │           │
                      │     │   │   ┌───────┤ GPIO18 (CLK)
                      │     │   │   │   ┌───┤ GPIO19 (MISO)
                      │     │   │   │   │   │
                      │     │   │   │   │   ├─────────┐
                      │     │   │   │   │   │         │
  ┌───────────────────┼─────┼───┼───┼───┼───┼─────────┼─────────┐
  │                   │     │   │   │   │   │         │         │
  │   MAX31855 #1     │     │   │   │   │   │   MAX31855 #2     │
  │   (Main Tank)     │     │   │   │   │   │   (Tap Changer)   │
  │   ┌──────────┐    │     │   │   │   │   │   ┌──────────┐    │
  │   │ VCC  ────┼────┼─────┘   │   │   │   │   │ VCC  ────┼────┘
  │   │ GND  ────┼────┼─────────┘   │   │   │   │ GND  ────┼────┘
  │   │ CLK  ────┼────┼─────────────┘   │   │   │ CLK  ────┼────┘
  │   │ DO   ────┼────┼─────────────────┘   │   │ DO   ────┼────┘
  │   │ CS   ────┼────┼── GPIO25            │   │ CS   ────┼── GPIO26
  │   └──────────┘    │                     │   └──────────┘
  │                   │                     │
  │   ┌──────────┐    │                     │   ┌──────────┐
  │   │Type K TC │    │                     │   │Type K TC │
  │   │(+) Yellow│    │                     │   │(+) Yellow│
  │   │(-) Red   │    │                     │   │(-) Red   │
  │   └──────────┘    │                     │   └──────────┘
  │                   │                     │
  └───────────────────┼─────────────────────┼───────────────────┘
                      │                     │
                      │     SSD1322 OLED    │
                      │     ┌──────────┐    │
                      │     │ VCC  ────┼────┤ 3.3V
                      │     │ GND  ────┼────┤ GND
                      │     │ DIN  ────┼────┤ GPIO23 (MOSI)
                      │     │ CLK  ────┼────┤ GPIO18 (shared)
                      │     │ CS   ────┼────┤ GPIO5
                      │     │ DC   ────┼────┤ GPIO16
                      │     │ RST  ────┼────┤ GPIO17
                      │     └──────────┘    │
                      │                     │
                      └─────────────────────┘
```

---

## I2C Address Configuration (MCP9600)

The Seeed Grove MCP9600 modules have an ADDR pin for setting the I2C address:

| ADDR Pin | I2C Address |
|----------|-------------|
| GND | 0x60 |
| VCC | 0x67 |

For this project:
- **Main Tank sensor:** ADDR to GND → Address `0x60`
- **Tap Changer sensor:** ADDR to VCC → Address `0x67`

---

## SPI Bus Notes

The ESP32 hardware SPI bus is shared between the display and MAX31855 sensors:

| Signal | GPIO | Shared |
|--------|------|--------|
| MOSI | 23 | Display only |
| MISO | 19 | MAX31855 only |
| CLK | 18 | Both |
| CS (Display) | 5 | Display |
| CS (MAX31855 #1) | 25 | Main Tank |
| CS (MAX31855 #2) | 26 | Tap Changer |

**Note:** Only one device can be active on the SPI bus at a time. The firmware handles CS pin management automatically.

---

## Thermocouple Selection

### Type J (Iron-Constantan)

- Temperature Range: -40°C to +750°C
- Sensitivity: ~50 µV/°C
- Best for: Industrial environments, transformer monitoring
- Wire Colors: (+) White, (-) Red

### Type K (Chromel-Alumel)

- Temperature Range: -200°C to +1260°C
- Sensitivity: ~41 µV/°C
- Wire Colors: (+) Yellow, (-) Red

**Note:** The MCP9600 supports both types and can be configured in firmware. The MAX31855 is designed for Type K but works reasonably well with Type J.

---

## Power Requirements

| Component | Voltage | Current (typical) |
|-----------|---------|-------------------|
| NodeMCU-32S | 5V | 250mA (WiFi active) |
| MCP9600 | 3.3V | 2mA each |
| MAX31855 | 3.3V | 1.5mA each |
| SSD1322 OLED | 3.3V | 80mA max |
| **Total** | 5V | ~500mA |

**Recommended:** 5V 2A power supply for safety margin.

---

## Camera Setup

### Reolink DLP4K-UK Specifications

- Resolution: 4K (3840x2160)
- Power: PoE (802.3af) or 12V DC
- Network: Ethernet (PoE)
- Snapshot URL: `http://{IP}/cgi-bin/api.cgi?cmd=Snap&channel=0&user={user}&password={pass}`

### Camera Placement

1. **Camera 1 (Oil & Winding Temperatures)**
   - Position to view transformer temperature gauges
   - Ensure gauges are clearly readable
   - Consider lighting for night visibility

2. **Camera 2 (Oil Level)**
   - Position to view oil level indicator
   - Ensure marker lines are visible
   - Consider backlighting if needed

---

## Enclosure Considerations

### Environmental Protection

- IP65 or higher rating for outdoor installation
- UV-resistant material
- Adequate ventilation for heat dissipation

### Cable Entry

- Use cable glands rated for outdoor use
- Seal around thermocouple cables
- Consider strain relief for all cables

### Mounting

- Secure mounting near transformer
- Accessible for maintenance
- Protected from physical damage

---

## Safety Notes

⚠️ **HIGH VOLTAGE WARNING**

This system monitors high-voltage transformer equipment. Ensure:

1. All installations comply with local electrical codes
2. Equipment is properly grounded
3. Thermocouples are rated for transformer installation
4. Enclosure is properly sealed and rated
5. Installation is performed by qualified personnel
6. Proper lockout/tagout procedures are followed during installation

---

## Testing Procedures

### Sensor Verification

1. Connect to serial monitor (115200 baud)
2. Check sensor initialization messages
3. Verify temperature readings are reasonable
4. Test threshold alarms with heat source

### Display Verification

1. Observe boot sequence on display
2. Verify temperature values update
3. Check status indicators
4. Test WiFi indicator

### Network Verification

1. Verify WiFi connection
2. Check Supabase data upload
3. Verify NTP time sync
4. Test real-time updates in dashboard
