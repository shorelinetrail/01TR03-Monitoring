/**
 * 01TR03 Transformer Temperature Monitoring System
 *
 * 66/11kV 50MVA Power Transformer Monitor
 * NodeMCU-32S with MCP9600 Thermocouple Amplifiers and SSD1322 OLED
 *
 * Hardware:
 * - NodeMCU-32S (ESP32)
 * - 2x Seeed Studio Grove MCP9600 (I2C addresses 0x60, 0x67)
 * - 2x Type J Thermocouples (Main Tank, Tap Changer Cover)
 * - SSD1322 256x64 OLED Display (SPI)
 *
 * Author: Generated for 01TR03 Monitoring Project
 * License: MIT
 */

#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <U8g2lib.h>
#include <WiFi.h>

// Include sensor libraries based on configuration
#include "config.h"
#ifdef USE_MCP9600_SENSORS
    #include <Adafruit_MCP9600.h>
#endif
#ifdef USE_MAX31855_SENSORS
    #include <Adafruit_MAX31855.h>
#endif
#include <WebServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>

// Project headers (config.h already included above for sensor selection)
#include "types.h"
#include "constants.h"
#include "helpers.h"
#include "display_functions.h"
#include "sensors.h"
#include "network.h"
#include "web_pages.h"

// ============================================================================
// Global Objects
// ============================================================================

// Display (SSD1322 256x64 4-wire SPI)
U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2(U8G2_R0, OLED_CS_PIN, OLED_DC_PIN, OLED_RST_PIN);

// Temperature sensors - conditional on sensor type
#ifdef USE_MCP9600_SENSORS
    Adafruit_MCP9600 mcp9600_mainTank;
    Adafruit_MCP9600 mcp9600_tapChanger;
#endif

#ifdef USE_MAX31855_SENSORS
    // MAX31855 uses hardware SPI with separate CS pins
    // CLK = GPIO 18 (shared with display), MISO = GPIO 19
    Adafruit_MAX31855 max31855_mainTank(MAX31855_MAIN_TANK_CS);
    Adafruit_MAX31855 max31855_tapChanger(MAX31855_TAP_CHANGER_CS);
#endif

// Web server for AP mode configuration
WebServer webServer(80);

// Preferences (NVS storage)
Preferences preferences;

// ============================================================================
// Global State
// ============================================================================

// Configuration
DeviceConfig deviceConfig;

// Temperature data (dual buffer)
TemperatureData temperatureData;

// Display state
DisplayState displayState;

// Timing variables
unsigned long lastSensorRead = 0;
unsigned long lastDisplayUpdate = 0;
unsigned long lastCloudReport = 0;
unsigned long lastWiFiCheck = 0;

// Task handles for FreeRTOS
TaskHandle_t sensorTaskHandle = NULL;
TaskHandle_t networkTaskHandle = NULL;

// ============================================================================
// Configuration Functions
// ============================================================================

/**
 * Load configuration from NVS
 */
void loadConfig() {
    DEBUG_PRINTLN("Loading configuration...");

    preferences.begin(PREF_NAMESPACE, true);  // Read-only

    // WiFi settings
    String ssid = preferences.getString(PREF_WIFI_SSID, "");
    String pass = preferences.getString(PREF_WIFI_PASS, "");
    ssid.toCharArray(deviceConfig.wifiSSID, sizeof(deviceConfig.wifiSSID));
    pass.toCharArray(deviceConfig.wifiPassword, sizeof(deviceConfig.wifiPassword));

    // Supabase settings
    String supaUrl = preferences.getString(PREF_SUPABASE_URL, "");
    String supaKey = preferences.getString(PREF_SUPABASE_KEY, "");
    supaUrl.toCharArray(deviceConfig.supabaseUrl, sizeof(deviceConfig.supabaseUrl));
    supaKey.toCharArray(deviceConfig.supabaseKey, sizeof(deviceConfig.supabaseKey));

    // Temperature thresholds
    deviceConfig.mainTankWarning = preferences.getFloat(PREF_MAIN_WARN, MAIN_TANK_WARNING_DEFAULT);
    deviceConfig.mainTankAlarm = preferences.getFloat(PREF_MAIN_ALARM, MAIN_TANK_ALARM_DEFAULT);
    deviceConfig.tapChangerWarning = preferences.getFloat(PREF_TAP_WARN, TAP_CHANGER_WARNING_DEFAULT);
    deviceConfig.tapChangerAlarm = preferences.getFloat(PREF_TAP_ALARM, TAP_CHANGER_ALARM_DEFAULT);

    // System settings
    deviceConfig.reportInterval = CLOUD_REPORT_INTERVAL_MS;
    deviceConfig.displayBrightness = 255;
    deviceConfig.displayEnabled = true;
    deviceConfig.isConfigured = preferences.getBool(PREF_CONFIGURED, false);

    preferences.end();

    DEBUG_PRINTF("Config loaded. WiFi SSID: %s, Configured: %s\n",
                 deviceConfig.wifiSSID,
                 deviceConfig.isConfigured ? "Yes" : "No");
}

