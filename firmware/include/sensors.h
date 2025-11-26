#ifndef SENSORS_H
#define SENSORS_H

#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include "config.h"
#include "types.h"
#include "constants.h"
#include "helpers.h"

// Conditional includes based on sensor type
#ifdef USE_MCP9600_SENSORS
    #include <Adafruit_MCP9600.h>
#endif

#ifdef USE_MAX31855_SENSORS
    #include <Adafruit_MAX31855.h>
#endif

// ============================================================================
// 01TR03 Transformer Monitoring System - Sensor Functions
// Supports MCP9600 (I2C) and MAX31855 (SPI) Thermocouple Amplifiers
// ============================================================================

// Sensor instances - conditional on sensor type
#ifdef USE_MCP9600_SENSORS
    extern Adafruit_MCP9600 mcp9600_mainTank;
    extern Adafruit_MCP9600 mcp9600_tapChanger;
#endif

#ifdef USE_MAX31855_SENSORS
    extern Adafruit_MAX31855 max31855_mainTank;
    extern Adafruit_MAX31855 max31855_tapChanger;
#endif

// Configuration reference
extern DeviceConfig deviceConfig;

namespace Sensors {

    // ========================================================================
    // Common Functions
    // ========================================================================

    /**
     * Check temperature against thresholds and update status
     * @param reading Sensor reading to check
     * @param warningThreshold Warning threshold
     * @param alarmThreshold Alarm threshold
     */
    inline void checkThresholds(SensorReading& reading, float warningThreshold, float alarmThreshold) {
        if (!reading.valid) {
            reading.status = TempStatus::ERROR;
            return;
        }

        if (reading.temperature >= alarmThreshold) {
            reading.status = TempStatus::ALARM;
        } else if (reading.temperature >= warningThreshold) {
            reading.status = TempStatus::WARNING;
        } else {
            reading.status = TempStatus::NORMAL;
        }
    }

    // ========================================================================
    // MCP9600 (I2C) Functions
    // ========================================================================
#ifdef USE_MCP9600_SENSORS

    /**
     * Initialize the I2C bus
     * @return true if successful
     */
    inline bool initI2C() {
        Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
        Wire.setClock(100000);  // 100kHz for MCP9600 compatibility
        return true;
    }

    /**
     * Initialize a single MCP9600 sensor
     * @param sensor MCP9600 instance reference
     * @param address I2C address
     * @param name Sensor name for debug output
     * @return true if successful
     */
    inline bool initMCP9600(Adafruit_MCP9600& sensor, uint8_t address, const char* name) {
        DEBUG_PRINTF("Initializing MCP9600 (%s) at 0x%02X... ", name, address);

        if (!sensor.begin(address)) {
            DEBUG_PRINTLN("FAILED!");
            return false;
        }

        // Configure for Type J thermocouple
        sensor.setThermocoupleType(MCP9600_TYPE_J);

        // Set ADC resolution (18-bit for best accuracy)
        sensor.setADCresolution(MCP9600_ADCRESOLUTION_18);

        // Set filter coefficient (moderate filtering)
        sensor.setFilterCoefficient(4);

        DEBUG_PRINTLN("OK");
        return true;
    }

    /**
     * Read temperature from MCP9600
     * @param sensor MCP9600 instance
     * @param reading Output SensorReading struct
     * @return true if reading successful
     */
    inline bool readMCP9600(Adafruit_MCP9600& sensor, SensorReading& reading) {
        reading.timestamp = millis();
        reading.valid = false;

        // Read hot junction (thermocouple) temperature
        float temp = sensor.readThermocouple();

        // Validate reading
        if (!Helpers::isValidTemperature(temp, Temperature::MIN_VALID, Temperature::MAX_VALID)) {
            reading.status = TempStatus::ERROR;
            return false;
        }

        reading.temperature = temp;
        reading.coldJunction = sensor.readAmbient();
        reading.valid = true;
        reading.status = TempStatus::NORMAL;

        return true;
    }

    /**
     * Get MCP9600 sensor status string
     */
    inline void getMCP9600Status(Adafruit_MCP9600& sensor, char* buffer, size_t bufferSize) {
        float temp = sensor.readThermocouple();
        float ambient = sensor.readAmbient();

        if (Helpers::isValidTemperature(temp)) {
            snprintf(buffer, bufferSize, "T:%.1f°C A:%.1f°C", temp, ambient);
        } else {
            snprintf(buffer, bufferSize, "ERROR");
        }
    }

#endif // USE_MCP9600_SENSORS

