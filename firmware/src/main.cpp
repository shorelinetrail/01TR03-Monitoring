/**
 * Temperature Monitoring System
 *
 * ESP32 with Thermocouple Amplifiers and SSD1322 OLED
 */

#include <Arduino.h>
#include <U8g2lib.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <HTTPClient.h>

// ============================================================================
// SENSOR SELECTION - Uncomment ONE of these
// ============================================================================
// #define USE_MAX6675      // Type K, SPI, no cold junction readout
#define USE_MCP9600   // Type J/K, I2C, cold junction available

#ifdef USE_MAX6675
  #include <max6675.h>
#endif

#ifdef USE_MCP9600
  #include <Wire.h>
  #include <Adafruit_MCP9600.h>
#endif

// Configuration
#define DEVICE_ID           "DEVICE01"
#define FIRMWARE_VERSION    "1.5.0"
#define WIFI_AP_SSID        "TempMonitor-Setup"
#define WIFI_AP_PASSWORD    "transformer"

// Remote logging buffer
#define LOG_BUFFER_SIZE 100
struct LogEntry {
    String level;
    String message;
};
LogEntry logBuffer[LOG_BUFFER_SIZE];
int logBufferHead = 0;
int logBufferCount = 0;
unsigned long lastLogUpload = 0;
const unsigned long LOG_UPLOAD_INTERVAL = 5000;  // Upload logs every 5 seconds

// Display pins (matching StationBoards)
#define OLED_CS   5
#define OLED_DC   16
#define OLED_RST  17

#ifdef USE_MAX6675
  // MAX6675 SPI pins (software SPI to avoid display conflict)
  #define THERMO_CLK    25
  #define THERMO_MISO   26
  #define THERMO_CS1    27   // Main Tank
  #define THERMO_CS2    14   // Tap Changer
#endif

#ifdef USE_MCP9600
  // Single I2C bus with auto-detection
  #define I2C_SDA       21
  #define I2C_SCL       22

  // MCP9600 valid address range: 0x60-0x67
  // Addresses are auto-detected - no need to hardcode
  #define MCP9600_ADDR_MIN  0x60
  #define MCP9600_ADDR_MAX  0x67
#endif

// Temperature thresholds (defaults, configurable via web interface)
float mainTankWarning = 85.0;
float mainTankAlarm = 95.0;
float tapChangerWarning = 70.0;
float tapChangerAlarm = 85.0;
float sensor3Warning = 70.0;
float sensor3Alarm = 85.0;
float sensor4Warning = 70.0;
float sensor4Alarm = 85.0;

// Sensor enabled flags
bool sensor2Enabled = true;
bool sensor3Enabled = false;
bool sensor4Enabled = false;
int sensorsEnabled = 2;  // Number of sensors enabled (1-4)

// Per-sensor thermocouple types (K, J, T, N, S, E, B, R) - configurable via dashboard
String sensor1ThermocoupleType = "K";
String sensor2ThermocoupleType = "K";
String sensor3ThermocoupleType = "K";
String sensor4ThermocoupleType = "K";

// Display - exact same as StationBoards
U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2(U8G2_R0, OLED_CS, OLED_DC, OLED_RST);

// Sensor objects
#ifdef USE_MAX6675
  MAX6675 thermoMainTank(THERMO_CLK, THERMO_CS1, THERMO_MISO);
  MAX6675 thermoTapChanger(THERMO_CLK, THERMO_CS2, THERMO_MISO);
#endif

#ifdef USE_MCP9600
  Adafruit_MCP9600 mcp9600_sensor1;  // Main Tank
  Adafruit_MCP9600 mcp9600_sensor2;  // Tap Changer
  Adafruit_MCP9600 mcp9600_sensor3;  // Sensor 3
  Adafruit_MCP9600 mcp9600_sensor4;  // Sensor 4

  // Auto-detected addresses (0 = not found)
  uint8_t sensor1Addr = 0;
  uint8_t sensor2Addr = 0;
  uint8_t sensor3Addr = 0;
  uint8_t sensor4Addr = 0;
#endif

bool mainTankSensorOK = false;
bool tapChangerSensorOK = false;
bool sensor3SensorOK = false;
bool sensor4SensorOK = false;

// Web server
WebServer webServer(80);
Preferences preferences;

// State
bool wifiConnected = false;
bool apMode = false;
float mainTankTemp = 0.0;
float tapChangerTemp = 0.0;
float sensor3Temp = 0.0;
float sensor4Temp = 0.0;
float ambientTemp = 0.0;
String mainTankStatus = "---";
String tapChangerStatus = "---";
String sensor3Status = "---";
String sensor4Status = "---";
unsigned long lastSensorRead = 0;
unsigned long lastDisplayUpdate = 0;
unsigned long lastDataUpload = 0;
unsigned long lastConfigFetch = 0;
unsigned long uploadInterval = 30000;  // Default 30 seconds, fetched from Supabase
const unsigned long CONFIG_FETCH_INTERVAL = 30000;  // Fetch config every 30 seconds

// Configuration
String wifiSSID = "";
String wifiPassword = "";
String supabaseUrl = "";
String supabaseKey = "";

// ============================================================================
// Remote Logging Functions
// ============================================================================

void addLog(const char* level, const char* format, ...) {
    char buffer[256];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);

    // Print to serial
    Serial.printf("[%s] %s\n", level, buffer);

    // Add to ring buffer
    int idx = (logBufferHead + logBufferCount) % LOG_BUFFER_SIZE;
    if (logBufferCount < LOG_BUFFER_SIZE) {
        logBufferCount++;
    } else {
        logBufferHead = (logBufferHead + 1) % LOG_BUFFER_SIZE;
    }
    logBuffer[idx].level = level;
    logBuffer[idx].message = buffer;
}

void logDebug(const char* format, ...) {
    char buffer[256];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    addLog("DEBUG", "%s", buffer);
}

void logInfo(const char* format, ...) {
    char buffer[256];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    addLog("INFO", "%s", buffer);
}

void logWarn(const char* format, ...) {
    char buffer[256];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    addLog("WARN", "%s", buffer);
}

void logError(const char* format, ...) {
    char buffer[256];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    addLog("ERROR", "%s", buffer);
}