/**
 * Save configuration to NVS
 */
void saveConfig() {
    DEBUG_PRINTLN("Saving configuration...");

    preferences.begin(PREF_NAMESPACE, false);  // Read-write

    preferences.putString(PREF_WIFI_SSID, deviceConfig.wifiSSID);
    preferences.putString(PREF_WIFI_PASS, deviceConfig.wifiPassword);
    preferences.putString(PREF_SUPABASE_URL, deviceConfig.supabaseUrl);
    preferences.putString(PREF_SUPABASE_KEY, deviceConfig.supabaseKey);
    preferences.putFloat(PREF_MAIN_WARN, deviceConfig.mainTankWarning);
    preferences.putFloat(PREF_MAIN_ALARM, deviceConfig.mainTankAlarm);
    preferences.putFloat(PREF_TAP_WARN, deviceConfig.tapChangerWarning);
    preferences.putFloat(PREF_TAP_ALARM, deviceConfig.tapChangerAlarm);
    preferences.putBool(PREF_CONFIGURED, true);

    preferences.end();

    DEBUG_PRINTLN("Configuration saved.");
}

// ============================================================================
// Web Server Handlers
// ============================================================================

/**
 * Handle root page request
 */
void handleRoot() {
    String html = FPSTR(INDEX_HTML);

    // Replace placeholders
    html.replace("%FIRMWARE_VERSION%", FIRMWARE_VERSION);

    char mac[18];
    Network::getMACAddress(mac);
    html.replace("%MAC_ADDRESS%", mac);

    webServer.send(200, "text/html", html);
}

/**
 * Handle WiFi network scan
 */
void handleScan() {
    DEBUG_PRINTLN("Scanning WiFi networks...");

    int n = WiFi.scanNetworks();

    StaticJsonDocument<1024> doc;
    JsonArray networks = doc.createNestedArray("networks");

    for (int i = 0; i < n && i < 10; i++) {
        JsonObject network = networks.createNestedObject();
        network["ssid"] = WiFi.SSID(i);
        network["rssi"] = WiFi.RSSI(i);
        network["secure"] = WiFi.encryptionType(i) != WIFI_AUTH_OPEN;
    }

    WiFi.scanDelete();

    String response;
    serializeJson(doc, response);
    webServer.send(200, "application/json", response);
}

/**
 * Handle configuration GET request
 */
void handleGetConfig() {
    StaticJsonDocument<512> doc;

    doc["wifi_ssid"] = deviceConfig.wifiSSID;
    doc["supa_url"] = deviceConfig.supabaseUrl;
    doc["main_warn"] = deviceConfig.mainTankWarning;
    doc["main_alarm"] = deviceConfig.mainTankAlarm;
    doc["tap_warn"] = deviceConfig.tapChangerWarning;
    doc["tap_alarm"] = deviceConfig.tapChangerAlarm;

    String response;
    serializeJson(doc, response);
    webServer.send(200, "application/json", response);
}

/**
 * Handle configuration save
 */
void handleSave() {
    DEBUG_PRINTLN("Saving configuration from web...");

    // Get form parameters
    if (webServer.hasArg("wifi_ssid")) {
        String ssid = webServer.arg("wifi_ssid");
        ssid.toCharArray(deviceConfig.wifiSSID, sizeof(deviceConfig.wifiSSID));
    }

    if (webServer.hasArg("wifi_pass")) {
        String pass = webServer.arg("wifi_pass");
        pass.toCharArray(deviceConfig.wifiPassword, sizeof(deviceConfig.wifiPassword));
    }

    if (webServer.hasArg("supa_url")) {
        String url = webServer.arg("supa_url");
        url.toCharArray(deviceConfig.supabaseUrl, sizeof(deviceConfig.supabaseUrl));
    }

    if (webServer.hasArg("supa_key")) {
        String key = webServer.arg("supa_key");
        key.toCharArray(deviceConfig.supabaseKey, sizeof(deviceConfig.supabaseKey));
    }

    if (webServer.hasArg("main_warn")) {
        deviceConfig.mainTankWarning = webServer.arg("main_warn").toFloat();
    }

    if (webServer.hasArg("main_alarm")) {
        deviceConfig.mainTankAlarm = webServer.arg("main_alarm").toFloat();
    }

    if (webServer.hasArg("tap_warn")) {
        deviceConfig.tapChangerWarning = webServer.arg("tap_warn").toFloat();
    }

    if (webServer.hasArg("tap_alarm")) {
        deviceConfig.tapChangerAlarm = webServer.arg("tap_alarm").toFloat();
    }

    // Save to NVS
    saveConfig();

    // Send response
    StaticJsonDocument<128> doc;
    doc["success"] = true;
    doc["message"] = "Configuration saved. Restarting...";

    String response;
    serializeJson(doc, response);
    webServer.send(200, "application/json", response);

    // Restart after brief delay
    delay(1000);
    ESP.restart();
}