    // ========================================================================
    // MAX31855 (SPI) Functions
    // ========================================================================
#ifdef USE_MAX31855_SENSORS

    /**
     * Initialize a single MAX31855 sensor
     * @param sensor MAX31855 instance reference
     * @param name Sensor name for debug output
     * @return true if successful
     */
    inline bool initMAX31855(Adafruit_MAX31855& sensor, const char* name) {
        DEBUG_PRINTF("Initializing MAX31855 (%s)... ", name);

        // Check if sensor responds
        double temp = sensor.readCelsius();
        if (isnan(temp)) {
            DEBUG_PRINTLN("FAILED!");
            return false;
        }

        DEBUG_PRINTLN("OK");
        return true;
    }

    /**
     * Read temperature from MAX31855
     * @param sensor MAX31855 instance
     * @param reading Output SensorReading struct
     * @return true if reading successful
     */
    inline bool readMAX31855(Adafruit_MAX31855& sensor, SensorReading& reading) {
        reading.timestamp = millis();
        reading.valid = false;

        // Read thermocouple temperature
        double temp = sensor.readCelsius();

        // Check for errors
        uint8_t error = sensor.readError();
        if (error) {
            DEBUG_PRINTF("MAX31855 error: %d\n", error);
            reading.status = TempStatus::ERROR;
            return false;
        }

        // Validate reading
        if (isnan(temp) || !Helpers::isValidTemperature((float)temp, Temperature::MIN_VALID, Temperature::MAX_VALID)) {
            reading.status = TempStatus::ERROR;
            return false;
        }

        reading.temperature = (float)temp;
        reading.coldJunction = (float)sensor.readInternal();
        reading.valid = true;
        reading.status = TempStatus::NORMAL;

        return true;
    }

    /**
     * Get MAX31855 sensor status string
     */
    inline void getMAX31855Status(Adafruit_MAX31855& sensor, char* buffer, size_t bufferSize) {
        double temp = sensor.readCelsius();
        double internal = sensor.readInternal();
        uint8_t error = sensor.readError();

        if (!error && !isnan(temp)) {
            snprintf(buffer, bufferSize, "T:%.1f°C A:%.1f°C", temp, internal);
        } else {
            snprintf(buffer, bufferSize, "ERROR (0x%02X)", error);
        }
    }

#endif // USE_MAX31855_SENSORS

    // ========================================================================
    // Unified Initialization
    // ========================================================================

    /**
     * Initialize all temperature sensors
     * @return true if at least one sensor initialized successfully
     */
    inline bool init() {
        DEBUG_PRINTLN("Initializing temperature sensors...");

        bool mainTankOk = false;
        bool tapChangerOk = false;

#ifdef USE_MCP9600_SENSORS
        DEBUG_PRINTLN("Sensor type: MCP9600 (I2C)");
        initI2C();
        mainTankOk = initMCP9600(mcp9600_mainTank, MCP9600_MAIN_TANK_ADDR, "Main Tank");
        tapChangerOk = initMCP9600(mcp9600_tapChanger, MCP9600_TAP_CHANGER_ADDR, "Tap Changer");
#endif

#ifdef USE_MAX31855_SENSORS
        DEBUG_PRINTLN("Sensor type: MAX31855 (SPI)");
        // SPI is initialized by the display, MAX31855 just needs CS pins
        mainTankOk = initMAX31855(max31855_mainTank, "Main Tank");
        tapChangerOk = initMAX31855(max31855_tapChanger, "Tap Changer");
#endif

        if (!mainTankOk && !tapChangerOk) {
            DEBUG_PRINTLN("ERROR: No sensors found!");
            return false;
        }

        DEBUG_PRINTLN("Sensor initialization complete.");
        return true;
    }

    // ========================================================================
    // Unified Read Functions
    // ========================================================================