void uploadLogs() {
    if (!wifiConnected || supabaseUrl.length() == 0 || supabaseKey.length() == 0) {
        return;
    }

    if (logBufferCount == 0) {
        return;
    }

    HTTPClient http;
    String url = supabaseUrl + "/rest/v1/device_logs";

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", supabaseKey);
    http.addHeader("Authorization", "Bearer " + supabaseKey);
    http.addHeader("Prefer", "return=minimal");

    // Build JSON array of log entries
    String json = "[";
    bool first = true;

    while (logBufferCount > 0) {
        LogEntry& entry = logBuffer[logBufferHead];

        if (!first) json += ",";
        first = false;

        // Escape special characters in message
        String escapedMsg = entry.message;
        escapedMsg.replace("\\", "\\\\");
        escapedMsg.replace("\"", "\\\"");
        escapedMsg.replace("\n", "\\n");
        escapedMsg.replace("\r", "\\r");

        json += "{\"device_id\":\"" + String(DEVICE_ID) + "\",";
        json += "\"level\":\"" + entry.level + "\",";
        json += "\"message\":\"" + escapedMsg + "\"}";

        logBufferHead = (logBufferHead + 1) % LOG_BUFFER_SIZE;
        logBufferCount--;
    }
    json += "]";

    int httpCode = http.POST(json);

    if (httpCode != 201 && httpCode != 200) {
        Serial.printf("Log upload failed: %d\n", httpCode);
    }

    http.end();
}

// ============================================================================
// Display Functions
// ============================================================================

void displayBoot(int progress, const char* message) {
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_helvB12_tr);

    // Title
    const char* title = "TEMP MONITOR";
    int titleWidth = u8g2.getStrWidth(title);
    u8g2.drawStr((256 - titleWidth) / 2, 14, title);

    // Message
    u8g2.setFont(u8g2_font_helvB08_tr);
    int msgWidth = u8g2.getStrWidth(message);
    u8g2.drawStr((256 - msgWidth) / 2, 32, message);

    // Progress bar
    u8g2.drawFrame(28, 40, 200, 12);
    int fillWidth = (progress * 196) / 100;
    if (fillWidth > 0) {
        u8g2.drawBox(30, 42, fillWidth, 8);
    }

    // Percentage
    char pctStr[8];
    snprintf(pctStr, sizeof(pctStr), "%d%%", progress);
    int pctWidth = u8g2.getStrWidth(pctStr);
    u8g2.drawStr((256 - pctWidth) / 2, 62, pctStr);

    u8g2.sendBuffer();
}

void displayAPMode(const char* ssid, const char* ip) {
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_helvB12_tr);

    const char* title = "SETUP MODE";
    int titleWidth = u8g2.getStrWidth(title);
    u8g2.drawStr((256 - titleWidth) / 2, 14, title);

    u8g2.setFont(u8g2_font_helvB08_tr);
    u8g2.drawStr(10, 30, "Connect to WiFi:");

    u8g2.setFont(u8g2_font_helvB10_tr);
    int ssidWidth = u8g2.getStrWidth(ssid);
    u8g2.drawStr((256 - ssidWidth) / 2, 44, ssid);

    u8g2.setFont(u8g2_font_helvB08_tr);
    char urlStr[32];
    snprintf(urlStr, sizeof(urlStr), "http://%s", ip);
    int urlWidth = u8g2.getStrWidth(urlStr);
    u8g2.drawStr((256 - urlWidth) / 2, 58, urlStr);

    u8g2.sendBuffer();
}

void displayTemperatures() {
    u8g2.clearBuffer();

    // Header
    u8g2.setFont(u8g2_font_helvB10_tr);
    const char* title = "TEMP MONITOR";
    int titleWidth = u8g2.getStrWidth(title);
    u8g2.drawStr((256 - titleWidth) / 2, 12, title);
    u8g2.drawHLine(0, 15, 256);

    // Main Tank
    u8g2.setFont(u8g2_font_helvB08_tr);
    u8g2.drawStr(5, 30, "Main Tank:");

    char tempStr[16];
    if (mainTankSensorOK) {
        snprintf(tempStr, sizeof(tempStr), "%.1f C", mainTankTemp);
    } else {
        snprintf(tempStr, sizeof(tempStr), "---");
    }
    u8g2.setFont(u8g2_font_helvB10_tr);
    u8g2.drawStr(100, 30, tempStr);

    u8g2.setFont(u8g2_font_6x10_tr);
    u8g2.drawStr(200, 30, mainTankStatus.c_str());

    // Tap Changer
    u8g2.setFont(u8g2_font_helvB08_tr);
    u8g2.drawStr(5, 46, "Tap Changer:");

    if (tapChangerSensorOK) {
        snprintf(tempStr, sizeof(tempStr), "%.1f C", tapChangerTemp);
    } else {
        snprintf(tempStr, sizeof(tempStr), "---");
    }
    u8g2.setFont(u8g2_font_helvB10_tr);
    u8g2.drawStr(100, 46, tempStr);

    u8g2.setFont(u8g2_font_6x10_tr);
    u8g2.drawStr(200, 46, tapChangerStatus.c_str());

    // Status bar
    u8g2.drawHLine(0, 50, 256);
    u8g2.setFont(u8g2_font_6x10_tr);

    // WiFi status
    if (wifiConnected) {
        u8g2.drawStr(5, 62, "WiFi:OK");
    } else {
        u8g2.drawStr(5, 62, "WiFi:--");
    }

    // Ambient
    snprintf(tempStr, sizeof(tempStr), "Amb:%.0fC", ambientTemp);
    int ambWidth = u8g2.getStrWidth(tempStr);
    u8g2.drawStr(256 - ambWidth - 5, 62, tempStr);

    u8g2.sendBuffer();
}

// ============================================================================
// Sensor Functions
// ============================================================================

#ifdef USE_MCP9600
// Convert thermocouple type string to MCP9600 enum
// Note: Library has typo "Themocouple" instead of "Thermocouple"
MCP9600_ThemocoupleType getThermocoupleTypeEnum(const String& tcType) {
    if (tcType == "K") return MCP9600_TYPE_K;
    if (tcType == "J") return MCP9600_TYPE_J;
    if (tcType == "T") return MCP9600_TYPE_T;
    if (tcType == "N") return MCP9600_TYPE_N;
    if (tcType == "S") return MCP9600_TYPE_S;
    if (tcType == "E") return MCP9600_TYPE_E;
    if (tcType == "B") return MCP9600_TYPE_B;
    if (tcType == "R") return MCP9600_TYPE_R;
    return MCP9600_TYPE_K;  // Default to Type K
}

