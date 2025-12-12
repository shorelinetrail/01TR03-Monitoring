-- 01TR03 Transformer Monitoring System
-- Supabase PostgreSQL Schema
-- Database schema for temperature monitoring and device management

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Device registration table
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL DEFAULT '01TR03',
    description TEXT,
    location VARCHAR(200),
    firmware_version VARCHAR(20),
    mac_address VARCHAR(17),
    ip_address VARCHAR(45),
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Temperature readings table (time-series data)
CREATE TABLE IF NOT EXISTS temperature_readings (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    main_tank_temp DECIMAL(6,2),
    tap_changer_temp DECIMAL(6,2),
    sensor_3_temp DECIMAL(6,2),
    sensor_4_temp DECIMAL(6,2),
    ambient_temp DECIMAL(6,2),
    main_tank_status VARCHAR(20) DEFAULT 'normal',
    tap_changer_status VARCHAR(20) DEFAULT 'normal',
    sensor_3_status VARCHAR(20) DEFAULT 'normal',
    sensor_4_status VARCHAR(20) DEFAULT 'normal',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_device
        FOREIGN KEY(device_id)
        REFERENCES devices(device_id)
        ON DELETE CASCADE
);

-- Alerts and alarms table
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(50) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',
    message TEXT NOT NULL,
    value DECIMAL(6,2),
    threshold DECIMAL(6,2),
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_alert_device
        FOREIGN KEY(device_id)
        REFERENCES devices(device_id)
        ON DELETE CASCADE
);

-- Device configuration table
CREATE TABLE IF NOT EXISTS device_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(50) UNIQUE NOT NULL,

    -- Display settings
    dashboard_title TEXT DEFAULT '01TR03 Transformer Monitor',
    show_differential BOOLEAN DEFAULT TRUE,
    sensors_enabled INTEGER DEFAULT 2,

    -- Sensor enable flags
    sensor_2_enabled BOOLEAN DEFAULT TRUE,
    sensor_3_enabled BOOLEAN DEFAULT FALSE,
    sensor_4_enabled BOOLEAN DEFAULT FALSE,

    -- Temperature thresholds (Celsius) - Sensor 1 (Main Tank)
    main_tank_warning DECIMAL(6,2) DEFAULT 85.0,
    main_tank_alarm DECIMAL(6,2) DEFAULT 95.0,

    -- Temperature thresholds (Celsius) - Sensor 2 (Tap Changer)
    tap_changer_warning DECIMAL(6,2) DEFAULT 70.0,
    tap_changer_alarm DECIMAL(6,2) DEFAULT 85.0,

    -- Temperature thresholds (Celsius) - Sensor 3
    sensor_3_warning DECIMAL(6,2) DEFAULT 70.0,
    sensor_3_alarm DECIMAL(6,2) DEFAULT 85.0,

    -- Temperature thresholds (Celsius) - Sensor 4
    sensor_4_warning DECIMAL(6,2) DEFAULT 70.0,
    sensor_4_alarm DECIMAL(6,2) DEFAULT 85.0,

    -- Differential thresholds
    differential_warning DECIMAL(6,2) DEFAULT 15.0,
    differential_alarm DECIMAL(6,2) DEFAULT 25.0,

    -- Gauge labels
    main_tank_label VARCHAR(100) DEFAULT 'Main Tank',
    tap_changer_label VARCHAR(100) DEFAULT 'Tap Changer Cover',
    sensor_3_label VARCHAR(100) DEFAULT 'Sensor 3',
    sensor_4_label VARCHAR(100) DEFAULT 'Sensor 4',
    differential_label VARCHAR(100) DEFAULT 'Differential (Tank - Tap)',

    -- Gauge ranges - Sensor 1 (Main Tank)
    main_tank_min DECIMAL(6,2) DEFAULT 0,
    main_tank_max DECIMAL(6,2) DEFAULT 120,

    -- Gauge ranges - Sensor 2 (Tap Changer)
    tap_changer_min DECIMAL(6,2) DEFAULT 0,
    tap_changer_max DECIMAL(6,2) DEFAULT 120,

    -- Gauge ranges - Sensor 3
    sensor_3_min DECIMAL(6,2) DEFAULT 0,
    sensor_3_max DECIMAL(6,2) DEFAULT 120,

    -- Gauge ranges - Sensor 4
    sensor_4_min DECIMAL(6,2) DEFAULT 0,
    sensor_4_max DECIMAL(6,2) DEFAULT 120,

    -- Gauge ranges - Differential
    differential_min DECIMAL(6,2) DEFAULT -30,
    differential_max DECIMAL(6,2) DEFAULT 30,

    -- Chart settings
    chart_y_min DECIMAL(6,2) DEFAULT NULL,
    chart_y_max DECIMAL(6,2) DEFAULT NULL,

    -- Reporting intervals (seconds)
    report_interval INTEGER DEFAULT 30,
    display_update_interval INTEGER DEFAULT 5,

    -- Display settings
    display_brightness INTEGER DEFAULT 255,
    display_timeout INTEGER DEFAULT 0,

    -- Network settings
    wifi_ssid VARCHAR(64),
    ntp_server VARCHAR(100) DEFAULT 'pool.ntp.org',
    timezone VARCHAR(50) DEFAULT 'UTC',

    -- Telegram alert settings
    telegram_enabled BOOLEAN DEFAULT FALSE,
    telegram_bot_token TEXT DEFAULT NULL,
    telegram_chat_id VARCHAR(100) DEFAULT NULL,
    telegram_alert_on_warning BOOLEAN DEFAULT FALSE,
    telegram_alert_on_alarm BOOLEAN DEFAULT TRUE,
    telegram_cooldown_minutes INTEGER DEFAULT 15,

    -- Per-sensor thermocouple types (K, J, T, N, S, E, B, R for MCP9600)
    sensor_1_thermocouple_type VARCHAR(10) DEFAULT 'K',
    sensor_2_thermocouple_type VARCHAR(10) DEFAULT 'K',
    sensor_3_thermocouple_type VARCHAR(10) DEFAULT 'K',
    sensor_4_thermocouple_type VARCHAR(10) DEFAULT 'K',

    -- Supabase connection settings (for device reference)
    supabase_url TEXT DEFAULT NULL,
    supabase_key TEXT DEFAULT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_config_device
        FOREIGN KEY(device_id)
        REFERENCES devices(device_id)
        ON DELETE CASCADE
);

