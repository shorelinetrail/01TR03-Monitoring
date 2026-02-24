# Temperature Monitoring System - Hardware Guide

Detailed hardware specifications and wiring information.

## Bill of Materials

### Core Components

| Item | Part Number | Quantity | Supplier | Notes |
|------|-------------|----------|----------|-------|
| NodeMCU-32S | ESP32 DevKit | 1 | Various | ESP32 with 4MB flash |
| Thermocouple | Various | 1-4 | Omega, RS | Type K, J, T, N, S, E, B, or R |

### Sensor Options

#### Option A: MCP9600 (Recommended)

| Item | Part Number | Quantity | Notes |
|------|-------------|----------|-------|
| Grove MCP9600 | 101020934 | 1-4 | Seeed Studio, I2C interface |

**Advantages:**
- I2C interface (only 2 wires + power)
- Configurable thermocouple type
- 18-bit resolution
- Built-in cold junction compensation
- Configurable filtering

#### Option B: MAX6675

| Item | Part Number | Quantity | Notes |
|------|-------------|----------|-------|
| MAX6675 Breakout | Various | 1-2 | SPI interface, Type K only |

**Advantages:**
- Lower cost
- Faster reads
- Simpler protocol

### Display

| Item | Part Number | Quantity | Notes |
|------|-------------|----------|-------|
| SSD1322 OLED 3.12" | Various | 1 | 256x64 pixels, SPI interface |

### Cameras (Optional)

| Item | Part Number | Quantity | Notes |
|------|-------------|----------|-------|
| Network Camera | Various | 0-2 | PoE or WiFi cameras |
| PoE Injector | Various | As needed | If not using PoE switch |

### Power & Connectivity

| Item | Quantity | Notes |
|------|----------|-------|
| 5V Power Supply | 1 | 2A minimum for NodeMCU |
| WiFi/4G Router | 1 | For internet connectivity |
| PoE Switch | 1 | Optional, for camera power |

### Enclosure & Mounting

| Item | Quantity | Notes |
|------|----------|-------|
| IP65 Enclosure | 1 | Weather-rated for outdoor use |
| Cable Glands | As needed | For cable entry |
| DIN Rail | Optional | For mounting |

---

## Wiring Diagrams

### MCP9600 Configuration (Recommended)

```
                           NodeMCU-32S
                      ┌─────────────────────┐
                      │                     │
                      │     ┌───────────────┤ 3.3V
                      │     │   ┌───────────┤ GND
                      │     │   │           │
                      │     │   │   ┌───────┤ GPIO25 (SDA)
                      │     │   │   │   ┌───┤ GPIO26 (SCL)
                      │     │   │   │   │   │
                      │     │   │   │   │   │
  ┌───────────────────┼─────┼───┼───┼───┼───┼───────────────────┐
  │                   │     │   │   │   │   │                   │
  │   MCP9600 #1      │     │   │   │   │   │   MCP9600 #2      │
  │   (Sensor 1)      │     │   │   │   │   │   (Sensor 2)      │
  │   Addr: 0x60      │     │   │   │   │   │   Addr: 0x67      │
  │   ┌──────────┐    │     │   │   │   │   │   ┌──────────┐    │
  │   │ VCC  ────┼────┼─────┘   │   │   │   │   │ VCC  ────┼────┘
  │   │ GND  ────┼────┼─────────┘   │   │   │   │ GND  ────┼────┘
  │   │ SDA  ────┼────┼─────────────┘   │   │   │ SDA  ────┼────┘
  │   │ SCL  ────┼────┼─────────────────┘   │   │ SCL  ────┼────┘
  │   │ ADDR ────┼─┐  │                     │   │ ADDR ────┼─┐
  │   └──────────┘ │  │                     │   └──────────┘ │
  │                │  │                     │                │
  │           to GND  │                     │     via resistors
  │                   │                     │
  │   ┌──────────┐    │                     │   ┌──────────┐
  │   │Thermocouple   │                     │   │Thermocouple
  │   │(+) (-)   │    │                     │   │(+) (-)   │
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

---

## I2C Address Configuration (MCP9600)

The MCP9600 ADDR pin voltage determines the I2C address (8 levels at 1/8 VDD
increments, detection window ±VDD/32). A resistor divider from VCC to GND sets
the voltage. All resistors are 0603 values from the Vishay D11/CRCW0603 e3
sample kit.

| Sensor | I2C Address | R1 (ADDR to VCC) | R2 (ADDR to GND) | VADDR/VDD |
|--------|-------------|-------------------|-------------------|-----------|
| Sensor 1 (Main Tank) | 0x60 | — | 0Ω (jumper to GND) | 0.000 |
| Sensor 2 (Tap Changer) | 0x67 | 0Ω (jumper to VCC) | — | 1.000 |
| Sensor 3 | 0x64 | 9.09kΩ | 10kΩ | 0.524 |
| Sensor 4 | 0x62 | 30.1kΩ | 10kΩ | 0.249 |

```
         VCC (3.3V)
          │
         [R1]  ← Resistor to VCC
          │
  ADDR ───┤
          │
         [R2]  ← Resistor to GND
          │
         GND
```

For this project:
- **Sensor 1 (Main Tank):** Address `0x60` — ADDR to GND, no resistors
- **Sensor 2 (Tap Changer):** Address `0x67` — ADDR to VCC, no resistors
- **Sensor 3:** Address `0x64` — 9.09kΩ to VCC + 10kΩ to GND
- **Sensor 4:** Address `0x62` — 30.1kΩ to VCC + 10kΩ to GND

---

## SPI Bus Notes

The ESP32 hardware SPI bus is used for the display:

| Signal | GPIO | Device |
|--------|------|--------|
| MOSI | 23 | Display |
| CLK | 18 | Display |
| CS | 5 | Display |
| DC | 16 | Display |
| RST | 17 | Display |

---

## Thermocouple Selection

The MCP9600 supports multiple thermocouple types, configurable via the dashboard:

### Type K (Chromel-Alumel)
- Temperature Range: -200°C to +1260°C
- Sensitivity: ~41 µV/°C
- Most common general-purpose type

### Type J (Iron-Constantan)
- Temperature Range: -40°C to +750°C
- Sensitivity: ~50 µV/°C
- Good for industrial environments

### Type T (Copper-Constantan)
- Temperature Range: -200°C to +350°C
- Sensitivity: ~40 µV/°C
- Best for low temperature measurements

### Type N (Nicrosil-Nisil)
- Temperature Range: -270°C to +1300°C
- Sensitivity: ~39 µV/°C
- More stable than Type K at high temperatures

### Other Supported Types
- Type S, E, B, R - for specialized applications

---

## Power Requirements

| Component | Voltage | Current (typical) |
|-----------|---------|-------------------|
| NodeMCU-32S | 5V | 250mA (WiFi active) |
| MCP9600 | 3.3V | 2mA each |
| SSD1322 OLED | 3.3V | 80mA max |
| **Total** | 5V | ~500mA |

**Recommended:** 5V 2A power supply for safety margin.

---

## Camera Setup (Optional)

### Supported Camera Types

- Reolink (various models)
- Hikvision / Annke
- Dahua
- Any ONVIF compatible camera

### Camera Placement

Position cameras to monitor:
- Temperature gauges
- Equipment status indicators
- General area monitoring

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

- Secure mounting near monitored equipment
- Accessible for maintenance
- Protected from physical damage

---

## Safety Notes

⚠️ **WARNING**

When monitoring high-voltage equipment, ensure:

1. All installations comply with local electrical codes
2. Equipment is properly grounded
3. Thermocouples are rated for the installation environment
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