bool initMCP9600(Adafruit_MCP9600 &sensor, uint8_t addr, const char* name, const String& tcType, TwoWire &wirePort = Wire) {
    logInfo("Initializing MCP9600 %s at 0x%02X", name, addr);

    // Check if device responds on I2C
    wirePort.beginTransmission(addr);
    uint8_t error = wirePort.endTransmission();
    if (error != 0) {
        logError("MCP9600 %s: I2C error %d - no device at 0x%02X", name, error, addr);
        return false;
    }
    logDebug("MCP9600 %s: I2C device found at 0x%02X", name, addr);

    if (!sensor.begin(addr, &wirePort)) {
        logError("MCP9600 %s (0x%02X): begin() failed", name, addr);
        return false;
    }
    logDebug("MCP9600 %s: begin() OK", name);

    // Configure thermocouple type from settings
    sensor.setADCresolution(MCP9600_ADCRESOLUTION_18);
    sensor.setThermocoupleType(getThermocoupleTypeEnum(tcType));
    sensor.setFilterCoefficient(3);  // Medium filtering
    sensor.enable(true);
    logInfo("MCP9600 %s: Configured for Type %s thermocouple", name, tcType.c_str());

    // Test read
    float testTemp = sensor.readThermocouple();
    float testAmbient = sensor.readAmbient();
    logInfo("MCP9600 %s: Test read - TC: %.1f C, Ambient: %.1f C", name, testTemp, testAmbient);

    logInfo("MCP9600 %s (0x%02X): initialized OK", name, addr);
    return true;
}

// Read MCP9600 registers for diagnostics
void diagnoseMCP9600(Adafruit_MCP9600 &sensor, uint8_t addr, const char* name, TwoWire &wirePort = Wire) {
    logInfo("=== MCP9600 %s (0x%02X) Diagnostics ===", name, addr);

    // Check I2C communication
    wirePort.beginTransmission(addr);
    uint8_t i2cError = wirePort.endTransmission();
    if (i2cError != 0) {
        logError("%s: I2C communication failed (error %d)", name, i2cError);
        return;
    }
    logDebug("%s: I2C communication OK", name);

    // Read Device ID register (0x20)
    wirePort.beginTransmission(addr);
    wirePort.write(0x20);  // Device ID register
    wirePort.endTransmission(false);
    wirePort.requestFrom(addr, (uint8_t)2);
    if (wirePort.available() >= 2) {
        uint8_t devIdHigh = wirePort.read();
        uint8_t devIdLow = wirePort.read();
        uint16_t devId = (devIdHigh << 8) | devIdLow;
        logInfo("%s: Device ID = 0x%04X (expected 0x40xx for MCP9600)", name, devId);
    } else {
        logError("%s: Failed to read Device ID register", name);
    }

    // Read Status register (0x04)
    wirePort.beginTransmission(addr);
    wirePort.write(0x04);  // Status register
    wirePort.endTransmission(false);
    wirePort.requestFrom(addr, (uint8_t)1);
    if (wirePort.available()) {
        uint8_t status = wirePort.read();
        logInfo("%s: Status register = 0x%02X", name, status);
        logDebug("%s:   Burst complete: %d", name, (status >> 7) & 1);
        logDebug("%s:   TH update: %d", name, (status >> 6) & 1);
        logDebug("%s:   Input range: %d", name, (status >> 4) & 1);
        logDebug("%s:   Alert 4-1: %d%d%d%d", name,
            (status >> 3) & 1, (status >> 2) & 1, (status >> 1) & 1, status & 1);
    }

    // Read Sensor Config register (0x05)
    wirePort.beginTransmission(addr);
    wirePort.write(0x05);  // Sensor Config register
    wirePort.endTransmission(false);
    wirePort.requestFrom(addr, (uint8_t)1);
    if (wirePort.available()) {
        uint8_t sensorCfg = wirePort.read();
        uint8_t tcType = (sensorCfg >> 4) & 0x07;
        uint8_t filterCoeff = sensorCfg & 0x07;
        const char* tcNames[] = {"K", "J", "T", "N", "S", "E", "B", "R"};
        logInfo("%s: Sensor Config = 0x%02X (Type %s, Filter %d)",
            name, sensorCfg, tcNames[tcType], filterCoeff);
    }

    // Read Device Config register (0x06)
    wirePort.beginTransmission(addr);
    wirePort.write(0x06);  // Device Config register
    wirePort.endTransmission(false);
    wirePort.requestFrom(addr, (uint8_t)1);
    if (wirePort.available()) {
        uint8_t devCfg = wirePort.read();
        uint8_t adcRes = (devCfg >> 5) & 0x03;
        uint8_t burstSamples = (devCfg >> 2) & 0x07;
        uint8_t shutdown = devCfg & 0x03;
        const char* resNames[] = {"18-bit", "16-bit", "14-bit", "12-bit"};
        logInfo("%s: Device Config = 0x%02X (ADC: %s, Shutdown: %d)",
            name, devCfg, resNames[adcRes], shutdown);
    }

    // Read raw ADC value register (0x03)
    wirePort.beginTransmission(addr);
    wirePort.write(0x03);  // Raw ADC Data register
    wirePort.endTransmission(false);
    wirePort.requestFrom(addr, (uint8_t)3);
    if (wirePort.available() >= 3) {
        int32_t rawAdc = 0;
        rawAdc = (int32_t)wirePort.read() << 16;
        rawAdc |= (int32_t)wirePort.read() << 8;
        rawAdc |= wirePort.read();
        // Sign extend if negative (18-bit two's complement)
        if (rawAdc & 0x020000) {
            rawAdc |= 0xFFFC0000;
        }
        float microvolts = rawAdc * 2.0;  // 2uV resolution for 18-bit
        logInfo("%s: Raw ADC = %ld (%.1f uV)", name, rawAdc, microvolts);
    }

    // Read hot junction temperature (0x00)
    float hotJunction = sensor.readThermocouple();
    logInfo("%s: Hot Junction (TC) = %.2f C", name, hotJunction);

    // Read cold junction temperature (0x02)
    float coldJunction = sensor.readAmbient();
    logInfo("%s: Cold Junction (Ambient) = %.2f C", name, coldJunction);

    // Read delta temperature (0x01)
    wirePort.beginTransmission(addr);
    wirePort.write(0x01);  // Delta Temp register
    wirePort.endTransmission(false);
    wirePort.requestFrom(addr, (uint8_t)2);
    if (wirePort.available() >= 2) {
        int16_t delta = (wirePort.read() << 8) | wirePort.read();
        float deltaTemp = delta * 0.0625;  // 0.0625 C resolution
        logInfo("%s: Delta Temp = %.2f C", name, deltaTemp);
    }

    logInfo("=== End %s Diagnostics ===", name);
}
#endif

