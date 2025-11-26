#ifndef CONSTANTS_H
#define CONSTANTS_H

// ============================================================================
// 01TR03 Transformer Monitoring System - Constants
// ============================================================================

// Display layout constants
namespace Layout {
    // Display dimensions
    constexpr int SCREEN_WIDTH = 256;
    constexpr int SCREEN_HEIGHT = 64;

    // Margins
    constexpr int MARGIN_LEFT = 5;
    constexpr int MARGIN_RIGHT = 5;
    constexpr int TEXT_SPACING = 10;
    constexpr int LINE_HEIGHT = 14;

    // Y positions for different display elements
    constexpr int Y_HEADER = 12;
    constexpr int Y_MAIN_TANK = 28;
    constexpr int Y_TAP_CHANGER = 44;
    constexpr int Y_STATUS_BAR = 60;

    // X positions
    constexpr int X_LABEL_START = 5;
    constexpr int X_TEMP_VALUE = 140;
    constexpr int X_STATUS_ICON = 200;
    constexpr int X_RIGHT_ALIGN = 251;
    constexpr int X_CENTER = 128;

    // Temperature display formatting
    constexpr int TEMP_VALUE_WIDTH = 50;

    // Progress bar dimensions (for setup mode)
    constexpr int PROGRESS_BAR_X = 28;
    constexpr int PROGRESS_BAR_Y = 35;
    constexpr int PROGRESS_BAR_WIDTH = 200;
    constexpr int PROGRESS_BAR_HEIGHT = 10;
    constexpr int PROGRESS_SEGMENTS = 10;
}

// Animation constants
namespace Animation {
    constexpr unsigned long DURATION_MS = 500;
    constexpr unsigned long BLINK_INTERVAL_MS = 500;
    constexpr unsigned long SCROLL_INTERVAL_MS = 50;
    constexpr int SCROLL_PIXELS_PER_STEP = 2;
}

// Timing constants
namespace Timing {
    constexpr unsigned long SENSOR_READ_MS = 5000;
    constexpr unsigned long DISPLAY_UPDATE_MS = 1000;
    constexpr unsigned long CLOUD_REPORT_MS = 30000;
    constexpr unsigned long WIFI_RECONNECT_MS = 30000;
    constexpr unsigned long WIFI_CONNECT_TIMEOUT_MS = 15000;
    constexpr unsigned long NTP_SYNC_MS = 3600000;
    constexpr unsigned long DEBOUNCE_MS = 50;
    constexpr unsigned long HEARTBEAT_MS = 60000;
}

// Temperature constants
namespace Temperature {
    // Valid range for Type J thermocouple
    constexpr float MIN_VALID = -40.0f;
    constexpr float MAX_VALID = 750.0f;

    // Display range
    constexpr float DISPLAY_MIN = 0.0f;
    constexpr float DISPLAY_MAX = 150.0f;

    // Default thresholds (°C)
    constexpr float MAIN_TANK_WARNING = 85.0f;
    constexpr float MAIN_TANK_ALARM = 95.0f;
    constexpr float TAP_CHANGER_WARNING = 70.0f;
    constexpr float TAP_CHANGER_ALARM = 85.0f;

    // Typical operating ranges
    constexpr float NORMAL_MIN = 20.0f;
    constexpr float NORMAL_MAX = 65.0f;
}

// WiFi constants
namespace WiFi_Config {
    constexpr int MAX_RECONNECT_ATTEMPTS = 3;
    constexpr int RSSI_EXCELLENT = -50;
    constexpr int RSSI_GOOD = -60;
    constexpr int RSSI_FAIR = -70;
    constexpr int RSSI_WEAK = -80;
}

// Buffer sizes
namespace Buffers {
    constexpr size_t JSON_BUFFER_SIZE = 1024;
    constexpr size_t HTTP_RESPONSE_SIZE = 2048;
    constexpr size_t SSID_MAX_LENGTH = 64;
    constexpr size_t PASSWORD_MAX_LENGTH = 64;
    constexpr size_t URL_MAX_LENGTH = 256;
}

// Status symbols (for display)
namespace Symbols {
    // Unicode/ASCII symbols for status display
    constexpr char WIFI_CONNECTED[] = "WiFi";
    constexpr char WIFI_DISCONNECTED[] = "----";
    constexpr char TEMP_NORMAL[] = "OK";
    constexpr char TEMP_WARNING[] = "WARN";
    constexpr char TEMP_ALARM[] = "ALRM";
    constexpr char TEMP_ERROR[] = "ERR";
    constexpr char DEGREE_SYMBOL[] = "\xB0";     // ° symbol
    constexpr char CELSIUS[] = "\xB0""C";        // °C
}

// Error codes
namespace ErrorCodes {
    constexpr int SUCCESS = 0;
    constexpr int SENSOR_READ_ERROR = -1;
    constexpr int SENSOR_NOT_FOUND = -2;
    constexpr int WIFI_CONNECT_ERROR = -3;
    constexpr int CLOUD_UPLOAD_ERROR = -4;
    constexpr int CONFIG_READ_ERROR = -5;
    constexpr int CONFIG_WRITE_ERROR = -6;
    constexpr int NTP_SYNC_ERROR = -7;
    constexpr int DISPLAY_INIT_ERROR = -8;
}

#endif // CONSTANTS_H
