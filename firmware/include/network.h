#ifndef NETWORK_H
#define NETWORK_H

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include "config.h"
#include "types.h"
#include "constants.h"
#include "helpers.h"

// ============================================================================
// 01TR03 Transformer Monitoring System - Network Functions
// WiFi, NTP, and Supabase Cloud Connectivity
// ============================================================================

// External references
extern DeviceConfig deviceConfig;
extern DisplayState displayState;

namespace Network {

    // State variables
    static bool _ntpSynced = false;
    static unsigned long _lastNtpSync = 0;
    static unsigned long _lastCloudUpdate = 0;
    static int _reconnectAttempts = 0;

    // ========================================================================
    // WiFi Functions
    // ========================================================================

    /**
     * Check if WiFi is connected
     * @return true if connected
     */
    inline bool isConnected() {
        return WiFi.status() == WL_CONNECTED;
    }

    /**
     * Get current WiFi RSSI
     * @return RSSI in dBm, or 0 if not connected
     */
    inline int getRSSI() {
        if (!isConnected()) return 0;
        return WiFi.RSSI();
    }

    /**
     * Get WiFi state enum
     * @return Current WiFi state
     */
    inline WiFiState getWiFiState() {
        switch (WiFi.status()) {
            case WL_CONNECTED:
                return WiFiState::CONNECTED;
            case WL_IDLE_STATUS:
            case WL_NO_SSID_AVAIL:
            case WL_SCAN_COMPLETED:
                return WiFiState::DISCONNECTED;
            case WL_CONNECT_FAILED:
            case WL_CONNECTION_LOST:
            case WL_DISCONNECTED:
                return WiFiState::DISCONNECTED;
            default:
                return WiFiState::DISCONNECTED;
        }
    }

    /**
     * Connect to WiFi network
     * @param ssid WiFi SSID
     * @param password WiFi password
     * @param timeoutMs Connection timeout in milliseconds
     * @return true if connected successfully
     */
    inline bool connect(const char* ssid, const char* password, unsigned long timeoutMs = Timing::WIFI_CONNECT_TIMEOUT_MS) {
        DEBUG_PRINTF("Connecting to WiFi: %s\n", ssid);

        WiFi.mode(WIFI_STA);
        WiFi.begin(ssid, password);

        unsigned long startTime = millis();
        while (WiFi.status() != WL_CONNECTED && (millis() - startTime) < timeoutMs) {
            delay(500);
            DEBUG_PRINT(".");
        }
        DEBUG_PRINTLN();

        if (WiFi.status() == WL_CONNECTED) {
            DEBUG_PRINTF("Connected! IP: %s\n", WiFi.localIP().toString().c_str());
            _reconnectAttempts = 0;
            return true;
        }

        DEBUG_PRINTLN("Connection failed!");
        return false;
    }

    /**
     * Disconnect from WiFi
     */
    inline void disconnect() {
        WiFi.disconnect(true);
        WiFi.mode(WIFI_OFF);
    }

    /**
     * Start AP mode for configuration
     * @param ssid AP SSID
     * @param password AP password (empty for open network)
     * @return true if AP started successfully
     */
    inline bool startAP(const char* ssid, const char* password = "") {
        DEBUG_PRINTF("Starting AP: %s\n", ssid);

        WiFi.mode(WIFI_AP);

        bool success;
        if (strlen(password) > 0) {
            success = WiFi.softAP(ssid, password);
        } else {
            success = WiFi.softAP(ssid);
        }

        if (success) {
            DEBUG_PRINTF("AP started. IP: %s\n", WiFi.softAPIP().toString().c_str());
        } else {
            DEBUG_PRINTLN("AP start failed!");
        }

        return success;
    }

    /**
     * Get AP IP address as string
     * @param buffer Output buffer
     * @param bufferSize Buffer size
     */
    inline void getAPIP(char* buffer, size_t bufferSize) {
        snprintf(buffer, bufferSize, "%s", WiFi.softAPIP().toString().c_str());
    }

    /**
     * Get station IP address as string
     * @param buffer Output buffer
     * @param bufferSize Buffer size
     */
    inline void getLocalIP(char* buffer, size_t bufferSize) {
        snprintf(buffer, bufferSize, "%s", WiFi.localIP().toString().c_str());
    }

    /**
     * Try to reconnect if disconnected
     * @return true if now connected
     */
    inline bool maintainConnection() {
        if (isConnected()) {
            return true;
        }

        if (_reconnectAttempts >= WiFi_Config::MAX_RECONNECT_ATTEMPTS) {
            return false;
        }

        _reconnectAttempts++;
        DEBUG_PRINTF("Reconnection attempt %d/%d\n", _reconnectAttempts, WiFi_Config::MAX_RECONNECT_ATTEMPTS);

        return connect(deviceConfig.wifiSSID, deviceConfig.wifiPassword);
    }

    // ========================================================================
    // NTP Functions
    // ========================================================================

    /**
     * Sync time with NTP server
     * @return true if sync successful
     */
    inline bool syncNTP() {
        if (!isConnected()) {
            return false;
        }

        DEBUG_PRINTLN("Syncing NTP...");
        configTime(NTP_GMT_OFFSET, NTP_DAYLIGHT_OFFSET, NTP_SERVER);

        // Wait for time to be set
        struct tm timeinfo;
        int attempts = 0;
        while (!getLocalTime(&timeinfo) && attempts < 10) {
            delay(500);
            attempts++;
        }

        if (attempts >= 10) {
            DEBUG_PRINTLN("NTP sync failed!");
            return false;
        }

        _ntpSynced = true;
        _lastNtpSync = millis();
        DEBUG_PRINTLN("NTP sync successful.");
        return true;
    }

