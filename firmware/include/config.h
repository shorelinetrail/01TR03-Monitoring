#ifndef CONFIG_H
#define CONFIG_H

// ============================================================================
// 01TR03 Transformer Monitoring System - Configuration
// ============================================================================

// Device identification
#define DEVICE_ID           "01TR03"
#define DEVICE_NAME         "01TR03 Transformer Monitor"
#define FIRMWARE_VERSION    "1.0.0"

// ============================================================================
// Pin Configuration - SSD1322 OLED Display (SPI)
// ============================================================================
// Following StationBoards pin configuration
#define OLED_CS_PIN         5       // Chip Select
#define OLED_DC_PIN         16      // Data/Command
#define OLED_RST_PIN        17      // Reset
// MOSI (DIN) = GPIO 23 (default hardware SPI)
// CLK (SCLK) = GPIO 18 (default hardware SPI)

// ============================================================================
// Sensor Type Selection
// ============================================================================
// Uncomment ONE of the following to select sensor type:
#define USE_MCP9600_SENSORS     // Seeed Studio Grove MCP9600 (I2C)
// #define USE_MAX31855_SENSORS    // Adafruit MAX31855 (SPI)

// ============================================================================
// Pin Configuration - I2C for MCP9600 Sensors
// ============================================================================
#define I2C_SDA_PIN         21      // Default ESP32 I2C SDA
#define I2C_SCL_PIN         22      // Default ESP32 I2C SCL

// MCP9600 I2C Addresses (Seeed Studio Grove modules)
// Address is set by ADDR pin: GND=0x60, VCC=0x67
#define MCP9600_MAIN_TANK_ADDR      0x60    // Main Tank thermocouple
#define MCP9600_TAP_CHANGER_ADDR    0x67    // Tap Changer Cover thermocouple

// ============================================================================
// Pin Configuration - SPI for MAX31855 Sensors
// ============================================================================
// MAX31855 uses SPI - shares MOSI/CLK with display, needs separate CS pins
#define MAX31855_MAIN_TANK_CS       25      // Main Tank MAX31855 Chip Select
#define MAX31855_TAP_CHANGER_CS     26      // Tap Changer MAX31855 Chip Select
// Note: MAX31855 is read-only SPI, uses CLK (GPIO 18) and MISO (GPIO 19)

// ============================================================================
// Temperature Thresholds (°C) - Defaults
// ============================================================================
#define MAIN_TANK_WARNING_DEFAULT       85.0
#define MAIN_TANK_ALARM_DEFAULT         95.0
#define TAP_CHANGER_WARNING_DEFAULT     70.0
#define TAP_CHANGER_ALARM_DEFAULT       85.0

// Temperature reading limits (sanity checks)
#define TEMP_MIN_VALID      -40.0
#define TEMP_MAX_VALID      200.0

// ============================================================================
// Timing Configuration
// ============================================================================
#define SENSOR_READ_INTERVAL_MS     5000    // Read sensors every 5 seconds
#define DISPLAY_UPDATE_INTERVAL_MS  1000    // Update display every 1 second
#define CLOUD_REPORT_INTERVAL_MS    30000   // Report to cloud every 30 seconds
#define WIFI_RECONNECT_INTERVAL_MS  30000   // Try reconnecting WiFi every 30 seconds
#define NTP_SYNC_INTERVAL_MS        3600000 // Sync NTP every hour

// Animation timing
#define ANIMATION_DURATION_MS       500     // Animation duration
#define PROGRESS_UPDATE_MS          100     // Progress bar update interval

// ============================================================================
// Display Configuration
// ============================================================================
#define DISPLAY_WIDTH       256
#define DISPLAY_HEIGHT      64

// Y-axis layout positions (following StationBoards pattern)
#define Y_HEADER            14      // Top header line
#define Y_TEMP_MAIN         28      // Main tank temperature line
#define Y_TEMP_TAP          42      // Tap changer temperature line
#define Y_STATUS            56      // Status line
#define Y_BOTTOM            64      // Bottom line (clock)

// X-axis positions
#define X_MARGIN            5       // Left margin
#define X_RIGHT_MARGIN      251     // Right alignment position
#define X_CENTER            128     // Center of display

// ============================================================================
// Network Configuration
// ============================================================================
#define WIFI_AP_SSID        "01TR03-Setup"
#define WIFI_AP_PASSWORD    "transformer"   // Change this!
#define WIFI_CONNECT_TIMEOUT_MS     15000   // 15 second connection timeout

// API endpoint (Supabase Edge Function or direct API)
// Set via web config or compile-time
#ifndef SUPABASE_URL
#define SUPABASE_URL        ""
#endif

#ifndef SUPABASE_ANON_KEY
#define SUPABASE_ANON_KEY   ""
#endif

// NTP Configuration
#define NTP_SERVER          "pool.ntp.org"
#define NTP_GMT_OFFSET      0               // UTC by default
#define NTP_DAYLIGHT_OFFSET 0

// ============================================================================
// Preferences (NVS) Keys
// ============================================================================
#define PREF_NAMESPACE      "tr03config"
#define PREF_WIFI_SSID      "wifi_ssid"
#define PREF_WIFI_PASS      "wifi_pass"
#define PREF_SUPABASE_URL   "supa_url"
#define PREF_SUPABASE_KEY   "supa_key"
#define PREF_MAIN_WARN      "main_warn"
#define PREF_MAIN_ALARM     "main_alarm"
#define PREF_TAP_WARN       "tap_warn"
#define PREF_TAP_ALARM      "tap_alarm"
#define PREF_CONFIGURED     "configured"

// ============================================================================
// Debug Configuration
// ============================================================================
#define DEBUG_SERIAL        true
#define SERIAL_BAUD_RATE    115200

#if DEBUG_SERIAL
    #define DEBUG_PRINT(x)      Serial.print(x)
    #define DEBUG_PRINTLN(x)    Serial.println(x)
    #define DEBUG_PRINTF(...)   Serial.printf(__VA_ARGS__)
#else
    #define DEBUG_PRINT(x)
    #define DEBUG_PRINTLN(x)
    #define DEBUG_PRINTF(...)
#endif

#endif // CONFIG_H
