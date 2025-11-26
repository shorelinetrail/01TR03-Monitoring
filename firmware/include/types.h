#ifndef TYPES_H
#define TYPES_H

#include <Arduino.h>

// ============================================================================
// 01TR03 Transformer Monitoring System - Type Definitions
// ============================================================================

// Temperature status enum
enum class TempStatus {
    UNKNOWN,
    NORMAL,
    WARNING,
    ALARM,
    ERROR
};

// System mode enum
enum class SystemMode {
    BOOTING,
    SETUP_AP,           // WiFi AP mode for configuration
    CONNECTING,         // Connecting to WiFi
    RUNNING,            // Normal operation
    ERROR
};

// WiFi status enum
enum class WiFiState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    AP_MODE,
    ERROR
};

// Sensor reading structure
struct SensorReading {
    float temperature;
    float coldJunction;     // Ambient/cold junction temperature
    TempStatus status;
    bool valid;
    unsigned long timestamp;
};

// Temperature data structure (dual-buffer pattern)
struct TemperatureData {
    SensorReading mainTank;
    SensorReading tapChanger;
    float ambientTemp;
    unsigned long lastUpdate;
    bool hasNewData;
};

// Device configuration structure
struct DeviceConfig {
    // WiFi settings
    char wifiSSID[65];
    char wifiPassword[65];

    // Supabase settings
    char supabaseUrl[256];
    char supabaseKey[256];

    // Temperature thresholds
    float mainTankWarning;
    float mainTankAlarm;
    float tapChangerWarning;
    float tapChangerAlarm;

    // Display settings
    uint8_t displayBrightness;
    bool displayEnabled;

    // System settings
    uint32_t reportInterval;    // Cloud report interval in ms
    bool isConfigured;
};

// Display state structure (for rendering)
struct DisplayState {
    // Current temperatures
    float mainTankTemp;
    float tapChangerTemp;
    float ambientTemp;

    // Status indicators
    TempStatus mainTankStatus;
    TempStatus tapChangerStatus;

    // System status
    SystemMode systemMode;
    WiFiState wifiState;
    int wifiRSSI;
    bool cloudConnected;
    unsigned long lastCloudUpdate;

    // Time
    int hours;
    int minutes;
    int seconds;
    bool timeValid;

    // Animation state
    bool animating;
    unsigned long animationStart;
    float animationProgress;

    // Setup mode data
    char setupSSID[33];
    char setupIP[16];
    int setupProgress;
    char setupMessage[64];

    // Dirty flag for optimization
    bool needsRedraw;
};

// Cloud payload structure
struct CloudPayload {
    char deviceId[16];
    float mainTankTemp;
    float tapChangerTemp;
    float ambientTemp;
    char mainTankStatus[12];
    char tapChangerStatus[12];
    unsigned long timestamp;
};

// Alert structure
struct Alert {
    char type[32];
    char severity[12];
    char message[128];
    float value;
    float threshold;
    unsigned long timestamp;
};

// Helper functions for status conversion
inline const char* tempStatusToString(TempStatus status) {
    switch (status) {
        case TempStatus::NORMAL:    return "normal";
        case TempStatus::WARNING:   return "warning";
        case TempStatus::ALARM:     return "alarm";
        case TempStatus::ERROR:     return "error";
        default:                    return "unknown";
    }
}

inline const char* wifiStateToString(WiFiState state) {
    switch (state) {
        case WiFiState::DISCONNECTED:   return "Disconnected";
        case WiFiState::CONNECTING:     return "Connecting...";
        case WiFiState::CONNECTED:      return "Connected";
        case WiFiState::AP_MODE:        return "AP Mode";
        case WiFiState::ERROR:          return "Error";
        default:                        return "Unknown";
    }
}

inline const char* systemModeToString(SystemMode mode) {
    switch (mode) {
        case SystemMode::BOOTING:       return "Booting";
        case SystemMode::SETUP_AP:      return "Setup Mode";
        case SystemMode::CONNECTING:    return "Connecting";
        case SystemMode::RUNNING:       return "Running";
        case SystemMode::ERROR:         return "Error";
        default:                        return "Unknown";
    }
}

#endif // TYPES_H
