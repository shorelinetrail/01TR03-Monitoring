# Temperature Monitoring System

A comprehensive temperature monitoring system featuring:

- **Temperature Monitoring**: Up to 4 thermocouple sensors (configurable type: K, J, T, N, S, E, B, R)
- **Local Display**: 256x64 OLED with SSD1322 controller
- **Cloud Dashboard**: Real-time web interface via Vercel
- **Data Visualization**: Grafana Cloud integration with gauges and trending
- **Camera Feeds**: Optional camera streams for visual monitoring

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FIELD EQUIPMENT                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │ Thermocouple │    │ Thermocouple │    │     Cameras      │   │
│  │   Sensor 1   │    │   Sensor 2   │    │    (optional)    │   │
│  │              │    │              │    │                  │   │
│  └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘   │
│         │                   │                     │             │
│  ┌──────┴───────┐    ┌──────┴───────┐            │             │
│  │   MCP9600    │    │   MCP9600    │            │             │
│  │  Amplifier   │    │  Amplifier   │            │             │
│  │  (I2C 0x60)  │    │  (I2C 0x61)  │            │             │
│  └──────┬───────┘    └──────┴───────┘            │             │
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
                   │            WiFi/4G            │
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
│         │  │  Vercel    │ │ Grafana  │ │  Camera  │   │         │
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
| MCP9600 x1-4 | Thermocouple amplifier | I2C addresses 0x60, 0x61, 0x65, 0x67 |
| Thermocouple x1-4 | Temperature sensors (configurable type) | Connected to MCP9600s |
| SSD1322 OLED | 256x64 pixel display | SPI interface |
| Cameras (optional) | Network cameras | WiFi/Ethernet |

## Project Structure

```
Temperature-Monitoring/
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
4. **Configure Grafana**: Set up data source and dashboard panels (optional)
5. **Set up Cameras**: Configure camera access (optional)

See [docs/SETUP.md](docs/SETUP.md) for detailed instructions.

## License

MIT License - See LICENSE file for details.
