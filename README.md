# 01TR03 Transformer Monitoring System

A comprehensive monitoring system for a 66/11kV 50MVA power transformer (01TR03) featuring:

- **Temperature Monitoring**: Two Type J thermocouples (Main Tank & Tap Changer Cover)
- **Local Display**: 256x64 OLED with SSD1322 controller
- **Cloud Dashboard**: Real-time web interface via Vercel
- **Data Visualization**: Grafana Cloud integration with gauges and trending
- **Camera Feeds**: Two Reolink DLP4K-UK camera streams

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FIELD EQUIPMENT                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │ Thermocouple │    │ Thermocouple │    │  Reolink Cameras │   │
│  │  Main Tank   │    │  Tap Changer │    │   DLP4K-UK (x2)  │   │
│  │   Type J     │    │   Type J     │    │                  │   │
│  └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘   │
│         │                   │                     │             │
│  ┌──────┴───────┐    ┌──────┴───────┐            │             │
│  │   MCP9600    │    │   MCP9600    │            │             │
│  │  Amplifier   │    │  Amplifier   │            │             │
│  │  (I2C 0x60)  │    │  (I2C 0x67)  │            │             │
│  └──────┬───────┘    └──────┬───────┘            │             │
│         └────────┬───────────┘                   │             │
│                  │ I2C                           │             │
│         ┌────────┴────────┐                      │             │
│         │   NodeMCU-32S   │                      │             │
│         │   ESP32 Board   │                      │             │
│         │                 │                      │             │
│         │  ┌───────────┐  │                      │             │
│         │  │ SSD1322   │  │                      │             │
│         │  │ OLED 256x64│ │                      │             │
│         │  └───────────┘  │                      │             │
│         └────────┬────────┘                      │             │
│                  │                               │             │
└──────────────────┼───────────────────────────────┼─────────────┘
                   │              4G               │
                   └───────────────┬───────────────┘
                                   │
┌──────────────────────────────────┼──────────────────────────────┐
│                           CLOUD                                 │
├──────────────────────────────────┼──────────────────────────────┤
│                                  │                              │
│         ┌────────────────────────┼────────────────────┐         │
│         │                        ▼                    │         │
│         │              ┌──────────────────┐           │         │
│         │              │    Supabase      │           │         │
│         │              │    Database      │           │         │
│         │              │   (PostgreSQL)   │           │         │
│         │              └────────┬─────────┘           │         │
│         │                       │                     │         │
│         │         ┌─────────────┼─────────────┐       │         │
│         │         ▼             ▼             ▼       │         │
│         │  ┌────────────┐ ┌──────────┐ ┌──────────┐   │         │
│         │  │  Vercel    │ │ Grafana  │ │ Reolink  │   │         │
│         │  │ Dashboard  │ │  Cloud   │ │  Cloud   │   │         │
│         │  │ (Next.js)  │ │ (Gauges) │ │ (Feeds)  │   │         │
│         │  └────────────┘ └──────────┘ └──────────┘   │         │
│         │         │             │             │       │         │
│         └─────────┴─────────────┴─────────────┴───────┘         │
│                                 │                               │
└─────────────────────────────────┼───────────────────────────────┘
                                  │
                                  ▼
                         ┌──────────────┐
                         │   Browser    │
                         │  Dashboard   │
                         └──────────────┘
```

## Hardware Components

| Component | Description | Connection |
|-----------|-------------|------------|
| NodeMCU-32S | ESP32 development board | Main controller |
| MCP9600 #1 | Thermocouple amplifier (Main Tank) | I2C address 0x60 |
| MCP9600 #2 | Thermocouple amplifier (Tap Changer) | I2C address 0x67 |
| Type J Thermocouple x2 | Temperature sensors | Connected to MCP9600s |
| SSD1322 OLED | 256x64 pixel display | SPI interface |
| Reolink DLP4K-UK x2 | 4K PoE cameras | Network via 4G |

## Project Structure

```
01TR03-Monitoring/
├── firmware/               # NodeMCU-32S PlatformIO project
│   ├── src/
│   │   └── main.cpp
│   ├── include/
│   │   ├── config.h
│   │   ├── display.h
│   │   ├── sensors.h
│   │   └── network.h
│   ├── lib/
│   └── platformio.ini
├── dashboard/              # Next.js Vercel web dashboard
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   ├── public/
│   └── package.json
├── database/               # Supabase schema
│   └── schema.sql
└── docs/                   # Documentation
    ├── SETUP.md
    ├── HARDWARE.md
    └── DEPLOYMENT.md
```

## Quick Start

1. **Set up Supabase**: Create database using `/database/schema.sql`
2. **Flash Firmware**: Configure and upload to NodeMCU-32S
3. **Deploy Dashboard**: Push to Vercel with environment variables
4. **Configure Grafana**: Set up data source and dashboard panels
5. **Set up Cameras**: Configure Reolink cloud access

See [docs/SETUP.md](docs/SETUP.md) for detailed instructions.

## License

MIT License - See LICENSE file for details.
