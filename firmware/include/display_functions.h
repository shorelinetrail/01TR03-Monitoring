#ifndef DISPLAY_FUNCTIONS_H
#define DISPLAY_FUNCTIONS_H

#include <Arduino.h>
#include <U8g2lib.h>
#include "config.h"
#include "types.h"
#include "constants.h"
#include "helpers.h"

// ============================================================================
// 01TR03 Transformer Monitoring System - Display Functions
// Following StationBoards display patterns
// ============================================================================

// Display instance (SSD1322 256x64 4-wire SPI)
extern U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2;

// Current display state (for dirty flag optimization)
extern DisplayState displayState;

// ============================================================================
// Font Definitions (matching StationBoards)
// ============================================================================
#define FONT_HEADER         u8g2_font_helvB12_tr    // Bold header font
#define FONT_LARGE          u8g2_font_helvB14_tr    // Large bold font
#define FONT_NORMAL         u8g2_font_t0_11_tf      // Normal text
#define FONT_BOLD           u8g2_font_t0_11b_tf     // Bold text
#define FONT_SMALL          u8g2_font_6x10_tr       // Small text
#define FONT_ICONS          u8g2_font_open_iconic_embedded_1x_t  // Icons

namespace Display {

    // ========================================================================
    // Initialization
    // ========================================================================

    /**
     * Initialize the display hardware
     * @return true if successful
     */
    inline bool init() {
        u8g2.begin();
        u8g2.setContrast(255);              // Full brightness
        u8g2.setFont(FONT_NORMAL);
        u8g2.clearBuffer();
        u8g2.sendBuffer();
        return true;
    }

    /**
     * Set display brightness/contrast
     * @param brightness 0-255
     */
    inline void setBrightness(uint8_t brightness) {
        u8g2.setContrast(brightness);
    }

    // ========================================================================
    // Basic Drawing Utilities
    // ========================================================================

    /**
     * Clear the display buffer
     */
    inline void clearBuffer() {
        u8g2.clearBuffer();
    }

    /**
     * Send buffer to display
     */
    inline void sendBuffer() {
        u8g2.sendBuffer();
    }

    /**
     * Get text width for current font
     * @param text Text to measure
     * @return Width in pixels
     */
    inline int getTextWidth(const char* text) {
        return u8g2.getStrWidth(text);
    }

    /**
     * Draw text centered horizontally
     * @param y Y position
     * @param text Text to draw
     */
    inline void drawCenteredText(int y, const char* text) {
        int width = u8g2.getStrWidth(text);
        u8g2.drawStr((Layout::SCREEN_WIDTH - width) / 2, y, text);
    }

    /**
     * Draw text right-aligned
     * @param x Right edge X position
     * @param y Y position
     * @param text Text to draw
     */
    inline void drawRightAlignedText(int x, int y, const char* text) {
        int width = u8g2.getStrWidth(text);
        u8g2.drawStr(x - width, y, text);
    }

    /**
     * Fit text to width, truncating with ellipsis if needed
     * @param text Original text
     * @param maxWidth Maximum width in pixels
     * @param buffer Output buffer
     * @param bufferSize Buffer size
     */
    inline void fitTextToWidth(const char* text, int maxWidth, char* buffer, size_t bufferSize) {
        if (u8g2.getStrWidth(text) <= maxWidth) {
            Helpers::safeStrCopy(buffer, text, bufferSize);
            return;
        }

        // Truncate with ellipsis
        int ellipsisWidth = u8g2.getStrWidth("...");
        int targetWidth = maxWidth - ellipsisWidth;

        size_t len = strlen(text);
        for (size_t i = len; i > 0; i--) {
            char temp[128];
            strncpy(temp, text, i);
            temp[i] = '\0';
            if (u8g2.getStrWidth(temp) <= targetWidth) {
                snprintf(buffer, bufferSize, "%s...", temp);
                return;
            }
        }
        Helpers::safeStrCopy(buffer, "...", bufferSize);
    }

    // ========================================================================
    // Temperature Display Functions
    // ========================================================================

    /**
     * Get status indicator symbol
     * @param status Temperature status
     * @return Status string
     */
    inline const char* getStatusIndicator(TempStatus status) {
        switch (status) {
            case TempStatus::NORMAL:    return "OK";
            case TempStatus::WARNING:   return "WARN";
            case TempStatus::ALARM:     return "ALRM";
            case TempStatus::ERROR:     return "ERR";
            default:                    return "---";
        }
    }