void initSensors() {
#ifdef USE_MAX6675
    // MAX6675 needs a moment to stabilize after power-on
    delay(1000);

    // Do a few dummy reads to stabilize
    for (int i = 0; i < 3; i++) {
        thermoMainTank.readCelsius();
        delay(300);
        thermoTapChanger.readCelsius();
        delay(300);
    }
    mainTankSensorOK = true;
    tapChangerSensorOK = true;
    Serial.println("MAX6675 sensors initialized");
#endif

#ifdef USE_MCP9600
    logInfo("=== I2C Setup (SDA: GPIO%d, SCL: GPIO%d) ===", I2C_SDA, I2C_SCL);

    // Try multiple times with I2C bus recovery
    uint8_t foundAddresses[8];
    int foundCount = 0;

    for (int attempt = 0; attempt < 3 && foundCount == 0; attempt++) {
        logInfo("I2C scan attempt %d", attempt + 1);

        // Fully reset Wire peripheral
        Wire.end();
        delay(100);

        // Manual bus recovery
        pinMode(I2C_SDA, INPUT_PULLUP);
        pinMode(I2C_SCL, OUTPUT);
        digitalWrite(I2C_SCL, HIGH);
        delay(10);

        // Clock out up to 18 bits to release any stuck slave
        for (int i = 0; i < 18; i++) {
            digitalWrite(I2C_SCL, LOW);
            delayMicroseconds(50);
            digitalWrite(I2C_SCL, HIGH);
            delayMicroseconds(50);
        }

        // Generate STOP condition
        pinMode(I2C_SDA, OUTPUT);
        digitalWrite(I2C_SDA, LOW);
        delay(1);
        digitalWrite(I2C_SCL, HIGH);
        delay(1);
        digitalWrite(I2C_SDA, HIGH);
        delay(10);

        // Return pins to input mode with pull-ups
        pinMode(I2C_SDA, INPUT_PULLUP);
        pinMode(I2C_SCL, INPUT_PULLUP);
        delay(100);

        logDebug("Pin states - SDA: %d, SCL: %d", digitalRead(I2C_SDA), digitalRead(I2C_SCL));

        // Initialize Wire with slow clock (10kHz for weak internal pull-ups)
        Wire.begin(I2C_SDA, I2C_SCL);
        Wire.setTimeOut(50);
        Wire.setClock(10000);
        delay(200);

        // Scan MCP9600 address range (0x60-0x67)
        logInfo("Scanning for MCP9600 devices (0x60-0x67)...");
        foundCount = 0;
        for (byte addr = MCP9600_ADDR_MIN; addr <= MCP9600_ADDR_MAX; addr++) {
            Wire.beginTransmission(addr);
            if (Wire.endTransmission() == 0) {
                logInfo("  Found MCP9600 at 0x%02X", addr);
                if (foundCount < 8) {
                    foundAddresses[foundCount++] = addr;
                }
            }
        }
        logInfo("Scan complete. Found %d MCP9600 device(s)", foundCount);

        if (foundCount == 0) {
            logWarn("No devices found, will retry...");
            delay(500);
        }
    }

    // Auto-assign addresses to sensors in order found
    // Sensors are assigned in ascending address order
    logInfo("=== Auto-assigning sensors ===");

    if (foundCount >= 1) {
        sensor1Addr = foundAddresses[0];
        mainTankSensorOK = initMCP9600(mcp9600_sensor1, sensor1Addr, "Sensor 1 (Main Tank)", sensor1ThermocoupleType);
    }
    if (foundCount >= 2) {
        sensor2Addr = foundAddresses[1];
        tapChangerSensorOK = initMCP9600(mcp9600_sensor2, sensor2Addr, "Sensor 2 (Tap Changer)", sensor2ThermocoupleType);
    }
    if (foundCount >= 3) {
        sensor3Addr = foundAddresses[2];
        sensor3SensorOK = initMCP9600(mcp9600_sensor3, sensor3Addr, "Sensor 3", sensor3ThermocoupleType);
    }
    if (foundCount >= 4) {
        sensor4Addr = foundAddresses[3];
        sensor4SensorOK = initMCP9600(mcp9600_sensor4, sensor4Addr, "Sensor 4", sensor4ThermocoupleType);
    }

    logInfo("=== Sensor Status ===");
    logInfo("Sensor 1 (Main Tank) @ 0x%02X: %s", sensor1Addr, mainTankSensorOK ? "OK" : "NOT FOUND");
    logInfo("Sensor 2 (Tap Changer) @ 0x%02X: %s", sensor2Addr, tapChangerSensorOK ? "OK" : "NOT FOUND");
    logInfo("Sensor 3 @ 0x%02X: %s", sensor3Addr, sensor3SensorOK ? "OK" : "NOT FOUND");
    logInfo("Sensor 4 @ 0x%02X: %s", sensor4Addr, sensor4SensorOK ? "OK" : "NOT FOUND");

    // Run diagnostics on found sensors
    if (mainTankSensorOK) diagnoseMCP9600(mcp9600_sensor1, sensor1Addr, "Sensor 1");
    if (tapChangerSensorOK) diagnoseMCP9600(mcp9600_sensor2, sensor2Addr, "Sensor 2");
    if (sensor3SensorOK) diagnoseMCP9600(mcp9600_sensor3, sensor3Addr, "Sensor 3");
    if (sensor4SensorOK) diagnoseMCP9600(mcp9600_sensor4, sensor4Addr, "Sensor 4");
#endif
}