    /**
     * Check if time is synced
     * @return true if NTP synced
     */
    inline bool isTimeSynced() {
        return _ntpSynced;
    }

    /**
     * Get current time
     * @param hours Output hours
     * @param minutes Output minutes
     * @param seconds Output seconds
     * @return true if time is valid
     */
    inline bool getTime(int& hours, int& minutes, int& seconds) {
        struct tm timeinfo;
        if (!getLocalTime(&timeinfo)) {
            return false;
        }

        hours = timeinfo.tm_hour;
        minutes = timeinfo.tm_min;
        seconds = timeinfo.tm_sec;
        return true;
    }

    /**
     * Get current timestamp (Unix epoch seconds)
     * @return Unix timestamp, or 0 if not synced
     */
    inline unsigned long getTimestamp() {
        struct tm timeinfo;
        if (!getLocalTime(&timeinfo)) {
            return 0;
        }
        return mktime(&timeinfo);
    }

    // ========================================================================
    // Supabase Cloud Functions
    // ========================================================================

    /**
     * Send temperature reading to Supabase
     * @param payload CloudPayload with temperature data
     * @return true if upload successful
     */
    inline bool uploadReading(const CloudPayload& payload) {
        if (!isConnected()) {
            DEBUG_PRINTLN("Cloud upload failed: not connected");
            return false;
        }

        if (strlen(deviceConfig.supabaseUrl) == 0 || strlen(deviceConfig.supabaseKey) == 0) {
            DEBUG_PRINTLN("Cloud upload failed: Supabase not configured");
            return false;
        }

        HTTPClient http;

        // Build URL for temperature_readings table
        char url[512];
        snprintf(url, sizeof(url), "%s/rest/v1/temperature_readings",
                 deviceConfig.supabaseUrl);

        http.begin(url);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("apikey", deviceConfig.supabaseKey);
        http.addHeader("Authorization", String("Bearer ") + deviceConfig.supabaseKey);
        http.addHeader("Prefer", "return=minimal");

        // Build JSON payload
        StaticJsonDocument<512> doc;
        doc["device_id"] = payload.deviceId;
        doc["main_tank_temp"] = payload.mainTankTemp;
        doc["tap_changer_temp"] = payload.tapChangerTemp;
        doc["ambient_temp"] = payload.ambientTemp;
        doc["main_tank_status"] = payload.mainTankStatus;
        doc["tap_changer_status"] = payload.tapChangerStatus;

        String jsonStr;
        serializeJson(doc, jsonStr);

        DEBUG_PRINTF("Uploading: %s\n", jsonStr.c_str());

        int httpCode = http.POST(jsonStr);

        if (httpCode == HTTP_CODE_CREATED || httpCode == HTTP_CODE_OK) {
            DEBUG_PRINTLN("Upload successful");
            _lastCloudUpdate = millis();
            http.end();
            return true;
        }

        DEBUG_PRINTF("Upload failed with code: %d\n", httpCode);
        DEBUG_PRINTLN(http.getString());
        http.end();
        return false;
    }

    /**
     * Update device online status
     * @param deviceId Device ID
     * @param isOnline Online status
     * @return true if update successful
     */
    inline bool updateDeviceStatus(const char* deviceId, bool isOnline) {
        if (!isConnected() || strlen(deviceConfig.supabaseUrl) == 0) {
            return false;
        }

        HTTPClient http;

        char url[512];
        snprintf(url, sizeof(url), "%s/rest/v1/devices?device_id=eq.%s",
                 deviceConfig.supabaseUrl, deviceId);

        http.begin(url);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("apikey", deviceConfig.supabaseKey);
        http.addHeader("Authorization", String("Bearer ") + deviceConfig.supabaseKey);
        http.addHeader("Prefer", "return=minimal");

        StaticJsonDocument<256> doc;
        doc["is_online"] = isOnline;
        doc["last_seen"] = "now()";  // PostgreSQL function
        doc["ip_address"] = WiFi.localIP().toString();
        doc["firmware_version"] = FIRMWARE_VERSION;

        String jsonStr;
        serializeJson(doc, jsonStr);

        int httpCode = http.PATCH(jsonStr);
        http.end();

        return (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_NO_CONTENT);
    }

    /**
     * Get time since last cloud update
     * @return Milliseconds since last update
     */
    inline unsigned long timeSinceLastUpdate() {
        if (_lastCloudUpdate == 0) {
            return ULONG_MAX;
        }
        return millis() - _lastCloudUpdate;
    }

    /**
     * Check if cloud upload is due
     * @return true if should upload
     */
    inline bool shouldUpload() {
        return timeSinceLastUpdate() >= deviceConfig.reportInterval;
    }

    // ========================================================================
    // MAC Address
    // ========================================================================

    /**
     * Get device MAC address
     * @param buffer Output buffer (minimum 18 bytes)
     */
    inline void getMACAddress(char* buffer) {
        uint8_t mac[6];
        WiFi.macAddress(mac);
        snprintf(buffer, 18, "%02X:%02X:%02X:%02X:%02X:%02X",
                 mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    }

} // namespace Network

#endif // NETWORK_H