    /**
     * Draw a temperature line with label, value, and status
     * @param y Y position
     * @param label Sensor label
     * @param temp Temperature value
     * @param status Temperature status
     * @param valid Whether reading is valid
     */
    inline void drawTemperatureLine(int y, const char* label, float temp,
                                    TempStatus status, bool valid) {
        char tempStr[16];
        char statusStr[8];

        // Draw label
        u8g2.setFont(FONT_NORMAL);
        u8g2.drawStr(Layout::MARGIN_LEFT, y, label);

        // Draw temperature value
        if (valid) {
            Helpers::formatTemperature(tempStr, sizeof(tempStr), temp, 1);
        } else {
            strcpy(tempStr, "---.-\xB0""C");
        }

        u8g2.setFont(FONT_BOLD);
        drawRightAlignedText(Layout::X_TEMP_VALUE + 50, y, tempStr);

        // Draw status indicator
        u8g2.setFont(FONT_SMALL);
        const char* statusText = getStatusIndicator(status);

        // Invert colors for warning/alarm
        if (status == TempStatus::ALARM) {
            int boxWidth = u8g2.getStrWidth(statusText) + 4;
            u8g2.drawBox(Layout::X_STATUS_ICON - 2, y - 9, boxWidth, 11);
            u8g2.setDrawColor(0);
            u8g2.drawStr(Layout::X_STATUS_ICON, y, statusText);
            u8g2.setDrawColor(1);
        } else if (status == TempStatus::WARNING) {
            int boxWidth = u8g2.getStrWidth(statusText) + 4;
            u8g2.drawFrame(Layout::X_STATUS_ICON - 2, y - 9, boxWidth, 11);
            u8g2.drawStr(Layout::X_STATUS_ICON, y, statusText);
        } else {
            u8g2.drawStr(Layout::X_STATUS_ICON, y, statusText);
        }
    }

    /**
     * Draw dual temperature display (main operating mode)
     * @param state Current display state
     */
    inline void drawTemperatureDisplay(const DisplayState& state) {
        // Header
        u8g2.setFont(FONT_HEADER);
        drawCenteredText(Layout::Y_HEADER, "01TR03 TRANSFORMER");

        // Horizontal separator
        u8g2.drawHLine(0, Layout::Y_HEADER + 3, Layout::SCREEN_WIDTH);

        // Main Tank Temperature
        drawTemperatureLine(
            Layout::Y_MAIN_TANK,
            "Main Tank:",
            state.mainTankTemp,
            state.mainTankStatus,
            state.mainTankStatus != TempStatus::ERROR
        );

        // Tap Changer Temperature
        drawTemperatureLine(
            Layout::Y_TAP_CHANGER,
            "Tap Changer:",
            state.tapChangerTemp,
            state.tapChangerStatus,
            state.tapChangerStatus != TempStatus::ERROR
        );

        // Bottom separator
        u8g2.drawHLine(0, Layout::Y_TAP_CHANGER + 5, Layout::SCREEN_WIDTH);
    }

    // ========================================================================
    // Status Bar Functions
    // ========================================================================

    /**
     * Draw WiFi signal strength indicator
     * @param x X position
     * @param y Y position (bottom of bars)
     * @param bars Number of bars (0-4)
     */
    inline void drawWiFiBars(int x, int y, int bars) {
        int barWidth = 3;
        int spacing = 1;
        int heights[] = {3, 5, 7, 9};

        for (int i = 0; i < 4; i++) {
            int barX = x + i * (barWidth + spacing);
            int barHeight = heights[i];
            int barY = y - barHeight;

            if (i < bars) {
                u8g2.drawBox(barX, barY, barWidth, barHeight);
            } else {
                u8g2.drawFrame(barX, barY, barWidth, barHeight);
            }
        }
    }

    /**
     * Draw status bar at bottom of display
     * @param state Current display state
     */
    inline void drawStatusBar(const DisplayState& state) {
        char timeStr[10];
        char statusStr[32];

        u8g2.setFont(FONT_SMALL);

        // WiFi status (left side)
        int wifiBars = Helpers::rssiToBars(state.wifiRSSI);
        if (state.wifiState == WiFiState::CONNECTED) {
            drawWiFiBars(Layout::MARGIN_LEFT, Layout::Y_STATUS_BAR, wifiBars);
        } else if (state.wifiState == WiFiState::AP_MODE) {
            u8g2.drawStr(Layout::MARGIN_LEFT, Layout::Y_STATUS_BAR, "AP");
        } else {
            drawWiFiBars(Layout::MARGIN_LEFT, Layout::Y_STATUS_BAR, 0);
        }

        // Cloud status
        int cloudX = 25;
        if (state.cloudConnected) {
            u8g2.drawStr(cloudX, Layout::Y_STATUS_BAR, "Cloud:OK");
        } else {
            u8g2.drawStr(cloudX, Layout::Y_STATUS_BAR, "Cloud:--");
        }

        // Time (center)
        if (state.timeValid) {
            Helpers::formatTime(timeStr, state.hours, state.minutes, state.seconds);
            drawCenteredText(Layout::Y_STATUS_BAR, timeStr);
        }

        // Ambient temperature (right side)
        char ambStr[16];
        snprintf(ambStr, sizeof(ambStr), "Amb:%.0f\xB0""C", state.ambientTemp);
        drawRightAlignedText(Layout::X_RIGHT_ALIGN, Layout::Y_STATUS_BAR, ambStr);
    }

    // ========================================================================
    // Setup Mode Display Functions
    // ========================================================================

