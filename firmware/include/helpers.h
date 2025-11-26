#ifndef HELPERS_H
#define HELPERS_H

#include <Arduino.h>

// ============================================================================
// 01TR03 Transformer Monitoring System - Helper Functions
// ============================================================================

namespace Helpers {

    // ========================================================================
    // Animation Easing Functions (from StationBoards)
    // ========================================================================

    /**
     * Cubic ease-in-out function for smooth animations
     * @param t Normalized time (0.0 to 1.0)
     * @return Eased value (0.0 to 1.0)
     */
    inline float easeInOutCubic(float t) {
        if (t < 0.5f) {
            return 4.0f * t * t * t;
        } else {
            float f = (2.0f * t) - 2.0f;
            return 0.5f * f * f * f + 1.0f;
        }
    }

    /**
     * Quadratic ease-out function for faster deceleration
     * @param t Normalized time (0.0 to 1.0)
     * @return Eased value (0.0 to 1.0)
     */
    inline float easeOutQuadratic(float t) {
        return t * (2.0f - t);
    }

    /**
     * Linear interpolation
     * @param start Start value
     * @param end End value
     * @param t Normalized time (0.0 to 1.0)
     * @return Interpolated value
     */
    inline float lerp(float start, float end, float t) {
        return start + (end - start) * t;
    }

    // ========================================================================
    // String Utilities
    // ========================================================================

    /**
     * Safe string copy with null termination
     * @param dest Destination buffer
     * @param src Source string
     * @param maxLen Maximum length including null terminator
     */
    inline void safeStrCopy(char* dest, const char* src, size_t maxLen) {
        if (dest == nullptr || src == nullptr || maxLen == 0) return;
        strncpy(dest, src, maxLen - 1);
        dest[maxLen - 1] = '\0';
    }

    /**
     * Format temperature value with degree symbol
     * @param buffer Output buffer
     * @param bufferSize Buffer size
     * @param temp Temperature value
     * @param decimals Number of decimal places
     */
    inline void formatTemperature(char* buffer, size_t bufferSize, float temp, int decimals = 1) {
        if (buffer == nullptr || bufferSize < 8) return;
        snprintf(buffer, bufferSize, "%.*f\xB0""C", decimals, temp);
    }

    /**
     * Format temperature value without unit
     * @param buffer Output buffer
     * @param bufferSize Buffer size
     * @param temp Temperature value
     * @param decimals Number of decimal places
     */
    inline void formatTempValue(char* buffer, size_t bufferSize, float temp, int decimals = 1) {
        if (buffer == nullptr || bufferSize < 8) return;
        snprintf(buffer, bufferSize, "%.*f", decimals, temp);
    }

    // ========================================================================
    // Time Utilities
    // ========================================================================

    /**
     * Format time as HH:MM:SS
     * @param buffer Output buffer (minimum 9 bytes)
     * @param hours Hours (0-23)
     * @param minutes Minutes (0-59)
     * @param seconds Seconds (0-59)
     */
    inline void formatTime(char* buffer, int hours, int minutes, int seconds) {
        snprintf(buffer, 9, "%02d:%02d:%02d", hours, minutes, seconds);
    }

    /**
     * Format time as HH:MM
     * @param buffer Output buffer (minimum 6 bytes)
     * @param hours Hours (0-23)
     * @param minutes Minutes (0-59)
     */
    inline void formatTimeShort(char* buffer, int hours, int minutes) {
        snprintf(buffer, 6, "%02d:%02d", hours, minutes);
    }

    /**
     * Get elapsed time string
     * @param buffer Output buffer
     * @param bufferSize Buffer size
     * @param elapsedMs Elapsed time in milliseconds
     */
    inline void formatElapsed(char* buffer, size_t bufferSize, unsigned long elapsedMs) {
        unsigned long seconds = elapsedMs / 1000;
        if (seconds < 60) {
            snprintf(buffer, bufferSize, "%lus ago", seconds);
        } else if (seconds < 3600) {
            snprintf(buffer, bufferSize, "%lum ago", seconds / 60);
        } else {
            snprintf(buffer, bufferSize, "%luh ago", seconds / 3600);
        }
    }

    // ========================================================================
    // Validation Utilities
    // ========================================================================

    /**
     * Check if temperature is within valid range
     * @param temp Temperature value
     * @param minValid Minimum valid temperature
     * @param maxValid Maximum valid temperature
     * @return true if valid
     */
    inline bool isValidTemperature(float temp, float minValid = -40.0f, float maxValid = 200.0f) {
        return !isnan(temp) && !isinf(temp) && temp >= minValid && temp <= maxValid;
    }

    /**
     * Clamp value to range
     * @param value Value to clamp
     * @param minVal Minimum value
     * @param maxVal Maximum value
     * @return Clamped value
     */
    template<typename T>
    inline T clamp(T value, T minVal, T maxVal) {
        return (value < minVal) ? minVal : (value > maxVal) ? maxVal : value;
    }

    // ========================================================================
    // WiFi Signal Utilities
    // ========================================================================

    /**
     * Convert RSSI to signal quality percentage
     * @param rssi RSSI value in dBm
     * @return Quality percentage (0-100)
     */
    inline int rssiToQuality(int rssi) {
        if (rssi <= -100) return 0;
        if (rssi >= -50) return 100;
        return 2 * (rssi + 100);
    }

    /**
     * Get signal strength description
     * @param rssi RSSI value in dBm
     * @return Description string
     */
    inline const char* rssiToDescription(int rssi) {
        if (rssi >= -50) return "Excellent";
        if (rssi >= -60) return "Good";
        if (rssi >= -70) return "Fair";
        if (rssi >= -80) return "Weak";
        return "Poor";
    }

    /**
     * Get WiFi signal bars (0-4)
     * @param rssi RSSI value in dBm
     * @return Number of bars
     */
    inline int rssiToBars(int rssi) {
        if (rssi >= -50) return 4;
        if (rssi >= -60) return 3;
        if (rssi >= -70) return 2;
        if (rssi >= -80) return 1;
        return 0;
    }

    // ========================================================================
    // Memory Utilities
    // ========================================================================

    /**
     * Get free heap memory
     * @return Free heap in bytes
     */
    inline size_t getFreeHeap() {
        return ESP.getFreeHeap();
    }

    /**
     * Get minimum free heap since boot
     * @return Minimum free heap in bytes
     */
    inline size_t getMinFreeHeap() {
        return ESP.getMinFreeHeap();
    }

    /**
     * Format bytes as human-readable string
     * @param buffer Output buffer
     * @param bufferSize Buffer size
     * @param bytes Number of bytes
     */
    inline void formatBytes(char* buffer, size_t bufferSize, size_t bytes) {
        if (bytes < 1024) {
            snprintf(buffer, bufferSize, "%u B", (unsigned int)bytes);
        } else if (bytes < 1048576) {
            snprintf(buffer, bufferSize, "%.1f KB", bytes / 1024.0f);
        } else {
            snprintf(buffer, bufferSize, "%.1f MB", bytes / 1048576.0f);
        }
    }

} // namespace Helpers

#endif // HELPERS_H
