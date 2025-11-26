/**
 * Minimal Display Test - 01TR03
 * Tests only the SSD1322 display with exact StationBoards config
 */

#include <Arduino.h>
#include <U8g2lib.h>

// Display - exact same as StationBoards
U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2(U8G2_R0, 5, 16, 17);

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n\n=== Display Test ===");
    Serial.println("Initializing display...");

    u8g2.begin();
    u8g2.setFont(u8g2_font_helvB08_tr);

    Serial.println("Display initialized.");
    Serial.println("Drawing test pattern...");

    // Draw something simple
    u8g2.clearBuffer();
    u8g2.drawStr(10, 30, "01TR03 Display Test");
    u8g2.drawStr(10, 50, "If you see this, it works!");
    u8g2.sendBuffer();

    Serial.println("Test pattern sent to display.");
    Serial.println("You should see text on the screen.");
}

void loop() {
    // Blink to show we're running
    static unsigned long lastBlink = 0;
    static bool state = false;

    if (millis() - lastBlink > 1000) {
        lastBlink = millis();
        state = !state;

        u8g2.clearBuffer();
        u8g2.drawStr(10, 30, "01TR03 Display Test");
        u8g2.drawStr(10, 50, state ? "* RUNNING *" : "  RUNNING  ");
        u8g2.sendBuffer();

        Serial.println(state ? "Tick" : "Tock");
    }
}