void readSensors() {
#ifdef USE_MAX6675
    // Read Main Tank temperature
    float reading = thermoMainTank.readCelsius();
    if (isnan(reading)) {
        mainTankSensorOK = false;
        mainTankTemp = -999.0;
        mainTankStatus = "ERR";
    } else {
        mainTankSensorOK = true;
        mainTankTemp = reading;

        if (mainTankTemp >= mainTankAlarm) {
            mainTankStatus = "ALRM";
        } else if (mainTankTemp >= mainTankWarning) {
            mainTankStatus = "WARN";
        } else {
            mainTankStatus = "OK";
        }
    }

    // Small delay between readings (MAX6675 needs ~250ms between reads)
    delay(300);

    // Read Tap Changer temperature
    reading = thermoTapChanger.readCelsius();
    if (isnan(reading)) {
        tapChangerSensorOK = false;
        tapChangerTemp = -999.0;
        tapChangerStatus = "ERR";
    } else {
        tapChangerSensorOK = true;
        tapChangerTemp = reading;

        if (tapChangerTemp >= tapChangerAlarm) {
            tapChangerStatus = "ALRM";
        } else if (tapChangerTemp >= tapChangerWarning) {
            tapChangerStatus = "WARN";
        } else {
            tapChangerStatus = "OK";
        }
    }

    // MAX6675 handles cold junction internally - no readout available
    ambientTemp = 25.0;
#endif

#ifdef USE_MCP9600
    Serial.println("\n--- Reading MCP9600 Sensors ---");

    // Read Sensor 1 (Main Tank) temperature
    if (mainTankSensorOK) {
        mainTankTemp = mcp9600_sensor1.readThermocouple();
        ambientTemp = mcp9600_sensor1.readAmbient();  // Cold junction temperature!
        Serial.printf("Sensor 1 (Main Tank): %.1f C (Ambient: %.1f C)\n", mainTankTemp, ambientTemp);

        if (mainTankTemp >= mainTankAlarm) {
            mainTankStatus = "ALRM";
        } else if (mainTankTemp >= mainTankWarning) {
            mainTankStatus = "WARN";
        } else {
            mainTankStatus = "OK";
        }
    } else {
        mainTankTemp = -999.0;
        mainTankStatus = "ERR";
        Serial.println("Sensor 1 (Main Tank): SENSOR ERROR");
    }

    // Read Sensor 2 (Tap Changer) temperature (if enabled and present)
    if (sensor2Enabled && tapChangerSensorOK) {
        tapChangerTemp = mcp9600_sensor2.readThermocouple();
        Serial.printf("Sensor 2 (Tap Changer): %.1f C\n", tapChangerTemp);

        if (tapChangerTemp >= tapChangerAlarm) {
            tapChangerStatus = "ALRM";
        } else if (tapChangerTemp >= tapChangerWarning) {
            tapChangerStatus = "WARN";
        } else {
            tapChangerStatus = "OK";
        }
    } else if (sensor2Enabled) {
        tapChangerTemp = -999.0;
        tapChangerStatus = "ERR";
        Serial.println("Sensor 2 (Tap Changer): SENSOR ERROR");
    } else {
        tapChangerTemp = 0.0;
        tapChangerStatus = "---";
    }

    // Read Sensor 3 temperature (if enabled and present)
    if (sensor3Enabled && sensor3SensorOK) {
        sensor3Temp = mcp9600_sensor3.readThermocouple();
        Serial.printf("Sensor 3: %.1f C\n", sensor3Temp);

        if (sensor3Temp >= sensor3Alarm) {
            sensor3Status = "ALRM";
        } else if (sensor3Temp >= sensor3Warning) {
            sensor3Status = "WARN";
        } else {
            sensor3Status = "OK";
        }
    } else if (sensor3Enabled) {
        sensor3Temp = -999.0;
        sensor3Status = "ERR";
        Serial.println("Sensor 3: SENSOR ERROR");
    } else {
        sensor3Temp = 0.0;
        sensor3Status = "---";
    }

    // Read Sensor 4 temperature (if enabled and present)
    if (sensor4Enabled && sensor4SensorOK) {
        sensor4Temp = mcp9600_sensor4.readThermocouple();
        Serial.printf("Sensor 4: %.1f C\n", sensor4Temp);

        if (sensor4Temp >= sensor4Alarm) {
            sensor4Status = "ALRM";
        } else if (sensor4Temp >= sensor4Warning) {
            sensor4Status = "WARN";
        } else {
            sensor4Status = "OK";
        }
    } else if (sensor4Enabled) {
        sensor4Temp = -999.0;
        sensor4Status = "ERR";
        Serial.println("Sensor 4: SENSOR ERROR");
    } else {
        sensor4Temp = 0.0;
        sensor4Status = "---";
    }

    Serial.printf("Status - S1: %s, S2: %s, S3: %s, S4: %s\n",
        mainTankStatus.c_str(), tapChangerStatus.c_str(),
        sensor3Status.c_str(), sensor4Status.c_str());
#endif
}

// ============================================================================
// Supabase Data Upload
// ============================================================================

void uploadToSupabase() {
    if (!wifiConnected || supabaseUrl.length() == 0 || supabaseKey.length() == 0) {
        Serial.println("Skipping upload - not configured");
        return;
    }

    // Don't upload if no sensors are working
    if (!mainTankSensorOK && !tapChangerSensorOK && !sensor3SensorOK && !sensor4SensorOK) {
        Serial.println("Skipping upload - no valid sensor data");
        return;
    }

    HTTPClient http;
    String url = supabaseUrl + "/rest/v1/temperature_readings";

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", supabaseKey);
    http.addHeader("Authorization", "Bearer " + supabaseKey);
    http.addHeader("Prefer", "return=minimal");

    // Convert status for database
    String mtStatus = (mainTankStatus == "ALRM") ? "alarm" :
                      (mainTankStatus == "WARN") ? "warning" :
                      (mainTankStatus == "ERR") ? "error" : "normal";
    String tcStatus = (tapChangerStatus == "ALRM") ? "alarm" :
                      (tapChangerStatus == "WARN") ? "warning" :
                      (tapChangerStatus == "ERR") ? "error" : "normal";
    String s3Status = (sensor3Status == "ALRM") ? "alarm" :
                      (sensor3Status == "WARN") ? "warning" :
                      (sensor3Status == "ERR") ? "error" : "normal";
    String s4Status = (sensor4Status == "ALRM") ? "alarm" :
                      (sensor4Status == "WARN") ? "warning" :
                      (sensor4Status == "ERR") ? "error" : "normal";

    // Build JSON payload
    String json = "{";
    json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
    json += "\"main_tank_temp\":" + String(mainTankSensorOK ? mainTankTemp : 0, 1) + ",";
    json += "\"main_tank_status\":\"" + mtStatus + "\",";

    // Include sensor 2 if enabled
    if (sensor2Enabled) {
        json += "\"tap_changer_temp\":" + String(tapChangerSensorOK ? tapChangerTemp : 0, 1) + ",";
        json += "\"tap_changer_status\":\"" + tcStatus + "\",";
    }

    // Include sensor 3 if enabled
    if (sensor3Enabled) {
        json += "\"sensor_3_temp\":" + String(sensor3SensorOK ? sensor3Temp : 0, 1) + ",";
        json += "\"sensor_3_status\":\"" + s3Status + "\",";
    }

    // Include sensor 4 if enabled
    if (sensor4Enabled) {
        json += "\"sensor_4_temp\":" + String(sensor4SensorOK ? sensor4Temp : 0, 1) + ",";
        json += "\"sensor_4_status\":\"" + s4Status + "\",";
    }

    json += "\"ambient_temp\":" + String(ambientTemp, 1);
    json += "}";

    Serial.println("Uploading to Supabase...");
    int httpCode = http.POST(json);

    if (httpCode == 201 || httpCode == 200) {
        Serial.println("Upload successful!");
    } else {
        Serial.printf("Upload failed! HTTP code: %d\n", httpCode);
        Serial.println(http.getString());
    }

    http.end();
}