/**
 * Start web server for AP mode configuration
 */
void startWebServer() {
    webServer.on("/", HTTP_GET, handleRoot);
    webServer.on("/scan", HTTP_GET, handleScan);
    webServer.on("/config", HTTP_GET, handleGetConfig);
    webServer.on("/save", HTTP_POST, handleSave);

    webServer.begin();
    DEBUG_PRINTLN("Web server started on port 80");
}

// ============================================================================
// Display Update Functions
// ============================================================================

/**
 * Update display state from sensor data
 */
void updateDisplayState() {
    // Temperature values
    displayState.mainTankTemp = temperatureData.mainTank.valid ?
                                temperatureData.mainTank.temperature : 0.0f;
    displayState.tapChangerTemp = temperatureData.tapChanger.valid ?
                                  temperatureData.tapChanger.temperature : 0.0f;
    displayState.ambientTemp = temperatureData.ambientTemp;

    // Status
    displayState.mainTankStatus = temperatureData.mainTank.status;
    displayState.tapChangerStatus = temperatureData.tapChanger.status;

    // WiFi status
    displayState.wifiState = Network::getWiFiState();
    displayState.wifiRSSI = Network::getRSSI();

    // Cloud status
    displayState.cloudConnected = Network::timeSinceLastUpdate() < (deviceConfig.reportInterval * 2);
    displayState.lastCloudUpdate = Network::timeSinceLastUpdate();

    // Time
    displayState.timeValid = Network::getTime(displayState.hours,
                                               displayState.minutes,
                                               displayState.seconds);

    // Mark for redraw
    displayState.needsRedraw = true;
}

/**
 * Show boot progress on display
 */
void showBootProgress(int progress, const char* message) {
    displayState.systemMode = SystemMode::BOOTING;
    displayState.setupProgress = progress;
    Helpers::safeStrCopy(displayState.setupMessage, message, sizeof(displayState.setupMessage));
    displayState.needsRedraw = true;

    Display::render(displayState);
}

// ============================================================================
// Sensor Task (runs on Core 0)
// ============================================================================

void sensorTask(void* parameter) {
    DEBUG_PRINTLN("Sensor task started on core 0");

    while (true) {
        // Read all sensors
        Sensors::readAll(temperatureData);

        if (temperatureData.hasNewData) {
            DEBUG_PRINTF("Temps: Main=%.1f°C (%s), Tap=%.1f°C (%s), Amb=%.1f°C\n",
                        temperatureData.mainTank.temperature,
                        tempStatusToString(temperatureData.mainTank.status),
                        temperatureData.tapChanger.temperature,
                        tempStatusToString(temperatureData.tapChanger.status),
                        temperatureData.ambientTemp);
        }

        // Wait for next reading
        vTaskDelay(pdMS_TO_TICKS(Timing::SENSOR_READ_MS));
    }
}

// ============================================================================
// Network Task (runs on Core 0)
// ============================================================================

