-- Migration: Add support for 4 temperature sensors
-- Date: 2025-12-10
-- Description: Adds sensor_3 and sensor_4 temperature readings and configuration

-- ============================================================================
-- Temperature Readings - Add sensor 3 and 4 columns
-- ============================================================================

ALTER TABLE temperature_readings
ADD COLUMN IF NOT EXISTS sensor_3_temp DECIMAL(6,2);

ALTER TABLE temperature_readings
ADD COLUMN IF NOT EXISTS sensor_4_temp DECIMAL(6,2);

ALTER TABLE temperature_readings
ADD COLUMN IF NOT EXISTS sensor_3_status VARCHAR(20) DEFAULT 'normal';

ALTER TABLE temperature_readings
ADD COLUMN IF NOT EXISTS sensor_4_status VARCHAR(20) DEFAULT 'normal';

-- ============================================================================
-- Device Config - Add sensor enable flags
-- ============================================================================

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensors_enabled INTEGER DEFAULT 2;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_3_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_4_enabled BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- Device Config - Add sensor 3 thresholds
-- ============================================================================

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_3_warning DECIMAL(6,2) DEFAULT 70.0;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_3_alarm DECIMAL(6,2) DEFAULT 85.0;

-- ============================================================================
-- Device Config - Add sensor 4 thresholds
-- ============================================================================

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_4_warning DECIMAL(6,2) DEFAULT 70.0;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_4_alarm DECIMAL(6,2) DEFAULT 85.0;

-- ============================================================================
-- Device Config - Add sensor 3 and 4 labels
-- ============================================================================

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_3_label VARCHAR(100) DEFAULT 'Sensor 3';

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_4_label VARCHAR(100) DEFAULT 'Sensor 4';

-- ============================================================================
-- Device Config - Add sensor 3 and 4 gauge ranges
-- ============================================================================

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_3_min DECIMAL(6,2) DEFAULT 0;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_3_max DECIMAL(6,2) DEFAULT 120;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_4_min DECIMAL(6,2) DEFAULT 0;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_4_max DECIMAL(6,2) DEFAULT 120;

-- ============================================================================
-- Update existing rows with defaults (if any null values)
-- ============================================================================

UPDATE device_config SET
    sensors_enabled = COALESCE(sensors_enabled, 2),
    sensor_3_enabled = COALESCE(sensor_3_enabled, FALSE),
    sensor_4_enabled = COALESCE(sensor_4_enabled, FALSE),
    sensor_3_warning = COALESCE(sensor_3_warning, 70.0),
    sensor_3_alarm = COALESCE(sensor_3_alarm, 85.0),
    sensor_4_warning = COALESCE(sensor_4_warning, 70.0),
    sensor_4_alarm = COALESCE(sensor_4_alarm, 85.0),
    sensor_3_label = COALESCE(sensor_3_label, 'Sensor 3'),
    sensor_4_label = COALESCE(sensor_4_label, 'Sensor 4'),
    sensor_3_min = COALESCE(sensor_3_min, 0),
    sensor_3_max = COALESCE(sensor_3_max, 120),
    sensor_4_min = COALESCE(sensor_4_min, 0),
    sensor_4_max = COALESCE(sensor_4_max, 120);

-- ============================================================================
-- Update temperature readings with default status values
-- ============================================================================

UPDATE temperature_readings SET
    sensor_3_status = COALESCE(sensor_3_status, 'normal'),
    sensor_4_status = COALESCE(sensor_4_status, 'normal');

-- ============================================================================
-- Update threshold checking function for sensors 3 and 4
-- ============================================================================

CREATE OR REPLACE FUNCTION check_temperature_thresholds()
RETURNS TRIGGER AS $$
DECLARE
    config_rec device_config%ROWTYPE;
