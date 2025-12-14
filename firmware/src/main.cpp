/**
 * 01TR03 Transformer Temperature Monitoring System
 *
 * 66/11kV 50MVA Power Transformer Monitor
 * NodeMCU-32S with Thermocouple Amplifiers and SSD1322 OLED
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
#define DEVICE_ID           "01TR03"
#define FIRMWARE_VERSION    "1.2.0"
#define WIFI_AP_SSID        "01TR03-Setup"
#define WIFI_AP_PASSWORD    "transformer"

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
  // MCP9600 I2C pins and addresses
  // Try GPIO 25/26 if 21/22 don't work
  #define I2C_SDA       21
  #define I2C_SCL       22
  #define MCP9600_ADDR_1  0x67  // Main Tank (ADDR pin to VCC)
  #define MCP9600_ADDR_2  0x60  // Tap Changer (ADDR pin to GND) - if present
#endif

// Temperature thresholds (defaults, configurable via web interface)
float mainTankWarning = 85.0;
float mainTankAlarm = 95.0;
float tapChangerWarning = 70.0;
float tapChangerAlarm = 85.0;

// Display - exact same as StationBoards
U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2(U8G2_R0, OLED_CS, OLED_DC, OLED_RST);

// Sensor objects
#ifdef USE_MAX6675
  MAX6675 thermoMainTank(THERMO_CLK, THERMO_CS1, THERMO_MISO);
  MAX6675 thermoTapChanger(THERMO_CLK, THERMO_CS2, THERMO_MISO);
#endif

#ifdef USE_MCP9600
  Adafruit_MCP9600 mcp9600_mainTank;
  Adafruit_MCP9600 mcp9600_tapChanger;
#endif

bool mainTankSensorOK = false;
bool tapChangerSensorOK = false;

// Web server
WebServer webServer(80);
Preferences preferences;

// State
bool wifiConnected = false;
bool apMode = false;
float mainTankTemp = 0.0;
float tapChangerTemp = 0.0;
float ambientTemp = 0.0;
String mainTankStatus = "---";
String tapChangerStatus = "---";
unsigned long lastSensorRead = 0;
unsigned long lastDisplayUpdate = 0;
unsigned long lastDataUpload = 0;
const unsigned long UPLOAD_INTERVAL = 30000;  // Upload every 30 seconds

// Configuration
String wifiSSID = "";
String wifiPassword = "";
String supabaseUrl = "";
String supabaseKey = "";

// ============================================================================
// Display Functions
// ============================================================================

void displayBoot(int progress, const char* message) {
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_helvB12_tr);

    // Title
    const char* title = "01TR03 SETUP";
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
    const char* title = "01TR03 TRANSFORMER";
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
bool initMCP9600(Adafruit_MCP9600 &sensor, uint8_t addr, const char* name) {
    Serial.printf("\n--- Initializing MCP9600 %s at 0x%02X ---\n", name, addr);

    // Check if device responds on I2C
    Wire.beginTransmission(addr);
    uint8_t error = Wire.endTransmission();
    if (error != 0) {
        Serial.printf("I2C error %d - no device at 0x%02X\n", error, addr);
        return false;
    }
    Serial.printf("I2C device found at 0x%02X\n", addr);

    if (!sensor.begin(addr)) {
        Serial.printf("MCP9600 %s (0x%02X) begin() failed!\n", name, addr);
        return false;
    }
    Serial.printf("MCP9600 begin() OK\n");

    // Configure for Type J thermocouple
    sensor.setADCresolution(MCP9600_ADCRESOLUTION_18);
    sensor.setThermocoupleType(MCP9600_TYPE_J);
    sensor.setFilterCoefficient(3);  // Medium filtering
    sensor.enable(true);

    // Test read
    float testTemp = sensor.readThermocouple();
    float testAmbient = sensor.readAmbient();
    Serial.printf("Test read - Thermocouple: %.1f C, Ambient: %.1f C\n", testTemp, testAmbient);

    Serial.printf("MCP9600 %s (0x%02X) initialized OK\n", name, addr);
    return true;
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
    Serial.printf("\n=== I2C Setup ===\n");
    Serial.printf("SDA: GPIO%d, SCL: GPIO%d\n", I2C_SDA, I2C_SCL);

    int deviceCount = 0;

    // Try multiple times with increasingly aggressive recovery
    for (int attempt = 0; attempt < 3 && deviceCount == 0; attempt++) {
        Serial.printf("\n--- Attempt %d ---\n", attempt + 1);

        // Fully reset Wire peripheral
        Wire.end();
        delay(100);

        // Manual bus recovery
        pinMode(I2C_SDA, INPUT_PULLUP);
        pinMode(I2C_SCL, OUTPUT);
        digitalWrite(I2C_SCL, HIGH);
        delay(10);

        // Clock out up to 18 bits (2 bytes) to release any stuck slave
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

        Serial.printf("Pin states - SDA: %d, SCL: %d\n", digitalRead(I2C_SDA), digitalRead(I2C_SCL));

        // Initialize Wire with slow clock (MCP9600 can be sensitive)
        Wire.begin(I2C_SDA, I2C_SCL);
        Wire.setClock(50000);  // 50kHz - slower for reliability
        delay(100);

        // Scan I2C bus
        Serial.println("Scanning I2C bus...");
        for (byte addr = 1; addr < 127; addr++) {
            Wire.beginTransmission(addr);
            if (Wire.endTransmission() == 0) {
                Serial.printf("  Found device at 0x%02X\n", addr);
                deviceCount++;
            }
        }
        Serial.printf("Scan complete. Found %d device(s)\n", deviceCount);

        if (deviceCount == 0) {
            Serial.println("No devices found, will retry...");
            delay(500);
        }
    }

    Serial.printf("\n=== Final: Found %d device(s) ===\n\n", deviceCount);
    delay(100);

    mainTankSensorOK = initMCP9600(mcp9600_mainTank, MCP9600_ADDR_1, "Main Tank");
    tapChangerSensorOK = initMCP9600(mcp9600_tapChanger, MCP9600_ADDR_2, "Tap Changer");

    Serial.printf("\n=== Sensor Status ===\n");
    Serial.printf("Main Tank: %s\n", mainTankSensorOK ? "OK" : "FAILED");
    Serial.printf("Tap Changer: %s\n", tapChangerSensorOK ? "OK" : "FAILED");
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

    // Read Main Tank temperature
    if (mainTankSensorOK) {
        mainTankTemp = mcp9600_mainTank.readThermocouple();
        ambientTemp = mcp9600_mainTank.readAmbient();  // Cold junction temperature!
        Serial.printf("Main Tank: %.1f C (Ambient: %.1f C)\n", mainTankTemp, ambientTemp);

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
        Serial.println("Main Tank: SENSOR ERROR");
    }

    // Read Tap Changer temperature
    if (tapChangerSensorOK) {
        tapChangerTemp = mcp9600_tapChanger.readThermocouple();
        Serial.printf("Tap Changer: %.1f C\n", tapChangerTemp);

        if (tapChangerTemp >= tapChangerAlarm) {
            tapChangerStatus = "ALRM";
        } else if (tapChangerTemp >= tapChangerWarning) {
            tapChangerStatus = "WARN";
        } else {
            tapChangerStatus = "OK";
        }
    } else {
        tapChangerTemp = -999.0;
        tapChangerStatus = "ERR";
        Serial.println("Tap Changer: SENSOR ERROR");
    }

    Serial.printf("Status - Main: %s, Tap: %s\n", mainTankStatus.c_str(), tapChangerStatus.c_str());
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

    // Don't upload error readings
    if (!mainTankSensorOK && !tapChangerSensorOK) {
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

    // Build JSON payload
    String json = "{";
    json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
    json += "\"main_tank_temp\":" + String(mainTankSensorOK ? mainTankTemp : 0, 1) + ",";
    json += "\"tap_changer_temp\":" + String(tapChangerSensorOK ? tapChangerTemp : 0, 1) + ",";
    json += "\"ambient_temp\":" + String(ambientTemp, 1) + ",";

    // Convert status for database
    String mtStatus = (mainTankStatus == "ALRM") ? "alarm" :
                      (mainTankStatus == "WARN") ? "warning" :
                      (mainTankStatus == "ERR") ? "error" : "normal";
    String tcStatus = (tapChangerStatus == "ALRM") ? "alarm" :
                      (tapChangerStatus == "WARN") ? "warning" :
                      (tapChangerStatus == "ERR") ? "error" : "normal";

    json += "\"main_tank_status\":\"" + mtStatus + "\",";
    json += "\"tap_changer_status\":\"" + tcStatus + "\"";
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
    String json = "{";
    json += "\"firmware_version\":\"" + String(FIRMWARE_VERSION) + "\",";
    json += "\"ip_address\":\"" + WiFi.localIP().toString() + "\",";
    json += "\"mac_address\":\"" + WiFi.macAddress() + "\",";
    json += "\"is_online\":true,";
    json += "\"last_seen\":\"" + String("now()") + "\"";
    json += "}";

    int httpCode = http.PATCH(json);

    if (httpCode == 200 || httpCode == 204) {
        Serial.println("Device status updated");
    } else {
        Serial.printf("Device status update failed: %d\n", httpCode);
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
    html += "<h1>01TR03 Setup</h1>";
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

// ============================================================================
// Setup & Loop
// ============================================================================

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println("\n\n=== 01TR03 Transformer Monitor ===");
    Serial.printf("Firmware: %s\n", FIRMWARE_VERSION);

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
        displayBoot(90, "Registering...");
        updateDeviceStatus();  // Update device info in Supabase
        displayBoot(100, "Ready!");
        delay(500);
    }

    Serial.println("Setup complete");
}

void loop() {
    unsigned long now = millis();

    // Handle AP mode web server
    if (apMode) {
        webServer.handleClient();
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
    if (now - lastDataUpload >= UPLOAD_INTERVAL) {
        uploadToSupabase();
        lastDataUpload = now;
    }

    // Update display every second
    if (now - lastDisplayUpdate >= 1000) {
        displayTemperatures();
        lastDisplayUpdate = now;
    }

    delay(10);
}