    /**
     * Draw progress bar
     * @param progress Progress value (0-100)
     * @param message Status message
     */
    inline void drawProgressBar(int progress, const char* message) {
        // Clear and draw header
        u8g2.setFont(FONT_HEADER);
        drawCenteredText(Layout::Y_HEADER, "01TR03 SETUP");

        // Progress message
        u8g2.setFont(FONT_NORMAL);
        drawCenteredText(Layout::PROGRESS_BAR_Y - 5, message);

        // Progress bar outline
        u8g2.drawFrame(
            Layout::PROGRESS_BAR_X,
            Layout::PROGRESS_BAR_Y,
            Layout::PROGRESS_BAR_WIDTH,
            Layout::PROGRESS_BAR_HEIGHT
        );

        // Progress bar fill
        int fillWidth = (Layout::PROGRESS_BAR_WIDTH - 4) * progress / 100;
        if (fillWidth > 0) {
            u8g2.drawBox(
                Layout::PROGRESS_BAR_X + 2,
                Layout::PROGRESS_BAR_Y + 2,
                fillWidth,
                Layout::PROGRESS_BAR_HEIGHT - 4
            );
        }

        // Percentage text
        char percentStr[8];
        snprintf(percentStr, sizeof(percentStr), "%d%%", progress);
        drawCenteredText(Layout::PROGRESS_BAR_Y + Layout::PROGRESS_BAR_HEIGHT + 12, percentStr);
    }

    /**
     * Draw AP mode setup screen
     * @param ssid AP SSID
     * @param ip AP IP address
     */
    inline void drawAPModeScreen(const char* ssid, const char* ip) {
        u8g2.setFont(FONT_HEADER);
        drawCenteredText(Layout::Y_HEADER, "SETUP MODE");

        u8g2.setFont(FONT_NORMAL);
        drawCenteredText(26, "Connect to WiFi:");

        u8g2.setFont(FONT_BOLD);
        drawCenteredText(40, ssid);

        u8g2.setFont(FONT_NORMAL);
        char ipStr[32];
        snprintf(ipStr, sizeof(ipStr), "http://%s", ip);
        drawCenteredText(54, ipStr);
    }

    /**
     * Draw connecting screen
     * @param ssid WiFi SSID being connected to
     * @param attempt Current attempt number
     */
    inline void drawConnectingScreen(const char* ssid, int attempt) {
        u8g2.setFont(FONT_HEADER);
        drawCenteredText(Layout::Y_HEADER, "CONNECTING");

        u8g2.setFont(FONT_NORMAL);
        drawCenteredText(30, "WiFi Network:");

        u8g2.setFont(FONT_BOLD);
        char ssidDisplay[33];
        fitTextToWidth(ssid, 200, ssidDisplay, sizeof(ssidDisplay));
        drawCenteredText(44, ssidDisplay);

        u8g2.setFont(FONT_SMALL);
        char attemptStr[20];
        snprintf(attemptStr, sizeof(attemptStr), "Attempt %d...", attempt);
        drawCenteredText(58, attemptStr);
    }

    /**
     * Draw error screen
     * @param title Error title
     * @param message Error message
     */
    inline void drawErrorScreen(const char* title, const char* message) {
        u8g2.setFont(FONT_HEADER);
        drawCenteredText(Layout::Y_HEADER, title);

        u8g2.setFont(FONT_NORMAL);

        // Split message into multiple lines if needed
        char line1[64], line2[64];
        if (strlen(message) > 32) {
            strncpy(line1, message, 32);
            line1[32] = '\0';
            strcpy(line2, message + 32);
            drawCenteredText(35, line1);
            drawCenteredText(50, line2);
        } else {
            drawCenteredText(40, message);
        }
    }

    // ========================================================================
    // Main Render Function
    // ========================================================================

    /**
     * Main render function - call this in the display update loop
     * @param state Current display state
     */
    inline void render(const DisplayState& state) {
        clearBuffer();

        switch (state.systemMode) {
            case SystemMode::BOOTING:
                drawProgressBar(state.setupProgress, state.setupMessage);
                break;

            case SystemMode::SETUP_AP:
                drawAPModeScreen(state.setupSSID, state.setupIP);
                break;

            case SystemMode::CONNECTING:
                drawConnectingScreen(state.setupSSID, state.setupProgress);
                break;

            case SystemMode::RUNNING:
                drawTemperatureDisplay(state);
                drawStatusBar(state);
                break;

            case SystemMode::ERROR:
                drawErrorScreen("ERROR", state.setupMessage);
                break;
        }

        sendBuffer();
    }

    /**
     * Render with dirty flag check (optimization)
     * @param state Current display state
     * @return true if display was updated
     */
    inline bool renderIfNeeded(DisplayState& state) {
        if (!state.needsRedraw) {
            return false;
        }

        render(state);
        state.needsRedraw = false;
        return true;
    }

} // namespace Display

#endif // DISPLAY_FUNCTIONS_H