void networkTask(void* parameter) {
    DEBUG_PRINTLN("Network task started on core 0");

    // Initial NTP sync
    if (Network::isConnected()) {
        Network::syncNTP();
        Network::updateDeviceStatus(DEVICE_ID, true);
    }

    while (true) {
        // Maintain WiFi connection
        if (displayState.systemMode == SystemMode::RUNNING) {
            Network::maintainConnection();

            // Periodic NTP sync
            static unsigned long lastNtpCheck = 0;
            if (millis() - lastNtpCheck > Timing::NTP_SYNC_MS) {
                Network::syncNTP();
                lastNtpCheck = millis();
            }

            // Cloud reporting
            if (Network::shouldUpload() && temperatureData.hasNewData) {
                CloudPayload payload;
                Helpers::safeStrCopy(payload.deviceId, DEVICE_ID, sizeof(payload.deviceId));
                payload.mainTankTemp = temperatureData.mainTank.temperature;
                payload.tapChangerTemp = temperatureData.tapChanger.temperature;
                payload.ambientTemp = temperatureData.ambientTemp;
                Helpers::safeStrCopy(payload.mainTankStatus,
                                     tempStatusToString(temperatureData.mainTank.status),
                                     sizeof(payload.mainTankStatus));
                Helpers::safeStrCopy(payload.tapChangerStatus,
                                     tempStatusToString(temperatureData.tapChanger.status),
                                     sizeof(payload.tapChangerStatus));
                payload.timestamp = Network::getTimestamp();

                Network::uploadReading(payload);
            }
        }

        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

// ============================================================================
// Setup
// ============================================================================

void setup() {
    // Initialize serial
    Serial.begin(SERIAL_BAUD_RATE);
    delay(100);

    DEBUG_PRINTLN("\n\n========================================");
    DEBUG_PRINTLN("01TR03 Transformer Monitoring System");
    DEBUG_PRINTF("Firmware Version: %s\n", FIRMWARE_VERSION);
    DEBUG_PRINTLN("========================================\n");

    // Initialize display first for boot feedback
    DEBUG_PRINTLN("Initializing display...");
    Display::init();
    showBootProgress(10, "Initializing...");

    // Load configuration
    showBootProgress(20, "Loading config...");
    loadConfig();

    // Initialize sensors
    showBootProgress(40, "Init sensors...");
    if (!Sensors::init()) {
        DEBUG_PRINTLN("WARNING: Sensor initialization failed!");
        // Continue anyway - will show error on display
    }

    // Initialize WiFi
    showBootProgress(60, "Connecting WiFi...");

    if (deviceConfig.isConfigured && strlen(deviceConfig.wifiSSID) > 0) {
        // Try to connect to configured network
        displayState.systemMode = SystemMode::CONNECTING;
        Helpers::safeStrCopy(displayState.setupSSID, deviceConfig.wifiSSID, sizeof(displayState.setupSSID));

        bool connected = false;
        for (int attempt = 1; attempt <= 3 && !connected; attempt++) {
            displayState.setupProgress = attempt;
            Display::render(displayState);

            connected = Network::connect(deviceConfig.wifiSSID, deviceConfig.wifiPassword);
        }

        if (connected) {
            showBootProgress(80, "Syncing time...");
            Network::syncNTP();

            showBootProgress(90, "Starting...");
            delay(500);

            // Enter running mode
            displayState.systemMode = SystemMode::RUNNING;
            displayState.needsRedraw = true;

            // Create FreeRTOS tasks on Core 0
            xTaskCreatePinnedToCore(sensorTask, "SensorTask", 4096, NULL, 1, &sensorTaskHandle, 0);
            xTaskCreatePinnedToCore(networkTask, "NetworkTask", 8192, NULL, 1, &networkTaskHandle, 0);

            DEBUG_PRINTLN("System running in normal mode.");
        } else {
            // Connection failed - fall through to AP mode
            DEBUG_PRINTLN("WiFi connection failed. Starting AP mode.");
            deviceConfig.isConfigured = false;
        }
    }

    // If not configured or connection failed, start AP mode
    if (!deviceConfig.isConfigured || !Network::isConnected()) {
        showBootProgress(70, "Starting AP...");

        Network::startAP(WIFI_AP_SSID, WIFI_AP_PASSWORD);
        startWebServer();

        // Update display state for AP mode
        displayState.systemMode = SystemMode::SETUP_AP;
        Helpers::safeStrCopy(displayState.setupSSID, WIFI_AP_SSID, sizeof(displayState.setupSSID));
        Network::getAPIP(displayState.setupIP, sizeof(displayState.setupIP));
        displayState.needsRedraw = true;

        DEBUG_PRINTLN("System running in AP mode for configuration.");
        DEBUG_PRINTF("Connect to WiFi: %s\n", WIFI_AP_SSID);
        DEBUG_PRINTF("Open browser: http://%s\n", displayState.setupIP);
    }

    showBootProgress(100, "Ready!");
    delay(500);

    DEBUG_PRINTLN("\nSetup complete.\n");
}

// ============================================================================
// Main Loop
// ============================================================================

void loop() {
    unsigned long currentMillis = millis();

    // Handle web server requests in AP mode
    if (displayState.systemMode == SystemMode::SETUP_AP) {
        webServer.handleClient();
    }

    // Update display state from sensor data (running mode only)
    if (displayState.systemMode == SystemMode::RUNNING) {
        if (currentMillis - lastDisplayUpdate >= Timing::DISPLAY_UPDATE_MS) {
            updateDisplayState();
            lastDisplayUpdate = currentMillis;
        }
    }

    // Render display if needed
    Display::renderIfNeeded(displayState);

    // Small delay to prevent tight loop
    delay(10);
}