-- Camera configuration table
CREATE TABLE IF NOT EXISTS cameras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    stream_url TEXT,
    snapshot_url TEXT,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for time-series queries on temperature readings
CREATE INDEX idx_temp_readings_device_time
    ON temperature_readings(device_id, recorded_at DESC);

-- Index for recent readings queries
CREATE INDEX idx_temp_readings_recorded_at
    ON temperature_readings(recorded_at DESC);

-- Index for alerts queries
CREATE INDEX idx_alerts_device_created
    ON alerts(device_id, created_at DESC);

CREATE INDEX idx_alerts_unacknowledged
    ON alerts(acknowledged, created_at DESC)
    WHERE acknowledged = FALSE;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to check temperature thresholds and create alerts
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

-- Function to get latest reading for a device
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

-- Function to get temperature statistics for a time period
CREATE OR REPLACE FUNCTION get_temperature_stats(
    p_device_id VARCHAR,
    p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
    sensor_name VARCHAR,
    min_temp DECIMAL,
    max_temp DECIMAL,
    avg_temp DECIMAL,
    reading_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        'main_tank'::VARCHAR as sensor_name,
        MIN(tr.main_tank_temp),
        MAX(tr.main_tank_temp),
        ROUND(AVG(tr.main_tank_temp), 2),
        COUNT(*)
    FROM temperature_readings tr
    WHERE tr.device_id = p_device_id
      AND tr.recorded_at >= NOW() - (p_hours || ' hours')::INTERVAL
    UNION ALL
    SELECT
        'tap_changer'::VARCHAR as sensor_name,
        MIN(tr.tap_changer_temp),
        MAX(tr.tap_changer_temp),
        ROUND(AVG(tr.tap_changer_temp), 2),
        COUNT(*)
    FROM temperature_readings tr
    WHERE tr.device_id = p_device_id
      AND tr.recorded_at >= NOW() - (p_hours || ' hours')::INTERVAL;
END;
$$ language 'plpgsql';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update updated_at on devices
CREATE TRIGGER update_devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on device_config
CREATE TRIGGER update_device_config_updated_at
    BEFORE UPDATE ON device_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on cameras
CREATE TRIGGER update_cameras_updated_at
    BEFORE UPDATE ON cameras
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to check temperature thresholds on new readings
CREATE TRIGGER check_temps_on_insert
    BEFORE INSERT ON temperature_readings
    FOR EACH ROW
    EXECUTE FUNCTION check_temperature_thresholds();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE temperature_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE cameras ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (dashboard access)
CREATE POLICY "Allow authenticated read access to devices"
    ON devices FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated read access to temperature_readings"
    ON temperature_readings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated read access to alerts"
    ON alerts FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated update alerts"
    ON alerts FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated read access to device_config"
    ON device_config FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated read access to cameras"
    ON cameras FOR SELECT
    TO authenticated
    USING (true);

-- Policies for service role (device API access)
CREATE POLICY "Allow service role full access to devices"
    ON devices FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Allow service role full access to temperature_readings"
    ON temperature_readings FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Allow service role full access to alerts"
    ON alerts FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Allow service role full access to device_config"
    ON device_config FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Allow service role full access to cameras"
    ON cameras FOR ALL
    TO service_role
    USING (true);

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default device
INSERT INTO devices (device_id, name, description, location)
VALUES ('01TR03', '01TR03 Transformer Monitor', '66/11kV 50MVA Power Transformer Temperature Monitoring', 'Substation')
ON CONFLICT (device_id) DO NOTHING;

-- Insert default configuration
INSERT INTO device_config (device_id, main_tank_warning, main_tank_alarm, tap_changer_warning, tap_changer_alarm)
VALUES ('01TR03', 85.0, 95.0, 70.0, 85.0)
ON CONFLICT (device_id) DO NOTHING;

-- Insert camera configurations
INSERT INTO cameras (camera_id, name, description)
VALUES
    ('CAM001', 'Oil & Winding Temperatures', 'Reolink DLP4K-UK monitoring oil and winding temperature gauges'),
    ('CAM002', 'Oil Level', 'Reolink DLP4K-UK monitoring oil level indicator')
ON CONFLICT (camera_id) DO NOTHING;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for current device status
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

-- ============================================================================
-- DATA RETENTION (Optional - run periodically)
-- ============================================================================

-- Function to clean up old readings (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_readings(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM temperature_readings
    WHERE recorded_at < NOW() - (days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Function to clean up old acknowledged alerts (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_alerts(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM alerts
    WHERE acknowledged = true
      AND acknowledged_at < NOW() - (days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language 'plpgsql';