BEGIN
    -- Get device configuration
    SELECT * INTO config_rec FROM device_config WHERE device_id = NEW.device_id;

    IF config_rec IS NOT NULL THEN
        -- Check main tank temperature (Sensor 1)
        IF NEW.main_tank_temp IS NOT NULL THEN
            IF NEW.main_tank_temp >= config_rec.main_tank_alarm THEN
                NEW.main_tank_status := 'alarm';
                INSERT INTO alerts (device_id, alert_type, severity, message, value, threshold)
                VALUES (NEW.device_id, 'main_tank_high', 'critical',
                        'Main Tank temperature alarm: ' || NEW.main_tank_temp || '°C',
                        NEW.main_tank_temp, config_rec.main_tank_alarm);
            ELSIF NEW.main_tank_temp >= config_rec.main_tank_warning THEN
                NEW.main_tank_status := 'warning';
                INSERT INTO alerts (device_id, alert_type, severity, message, value, threshold)
                VALUES (NEW.device_id, 'main_tank_high', 'warning',
                        'Main Tank temperature warning: ' || NEW.main_tank_temp || '°C',
                        NEW.main_tank_temp, config_rec.main_tank_warning);
            ELSE
                NEW.main_tank_status := 'normal';
            END IF;
        END IF;

        -- Check tap changer temperature (Sensor 2)
        IF NEW.tap_changer_temp IS NOT NULL THEN
            IF NEW.tap_changer_temp >= config_rec.tap_changer_alarm THEN
                NEW.tap_changer_status := 'alarm';
                INSERT INTO alerts (device_id, alert_type, severity, message, value, threshold)
                VALUES (NEW.device_id, 'tap_changer_high', 'critical',
                        'Tap Changer temperature alarm: ' || NEW.tap_changer_temp || '°C',
                        NEW.tap_changer_temp, config_rec.tap_changer_alarm);
            ELSIF NEW.tap_changer_temp >= config_rec.tap_changer_warning THEN
                NEW.tap_changer_status := 'warning';
                INSERT INTO alerts (device_id, alert_type, severity, message, value, threshold)
                VALUES (NEW.device_id, 'tap_changer_high', 'warning',
                        'Tap Changer temperature warning: ' || NEW.tap_changer_temp || '°C',
                        NEW.tap_changer_temp, config_rec.tap_changer_warning);
            ELSE
                NEW.tap_changer_status := 'normal';
            END IF;
        END IF;

        -- Check sensor 3 temperature
        IF NEW.sensor_3_temp IS NOT NULL AND config_rec.sensor_3_enabled THEN
            IF NEW.sensor_3_temp >= config_rec.sensor_3_alarm THEN
                NEW.sensor_3_status := 'alarm';
                INSERT INTO alerts (device_id, alert_type, severity, message, value, threshold)
                VALUES (NEW.device_id, 'sensor_3_high', 'critical',
                        config_rec.sensor_3_label || ' temperature alarm: ' || NEW.sensor_3_temp || '°C',
                        NEW.sensor_3_temp, config_rec.sensor_3_alarm);
            ELSIF NEW.sensor_3_temp >= config_rec.sensor_3_warning THEN
                NEW.sensor_3_status := 'warning';
                INSERT INTO alerts (device_id, alert_type, severity, message, value, threshold)
                VALUES (NEW.device_id, 'sensor_3_high', 'warning',
                        config_rec.sensor_3_label || ' temperature warning: ' || NEW.sensor_3_temp || '°C',
                        NEW.sensor_3_temp, config_rec.sensor_3_warning);
            ELSE
                NEW.sensor_3_status := 'normal';
            END IF;
        END IF;

        -- Check sensor 4 temperature
        IF NEW.sensor_4_temp IS NOT NULL AND config_rec.sensor_4_enabled THEN
            IF NEW.sensor_4_temp >= config_rec.sensor_4_alarm THEN
                NEW.sensor_4_status := 'alarm';
                INSERT INTO alerts (device_id, alert_type, severity, message, value, threshold)
                VALUES (NEW.device_id, 'sensor_4_high', 'critical',
                        config_rec.sensor_4_label || ' temperature alarm: ' || NEW.sensor_4_temp || '°C',
                        NEW.sensor_4_temp, config_rec.sensor_4_alarm);
            ELSIF NEW.sensor_4_temp >= config_rec.sensor_4_warning THEN
                NEW.sensor_4_status := 'warning';
                INSERT INTO alerts (device_id, alert_type, severity, message, value, threshold)
                VALUES (NEW.device_id, 'sensor_4_high', 'warning',
                        config_rec.sensor_4_label || ' temperature warning: ' || NEW.sensor_4_temp || '°C',
                        NEW.sensor_4_temp, config_rec.sensor_4_warning);
            ELSE
                NEW.sensor_4_status := 'normal';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- Update get_latest_reading function for sensors 3 and 4
-- ============================================================================

DROP FUNCTION IF EXISTS get_latest_reading(VARCHAR);

CREATE OR REPLACE FUNCTION get_latest_reading(p_device_id VARCHAR)
RETURNS TABLE (
    main_tank_temp DECIMAL,
    tap_changer_temp DECIMAL,
    sensor_3_temp DECIMAL,
    sensor_4_temp DECIMAL,
    ambient_temp DECIMAL,
    main_tank_status VARCHAR,
    tap_changer_status VARCHAR,
    sensor_3_status VARCHAR,
    sensor_4_status VARCHAR,
    recorded_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        tr.main_tank_temp,
        tr.tap_changer_temp,
        tr.sensor_3_temp,
        tr.sensor_4_temp,
        tr.ambient_temp,
        tr.main_tank_status,
        tr.tap_changer_status,
        tr.sensor_3_status,
        tr.sensor_4_status,
        tr.recorded_at
    FROM temperature_readings tr
    WHERE tr.device_id = p_device_id
    ORDER BY tr.recorded_at DESC
    LIMIT 1;
END;
$$ language 'plpgsql';

-- ============================================================================
-- Update device_status view for sensors 3 and 4
-- ============================================================================

DROP VIEW IF EXISTS device_status;

CREATE OR REPLACE VIEW device_status AS
SELECT
    d.device_id,
    d.name,
    d.is_online,
    d.last_seen,
    tr.main_tank_temp,
    tr.tap_changer_temp,
    tr.sensor_3_temp,
    tr.sensor_4_temp,
    tr.main_tank_status,
    tr.tap_changer_status,
    tr.sensor_3_status,
    tr.sensor_4_status,
    tr.recorded_at as last_reading_at,
    (SELECT COUNT(*) FROM alerts a WHERE a.device_id = d.device_id AND a.acknowledged = false) as unacknowledged_alerts
FROM devices d
LEFT JOIN LATERAL (
    SELECT * FROM temperature_readings
    WHERE device_id = d.device_id
    ORDER BY recorded_at DESC
    LIMIT 1
) tr ON true;
