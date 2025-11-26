/**
 * 01TR03 Transformer Temperature Monitoring System
 *
 * 66/11kV 50MVA Power Transformer Monitor
 * NodeMCU-32S with MCP9600 Thermocouple Amplifiers and SSD1322 OLED
 */

#include <Arduino.h>
#include <U8g2lib.h>
#include <Wire.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>

// Configuration
#define DEVICE_ID           "01TR03"
#define FIRMWARE_VERSION    "1.0.0"
#define WIFI_AP_SSID        "01TR03-Setup"
#define WIFI_AP_PASSWORD    "transformer"

// Display pins (matching StationBoards)
#define OLED_CS   5
#define OLED_DC   16
#define OLED_RST  17

// I2C pins for MCP9600
#define I2C_SDA   21
#define I2C_SCL   22
#define MCP9600_ADDR_1  0x60
#define MCP9600_ADDR_2  0x67

// Temperature thresholds
#define MAIN_TANK_WARNING    85.0
#define MAIN_TANK_ALARM      95.0
#define TAP_CHANGER_WARNING  70.0
#define TAP_CHANGER_ALARM    85.0

// Display - exact same as StationBoards
U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2(U8G2_R0, OLED_CS, OLED_DC, OLED_RST);

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
    snprintf(tempStr, sizeof(tempStr), "%.1f C", mainTankTemp);
    u8g2.setFont(u8g2_font_helvB10_tr);
    u8g2.drawStr(100, 30, tempStr);

    u8g2.setFont(u8g2_font_6x10_tr);
    u8g2.drawStr(200, 30, mainTankStatus.c_str());

    // Tap Changer
    u8g2.setFont(u8g2_font_helvB08_tr);
    u8g2.drawStr(5, 46, "Tap Changer:");

    snprintf(tempStr, sizeof(tempStr), "%.1f C", tapChangerTemp);
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
// Sensor Functions (Simulated for now - add MCP9600 later)
// ============================================================================

void readSensors() {
    // TODO: Add actual MCP9600 reading
    // For now, simulate with random values
    mainTankTemp = 45.0 + random(-20, 20) / 10.0;
    tapChangerTemp = 38.0 + random(-20, 20) / 10.0;
    ambientTemp = 22.0 + random(-10, 10) / 10.0;

    // Update status
    if (mainTankTemp >= MAIN_TANK_ALARM) {
        mainTankStatus = "ALRM";
    } else if (mainTankTemp >= MAIN_TANK_WARNING) {
        mainTankStatus = "WARN";
    } else {
        mainTankStatus = "OK";
    }

    if (tapChangerTemp >= TAP_CHANGER_ALARM) {
        tapChangerStatus = "ALRM";
    } else if (tapChangerTemp >= TAP_CHANGER_WARNING) {
        tapChangerStatus = "WARN";
    } else {
        tapChangerStatus = "OK";
    }
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
    preferences.end();
}

void saveConfig() {
    preferences.begin("tr03config", false);
    preferences.putString("wifi_ssid", wifiSSID);
    preferences.putString("wifi_pass", wifiPassword);
    preferences.putString("supa_url", supabaseUrl);
    preferences.putString("supa_key", supabaseKey);
    preferences.end();
}

void handleRoot() {
    String html = R"(
<!DOCTYPE html>
<html>
<head>
    <meta name='viewport' content='width=device-width, initial-scale=1'>
    <style>
        body { font-family: Arial; background: #1a1a2e; color: #fff; padding: 20px; }
        .card { background: rgba(255,255,255,0.1); border-radius: 10px; padding: 20px; max-width: 400px; margin: 0 auto; }
        h1 { text-align: center; }
        input { width: 100%; padding: 10px; margin: 10px 0; border-radius: 5px; border: 1px solid #444; background: #333; color: #fff; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background: #4fc3f7; border: none; border-radius: 5px; color: #000; font-weight: bold; cursor: pointer; }
    </style>
</head>
<body>
    <div class='card'>
        <h1>01TR03 Setup</h1>
        <form action='/save' method='POST'>
            <input type='text' name='ssid' placeholder='WiFi SSID'>
            <input type='password' name='pass' placeholder='WiFi Password'>
            <input type='text' name='supa_url' placeholder='Supabase URL'>
            <input type='text' name='supa_key' placeholder='Supabase Key'>
            <button type='submit'>Save & Connect</button>
        </form>
    </div>
</body>
</html>
    )";
    webServer.send(200, "text/html", html);
}

void handleSave() {
    if (webServer.hasArg("ssid")) wifiSSID = webServer.arg("ssid");
    if (webServer.hasArg("pass")) wifiPassword = webServer.arg("pass");
    if (webServer.hasArg("supa_url")) supabaseUrl = webServer.arg("supa_url");
    if (webServer.hasArg("supa_key")) supabaseKey = webServer.arg("supa_key");

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

    // Try WiFi connection
    displayBoot(50, "Connecting WiFi...");
    if (!connectWiFi()) {
        displayBoot(70, "Starting AP...");
        startAP();
    } else {
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

    // Update display every second
    if (now - lastDisplayUpdate >= 1000) {
        displayTemperatures();
        lastDisplayUpdate = now;
    }

    delay(10);
}