    /**
     * Read all sensors and update temperature data
     * @param data Temperature data structure to update
     * @return true if at least one sensor read successfully
     */
    inline bool readAll(TemperatureData& data) {
        bool anySuccess = false;

#ifdef USE_MCP9600_SENSORS
        // Read Main Tank sensor
        if (readMCP9600(mcp9600_mainTank, data.mainTank)) {
            checkThresholds(
                data.mainTank,
                deviceConfig.mainTankWarning,
                deviceConfig.mainTankAlarm
            );
            anySuccess = true;
        }

        // Read Tap Changer sensor
        if (readMCP9600(mcp9600_tapChanger, data.tapChanger)) {
            checkThresholds(
                data.tapChanger,
                deviceConfig.tapChangerWarning,
                deviceConfig.tapChangerAlarm
            );
            anySuccess = true;
        }
#endif

#ifdef USE_MAX31855_SENSORS
        // Read Main Tank sensor
        if (readMAX31855(max31855_mainTank, data.mainTank)) {
            checkThresholds(
                data.mainTank,
                deviceConfig.mainTankWarning,
                deviceConfig.mainTankAlarm
            );
            anySuccess = true;
        }

        // Read Tap Changer sensor
        if (readMAX31855(max31855_tapChanger, data.tapChanger)) {
            checkThresholds(
                data.tapChanger,
                deviceConfig.tapChangerWarning,
                deviceConfig.tapChangerAlarm
            );
            anySuccess = true;
        }
#endif

        // Calculate ambient (average of cold junctions if both valid)
        if (data.mainTank.valid && data.tapChanger.valid) {
            data.ambientTemp = (data.mainTank.coldJunction + data.tapChanger.coldJunction) / 2.0f;
        } else if (data.mainTank.valid) {
            data.ambientTemp = data.mainTank.coldJunction;
        } else if (data.tapChanger.valid) {
            data.ambientTemp = data.tapChanger.coldJunction;
        }

        data.lastUpdate = millis();
        data.hasNewData = anySuccess;

        return anySuccess;
    }

    // ========================================================================
    // Diagnostic Functions
    // ========================================================================

#ifdef USE_MCP9600_SENSORS
    /**
     * Scan I2C bus for devices
     * @param foundAddresses Array to store found addresses
     * @param maxDevices Maximum devices to find
     * @return Number of devices found
     */
    inline int scanI2C(uint8_t* foundAddresses, int maxDevices) {
        int count = 0;
        DEBUG_PRINTLN("Scanning I2C bus...");

        for (uint8_t address = 1; address < 127 && count < maxDevices; address++) {
            Wire.beginTransmission(address);
            if (Wire.endTransmission() == 0) {
                DEBUG_PRINTF("  Found device at 0x%02X\n", address);
                foundAddresses[count++] = address;
            }
        }

        DEBUG_PRINTF("I2C scan complete. Found %d device(s).\n", count);
        return count;
    }
#endif

    /**
     * Print diagnostic information
     */
    inline void printDiagnostics() {
        DEBUG_PRINTLN("\n=== Sensor Diagnostics ===");

        char status[64];

#ifdef USE_MCP9600_SENSORS
        DEBUG_PRINTLN("Sensor Type: MCP9600 (I2C)");

        DEBUG_PRINT("Main Tank: ");
        getMCP9600Status(mcp9600_mainTank, status, sizeof(status));
        DEBUG_PRINTLN(status);

        DEBUG_PRINT("Tap Changer: ");
        getMCP9600Status(mcp9600_tapChanger, status, sizeof(status));
        DEBUG_PRINTLN(status);
#endif

#ifdef USE_MAX31855_SENSORS
        DEBUG_PRINTLN("Sensor Type: MAX31855 (SPI)");

        DEBUG_PRINT("Main Tank: ");
        getMAX31855Status(max31855_mainTank, status, sizeof(status));
        DEBUG_PRINTLN(status);

        DEBUG_PRINT("Tap Changer: ");
        getMAX31855Status(max31855_tapChanger, status, sizeof(status));
        DEBUG_PRINTLN(status);
#endif

        DEBUG_PRINTLN("========================\n");
    }

    /**
     * Get sensor type name string
     * @return Sensor type string
     */
    inline const char* getSensorTypeName() {
#ifdef USE_MCP9600_SENSORS
        return "MCP9600";
#endif
#ifdef USE_MAX31855_SENSORS
        return "MAX31855";
#endif
        return "Unknown";
    }

} // namespace Sensors

#endif // SENSORS_H