void updateDeviceStatus() {
    if (!wifiConnected || supabaseUrl.length() == 0 || supabaseKey.length() == 0) {
        return;
    }

    HTTPClient http;
    // Use PATCH to update existing device record
    String url = supabaseUrl + "/rest/v1/devices?device_id=eq." + String(DEVICE_ID);

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", supabaseKey);
    http.addHeader("Authorization", "Bearer " + supabaseKey);
    http.addHeader("Prefer", "return=minimal");

    // Build JSON payload with device info
    // Note: last_seen should be handled by database trigger or use current timestamp
    String json = "{";
    json += "\"firmware_version\":\"" + String(FIRMWARE_VERSION) + "\",";
    json += "\"ip_address\":\"" + WiFi.localIP().toString() + "\",";
    json += "\"mac_address\":\"" + WiFi.macAddress() + "\",";
    json += "\"is_online\":true";
    json += "}";

    int httpCode = http.PATCH(json);

    if (httpCode == 200 || httpCode == 204) {
        Serial.println("Device status updated");
    } else {
        Serial.printf("Device status update failed: %d\n", httpCode);
    }

    http.end();
}

// Helper function to extract a numeric value from JSON
float extractJsonFloat(const String& json, const char* key, float defaultVal) {
    String searchKey = "\"" + String(key) + "\":";
    int start = json.indexOf(searchKey);
    if (start < 0) return defaultVal;

    start += searchKey.length();
    int end = json.indexOf(",", start);
    if (end < 0) end = json.indexOf("}", start);
    if (end <= start) return defaultVal;

    return json.substring(start, end).toFloat();
}

// Helper function to extract a boolean value from JSON
bool extractJsonBool(const String& json, const char* key, bool defaultVal) {
    String searchKey = "\"" + String(key) + "\":";
    int start = json.indexOf(searchKey);
    if (start < 0) return defaultVal;

    start += searchKey.length();
    return json.substring(start, start + 4) == "true";
}

// Helper function to extract an integer value from JSON
int extractJsonInt(const String& json, const char* key, int defaultVal) {
    String searchKey = "\"" + String(key) + "\":";
    int start = json.indexOf(searchKey);
    if (start < 0) return defaultVal;

    start += searchKey.length();
    int end = json.indexOf(",", start);
    if (end < 0) end = json.indexOf("}", start);
    if (end <= start) return defaultVal;

    return json.substring(start, end).toInt();
}

// Helper function to extract a string value from JSON
String extractJsonString(const String& json, const char* key, const String& defaultVal) {
    String searchKey = "\"" + String(key) + "\":\"";
    int start = json.indexOf(searchKey);
    if (start < 0) return defaultVal;

    start += searchKey.length();
    int end = json.indexOf("\"", start);
    if (end <= start) return defaultVal;

    return json.substring(start, end);
}

void fetchConfigFromSupabase() {
    if (!wifiConnected || supabaseUrl.length() == 0 || supabaseKey.length() == 0) {
        return;
    }

    HTTPClient http;
    String url = supabaseUrl + "/rest/v1/device_config?device_id=eq." + String(DEVICE_ID) +
        "&select=report_interval,sensors_enabled,sensor_2_enabled,sensor_3_enabled,sensor_4_enabled," +
        "main_tank_warning,main_tank_alarm,tap_changer_warning,tap_changer_alarm," +
        "sensor_3_warning,sensor_3_alarm,sensor_4_warning,sensor_4_alarm," +
        "sensor_1_thermocouple_type,sensor_2_thermocouple_type,sensor_3_thermocouple_type,sensor_4_thermocouple_type";

    http.begin(url);
    http.addHeader("apikey", supabaseKey);
    http.addHeader("Authorization", "Bearer " + supabaseKey);

    int httpCode = http.GET();

    if (httpCode == 200) {
        String payload = http.getString();
        Serial.println("Config fetched from Supabase");

        // Extract report_interval
        int newInterval = extractJsonInt(payload, "report_interval", 30);
        if (newInterval >= 10 && newInterval <= 3600) {
            uploadInterval = newInterval * 1000UL;  // Convert to milliseconds
            Serial.printf("Upload interval set to %d seconds\n", newInterval);
        }

        // Extract sensor enable flags
        sensorsEnabled = extractJsonInt(payload, "sensors_enabled", 2);
        sensor2Enabled = extractJsonBool(payload, "sensor_2_enabled", true);
        sensor3Enabled = extractJsonBool(payload, "sensor_3_enabled", false);
        sensor4Enabled = extractJsonBool(payload, "sensor_4_enabled", false);

        // Extract thresholds
        mainTankWarning = extractJsonFloat(payload, "main_tank_warning", 85.0);
        mainTankAlarm = extractJsonFloat(payload, "main_tank_alarm", 95.0);
        tapChangerWarning = extractJsonFloat(payload, "tap_changer_warning", 70.0);
        tapChangerAlarm = extractJsonFloat(payload, "tap_changer_alarm", 85.0);
        sensor3Warning = extractJsonFloat(payload, "sensor_3_warning", 70.0);
        sensor3Alarm = extractJsonFloat(payload, "sensor_3_alarm", 85.0);
        sensor4Warning = extractJsonFloat(payload, "sensor_4_warning", 70.0);
        sensor4Alarm = extractJsonFloat(payload, "sensor_4_alarm", 85.0);

        // Extract thermocouple types
        sensor1ThermocoupleType = extractJsonString(payload, "sensor_1_thermocouple_type", "K");
        sensor2ThermocoupleType = extractJsonString(payload, "sensor_2_thermocouple_type", "K");
        sensor3ThermocoupleType = extractJsonString(payload, "sensor_3_thermocouple_type", "K");
        sensor4ThermocoupleType = extractJsonString(payload, "sensor_4_thermocouple_type", "K");

        Serial.printf("Sensors enabled: %d (S2: %s, S3: %s, S4: %s)\n",
            sensorsEnabled, sensor2Enabled ? "yes" : "no", sensor3Enabled ? "yes" : "no", sensor4Enabled ? "yes" : "no");
        Serial.printf("Thresholds - S1: %.1f/%.1f, S2: %.1f/%.1f, S3: %.1f/%.1f, S4: %.1f/%.1f\n",
            mainTankWarning, mainTankAlarm, tapChangerWarning, tapChangerAlarm,
            sensor3Warning, sensor3Alarm, sensor4Warning, sensor4Alarm);
        Serial.printf("Thermocouple types - S1: %s, S2: %s, S3: %s, S4: %s\n",
            sensor1ThermocoupleType.c_str(), sensor2ThermocoupleType.c_str(),
            sensor3ThermocoupleType.c_str(), sensor4ThermocoupleType.c_str());

        // Apply thermocouple types to sensors (they were initialized with defaults)
        if (mainTankSensorOK) {
            mcp9600_sensor1.setThermocoupleType(getThermocoupleTypeEnum(sensor1ThermocoupleType));
            Serial.printf("Sensor 1 set to Type %s\n", sensor1ThermocoupleType.c_str());
        }
        if (tapChangerSensorOK) {
            mcp9600_sensor2.setThermocoupleType(getThermocoupleTypeEnum(sensor2ThermocoupleType));
            Serial.printf("Sensor 2 set to Type %s\n", sensor2ThermocoupleType.c_str());
        }
        if (sensor3SensorOK) {
            mcp9600_sensor3.setThermocoupleType(getThermocoupleTypeEnum(sensor3ThermocoupleType));
            Serial.printf("Sensor 3 set to Type %s\n", sensor3ThermocoupleType.c_str());
        }
        if (sensor4SensorOK) {
            mcp9600_sensor4.setThermocoupleType(getThermocoupleTypeEnum(sensor4ThermocoupleType));
            Serial.printf("Sensor 4 set to Type %s\n", sensor4ThermocoupleType.c_str());
        }
    } else {
        Serial.printf("Config fetch failed: %d\n", httpCode);
    }

    http.end();
}

// ============================================================================
// WiFi & Web Server
// ============================================================================

void loadConfig() {
    preferences.begin("tr03config", true);
    wifiSSID = preferences.getString("wifi_ssid", "");
    wifiPassword = preferences.getString("wifi_pass", "");
    supabaseUrl = preferences.getString("supa_url", "");
    supabaseKey = preferences.getString("supa_key", "");
    mainTankWarning = preferences.getFloat("mt_warn", 85.0);
    mainTankAlarm = preferences.getFloat("mt_alarm", 95.0);
    tapChangerWarning = preferences.getFloat("tc_warn", 70.0);
    tapChangerAlarm = preferences.getFloat("tc_alarm", 85.0);
    preferences.end();
}

void saveConfig() {
    preferences.begin("tr03config", false);
    preferences.putString("wifi_ssid", wifiSSID);
    preferences.putString("wifi_pass", wifiPassword);
    preferences.putString("supa_url", supabaseUrl);
    preferences.putString("supa_key", supabaseKey);
    preferences.putFloat("mt_warn", mainTankWarning);
    preferences.putFloat("mt_alarm", mainTankAlarm);
    preferences.putFloat("tc_warn", tapChangerWarning);
    preferences.putFloat("tc_alarm", tapChangerAlarm);
    preferences.end();
}

void handleRoot() {
    String html = "<!DOCTYPE html><html><head>";
    html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
    html += "<style>";
    html += "body { font-family: Arial; background: #1a1a2e; color: #fff; padding: 20px; }";
    html += ".card { background: rgba(255,255,255,0.1); border-radius: 10px; padding: 20px; max-width: 500px; margin: 0 auto; }";
    html += "h1, h3 { text-align: center; margin-top: 0; }";
    html += "h3 { color: #4fc3f7; margin-top: 20px; }";
    html += "label { display: block; margin-top: 10px; color: #aaa; font-size: 12px; }";
    html += "input { width: 100%; padding: 10px; margin: 5px 0 10px 0; border-radius: 5px; border: 1px solid #444; background: #333; color: #fff; box-sizing: border-box; }";
    html += ".row { display: flex; gap: 10px; }";
    html += ".row > div { flex: 1; }";
    html += "button { width: 100%; padding: 12px; background: #4fc3f7; border: none; border-radius: 5px; color: #000; font-weight: bold; cursor: pointer; margin-top: 20px; }";
    html += "</style></head><body>";
    html += "<div class='card'>";
    html += "<h1>Temperature Monitor Setup</h1>";
    html += "<form action='/save' method='POST'>";

    // WiFi Settings
    html += "<h3>WiFi Settings</h3>";
    html += "<label>WiFi SSID</label>";
    html += "<input type='text' name='ssid' value='" + wifiSSID + "'>";
    html += "<label>WiFi Password</label>";
    html += "<input type='password' name='pass' placeholder='Enter new password'>";

    // Supabase Settings
    html += "<h3>Cloud Settings</h3>";
    html += "<label>Supabase URL</label>";
    html += "<input type='text' name='supa_url' value='" + supabaseUrl + "'>";
    html += "<label>Supabase Key</label>";
    html += "<input type='text' name='supa_key' value='" + supabaseKey + "'>";

    // Alarm Thresholds
    html += "<h3>Main Tank Thresholds</h3>";
    html += "<div class='row'>";
    html += "<div><label>Warning (°C)</label><input type='number' name='mt_warn' step='0.1' value='" + String(mainTankWarning, 1) + "'></div>";
    html += "<div><label>Alarm (°C)</label><input type='number' name='mt_alarm' step='0.1' value='" + String(mainTankAlarm, 1) + "'></div>";
    html += "</div>";

    html += "<h3>Tap Changer Thresholds</h3>";
    html += "<div class='row'>";
    html += "<div><label>Warning (°C)</label><input type='number' name='tc_warn' step='0.1' value='" + String(tapChangerWarning, 1) + "'></div>";
    html += "<div><label>Alarm (°C)</label><input type='number' name='tc_alarm' step='0.1' value='" + String(tapChangerAlarm, 1) + "'></div>";
    html += "</div>";

    html += "<button type='submit'>Save & Restart</button>";
    html += "</form></div></body></html>";

    webServer.send(200, "text/html", html);
}

void handleSave() {
    if (webServer.hasArg("ssid")) wifiSSID = webServer.arg("ssid");
    if (webServer.hasArg("pass") && webServer.arg("pass").length() > 0) {
        wifiPassword = webServer.arg("pass");
    }
    if (webServer.hasArg("supa_url")) supabaseUrl = webServer.arg("supa_url");
    if (webServer.hasArg("supa_key")) supabaseKey = webServer.arg("supa_key");

    // Alarm thresholds
    if (webServer.hasArg("mt_warn")) mainTankWarning = webServer.arg("mt_warn").toFloat();
    if (webServer.hasArg("mt_alarm")) mainTankAlarm = webServer.arg("mt_alarm").toFloat();
    if (webServer.hasArg("tc_warn")) tapChangerWarning = webServer.arg("tc_warn").toFloat();
    if (webServer.hasArg("tc_alarm")) tapChangerAlarm = webServer.arg("tc_alarm").toFloat();

    saveConfig();

    webServer.send(200, "text/html", "<html><body style='background:#1a1a2e;color:#fff;text-align:center;padding:50px;'><h1>Saved!</h1><p>Restarting...</p></body></html>");
    delay(1000);
    ESP.restart();
}

void startAP() {
    WiFi.mode(WIFI_AP);
    WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASSWORD);

    webServer.on("/", handleRoot);
    webServer.on("/save", HTTP_POST, handleSave);
    webServer.begin();

    apMode = true;
    displayAPMode(WIFI_AP_SSID, WiFi.softAPIP().toString().c_str());

    Serial.printf("AP Mode: %s\n", WIFI_AP_SSID);
    Serial.printf("IP: %s\n", WiFi.softAPIP().toString().c_str());
}

bool connectWiFi() {
    if (wifiSSID.length() == 0) return false;

    Serial.printf("Connecting to %s...\n", wifiSSID.c_str());
    WiFi.mode(WIFI_STA);
    WiFi.begin(wifiSSID.c_str(), wifiPassword.c_str());

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("Connected! IP: %s\n", WiFi.localIP().toString().c_str());
        wifiConnected = true;
        return true;
    }

    Serial.println("Connection failed");
    return false;
}

// Handle config refresh request from dashboard
void handleRefreshConfig() {
    logInfo("Config refresh requested via HTTP");
    fetchConfigFromSupabase();
    webServer.sendHeader("Access-Control-Allow-Origin", "*");
    webServer.send(200, "application/json", "{\"status\":\"ok\"}");
}

// Handle diagnostics request
void handleDiagnostics() {
    logInfo("Diagnostics requested via HTTP");
    webServer.sendHeader("Access-Control-Allow-Origin", "*");
    webServer.send(200, "application/json", "{\"status\":\"running\"}");

#ifdef USE_MCP9600
    // Scan I2C bus
    logInfo("=== I2C Bus Scan (SDA: GPIO%d, SCL: GPIO%d) ===", I2C_SDA, I2C_SCL);
    int deviceCount = 0;
    for (byte addr = 1; addr < 127; addr++) {
        Wire.beginTransmission(addr);
        uint8_t error = Wire.endTransmission();
        if (error == 0) {
            logInfo("Device found at 0x%02X", addr);
            deviceCount++;
        }
    }
    logInfo("Total devices found: %d", deviceCount);

    // Run diagnostics on auto-detected sensors
    logInfo("=== Sensor Diagnostics ===");
    if (sensor1Addr != 0) {
        diagnoseMCP9600(mcp9600_sensor1, sensor1Addr, "Sensor 1 (Main Tank)");
    } else {
        logWarn("Sensor 1 not detected");
    }
    if (sensor2Addr != 0) {
        diagnoseMCP9600(mcp9600_sensor2, sensor2Addr, "Sensor 2 (Tap Changer)");
    } else {
        logWarn("Sensor 2 not detected");
    }
    if (sensor3Addr != 0) {
        diagnoseMCP9600(mcp9600_sensor3, sensor3Addr, "Sensor 3");
    } else {
        logInfo("Sensor 3 not detected");
    }
    if (sensor4Addr != 0) {
        diagnoseMCP9600(mcp9600_sensor4, sensor4Addr, "Sensor 4");
    } else {
        logInfo("Sensor 4 not detected");
    }
#endif

    // Upload logs immediately after diagnostics
    uploadLogs();
}

// Handle CORS preflight
void handleCORS() {
    webServer.sendHeader("Access-Control-Allow-Origin", "*");
    webServer.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    webServer.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    webServer.send(204);
}

void startWebServer() {
    webServer.on("/refresh", HTTP_GET, handleRefreshConfig);
    webServer.on("/refresh", HTTP_OPTIONS, handleCORS);
    webServer.on("/diagnostics", HTTP_GET, handleDiagnostics);
    webServer.on("/diagnostics", HTTP_OPTIONS, handleCORS);
    webServer.begin();
    logInfo("Web server started on port 80");
}

// ============================================================================
// Setup & Loop
// ============================================================================

void setup() {
    Serial.begin(115200);
    delay(500);

    logInfo("=== Temperature Monitor ===");
    logInfo("Firmware: %s", FIRMWARE_VERSION);

    // Initialize display FIRST (like StationBoards)
    u8g2.begin();
    u8g2.setFont(u8g2_font_helvB08_tr);
    displayBoot(10, "Starting...");

    // Load config
    displayBoot(30, "Loading config...");
    loadConfig();

    // Initialize sensors
    displayBoot(40, "Init sensors...");
    initSensors();

    // Try WiFi connection
    displayBoot(50, "Connecting WiFi...");
    if (!connectWiFi()) {
        displayBoot(70, "Starting AP...");
        startAP();
    } else {
        displayBoot(80, "Registering...");
        updateDeviceStatus();  // Update device info in Supabase
        displayBoot(85, "Fetching config...");
        fetchConfigFromSupabase();  // Get config from Supabase
        displayBoot(95, "Starting server...");
        startWebServer();  // Start web server for config refresh endpoint
        displayBoot(100, "Ready!");
        delay(500);
    }

    Serial.println("Setup complete");
}

void loop() {
    unsigned long now = millis();

    // Handle web server (both AP mode and station mode)
    webServer.handleClient();

    // In AP mode, only handle web server
    if (apMode) {
        return;
    }

    // Read sensors every 5 seconds
    if (now - lastSensorRead >= 5000) {
        readSensors();
        lastSensorRead = now;

        Serial.printf("Main: %.1f°C (%s), Tap: %.1f°C (%s)\n",
            mainTankTemp, mainTankStatus.c_str(),
            tapChangerTemp, tapChangerStatus.c_str());
    }

    // Upload to Supabase periodically
    if (now - lastDataUpload >= uploadInterval) {
        uploadToSupabase();
        updateDeviceStatus();  // Update last_seen timestamp
        lastDataUpload = now;
    }

    // Fetch config from Supabase periodically
    if (now - lastConfigFetch >= CONFIG_FETCH_INTERVAL) {
        fetchConfigFromSupabase();
        lastConfigFetch = now;
    }

    // Upload logs periodically
    if (now - lastLogUpload >= LOG_UPLOAD_INTERVAL) {
        uploadLogs();
        lastLogUpload = now;
    }

    // Update display every second
    if (now - lastDisplayUpdate >= 1000) {
        displayTemperatures();
        lastDisplayUpdate = now;
    }

    delay(10);
}
