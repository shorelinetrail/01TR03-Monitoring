-- Migration: Ensure all device_config columns exist
-- Date: 2025-12-13
-- Description: Comprehensive migration to ensure all required columns exist in device_config

-- ============================================================================
-- Display Settings
-- ============================================================================

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS dashboard_title TEXT DEFAULT 'Temperature Monitor';

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS show_differential BOOLEAN DEFAULT TRUE;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensors_enabled INTEGER DEFAULT 2;

-- ============================================================================
-- Sensor Enable Flags
-- ============================================================================

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_2_enabled BOOLEAN DEFAULT TRUE;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_3_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_4_enabled BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- Temperature Thresholds
-- ============================================================================

-- Sensor 1 (Main Tank)
ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS main_tank_warning DECIMAL(6,2) DEFAULT 85.0;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS main_tank_alarm DECIMAL(6,2) DEFAULT 95.0;

-- Sensor 2 (Tap Changer)
ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS tap_changer_warning DECIMAL(6,2) DEFAULT 70.0;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS tap_changer_alarm DECIMAL(6,2) DEFAULT 85.0;

-- Sensor 3
ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_3_warning DECIMAL(6,2) DEFAULT 70.0;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_3_alarm DECIMAL(6,2) DEFAULT 85.0;

-- Sensor 4
ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_4_warning DECIMAL(6,2) DEFAULT 70.0;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_4_alarm DECIMAL(6,2) DEFAULT 85.0;

-- Differential
ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS differential_warning DECIMAL(6,2) DEFAULT 15.0;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS differential_alarm DECIMAL(6,2) DEFAULT 25.0;

-- ============================================================================
-- Gauge Labels
-- ============================================================================

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS main_tank_label VARCHAR(100) DEFAULT 'Main Tank';

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS tap_changer_label VARCHAR(100) DEFAULT 'Tap Changer Cover';

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_3_label VARCHAR(100) DEFAULT 'Sensor 3';

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_4_label VARCHAR(100) DEFAULT 'Sensor 4';

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS differential_label VARCHAR(100) DEFAULT 'Differential (Tank - Tap)';

-- ============================================================================
-- Gauge Ranges
-- ============================================================================

-- Sensor 1 (Main Tank)
ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS main_tank_min DECIMAL(6,2) DEFAULT 0;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS main_tank_max DECIMAL(6,2) DEFAULT 120;

-- Sensor 2 (Tap Changer)
ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS tap_changer_min DECIMAL(6,2) DEFAULT 0;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS tap_changer_max DECIMAL(6,2) DEFAULT 120;

-- Sensor 3
ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_3_min DECIMAL(6,2) DEFAULT 0;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_3_max DECIMAL(6,2) DEFAULT 120;

-- Sensor 4
ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_4_min DECIMAL(6,2) DEFAULT 0;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_4_max DECIMAL(6,2) DEFAULT 120;

-- Differential
ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS differential_min DECIMAL(6,2) DEFAULT -30;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS differential_max DECIMAL(6,2) DEFAULT 30;

-- ============================================================================
-- Chart Settings
-- ============================================================================

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS chart_y_min DECIMAL(6,2) DEFAULT NULL;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS chart_y_max DECIMAL(6,2) DEFAULT NULL;

-- ============================================================================
-- Device Settings
-- ============================================================================

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS report_interval INTEGER DEFAULT 30;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS display_update_interval INTEGER DEFAULT 1000;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS display_brightness INTEGER DEFAULT 255;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS display_timeout INTEGER DEFAULT 0;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS wifi_ssid VARCHAR(100) DEFAULT NULL;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS ntp_server VARCHAR(200) DEFAULT 'pool.ntp.org';

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';

-- ============================================================================
-- Telegram Settings
-- ============================================================================

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS telegram_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT DEFAULT NULL;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(100) DEFAULT NULL;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS telegram_alert_on_warning BOOLEAN DEFAULT FALSE;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS telegram_alert_on_alarm BOOLEAN DEFAULT TRUE;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS telegram_cooldown_minutes INTEGER DEFAULT 15;

-- ============================================================================
-- Thermocouple Type Settings (per sensor)
-- ============================================================================

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_1_thermocouple_type VARCHAR(10) DEFAULT 'K';

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_2_thermocouple_type VARCHAR(10) DEFAULT 'K';

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_3_thermocouple_type VARCHAR(10) DEFAULT 'K';

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_4_thermocouple_type VARCHAR(10) DEFAULT 'K';

-- ============================================================================
-- Supabase Connection Settings (for firmware)
-- ============================================================================

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS supabase_url TEXT DEFAULT NULL;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS supabase_key TEXT DEFAULT NULL;

-- ============================================================================
-- Update existing rows with defaults (fill any null values)
-- ============================================================================

UPDATE device_config SET
    dashboard_title = COALESCE(dashboard_title, 'Temperature Monitor'),
    show_differential = COALESCE(show_differential, TRUE),
    sensors_enabled = COALESCE(sensors_enabled, 2),
    sensor_2_enabled = COALESCE(sensor_2_enabled, TRUE),
    sensor_3_enabled = COALESCE(sensor_3_enabled, FALSE),
    sensor_4_enabled = COALESCE(sensor_4_enabled, FALSE),
    main_tank_warning = COALESCE(main_tank_warning, 85.0),
    main_tank_alarm = COALESCE(main_tank_alarm, 95.0),
    tap_changer_warning = COALESCE(tap_changer_warning, 70.0),
    tap_changer_alarm = COALESCE(tap_changer_alarm, 85.0),
    sensor_3_warning = COALESCE(sensor_3_warning, 70.0),
    sensor_3_alarm = COALESCE(sensor_3_alarm, 85.0),
    sensor_4_warning = COALESCE(sensor_4_warning, 70.0),
    sensor_4_alarm = COALESCE(sensor_4_alarm, 85.0),
    differential_warning = COALESCE(differential_warning, 15.0),
    differential_alarm = COALESCE(differential_alarm, 25.0),
    main_tank_label = COALESCE(main_tank_label, 'Main Tank'),
    tap_changer_label = COALESCE(tap_changer_label, 'Tap Changer Cover'),
    sensor_3_label = COALESCE(sensor_3_label, 'Sensor 3'),
    sensor_4_label = COALESCE(sensor_4_label, 'Sensor 4'),
    differential_label = COALESCE(differential_label, 'Differential (Tank - Tap)'),
    main_tank_min = COALESCE(main_tank_min, 0),
    main_tank_max = COALESCE(main_tank_max, 120),
    tap_changer_min = COALESCE(tap_changer_min, 0),
    tap_changer_max = COALESCE(tap_changer_max, 120),
    sensor_3_min = COALESCE(sensor_3_min, 0),
    sensor_3_max = COALESCE(sensor_3_max, 120),
    sensor_4_min = COALESCE(sensor_4_min, 0),
    sensor_4_max = COALESCE(sensor_4_max, 120),
    differential_min = COALESCE(differential_min, -30),
    differential_max = COALESCE(differential_max, 30),
    report_interval = COALESCE(report_interval, 30),
    telegram_enabled = COALESCE(telegram_enabled, FALSE),
    telegram_alert_on_warning = COALESCE(telegram_alert_on_warning, FALSE),
    telegram_alert_on_alarm = COALESCE(telegram_alert_on_alarm, TRUE),
    telegram_cooldown_minutes = COALESCE(telegram_cooldown_minutes, 15),
    sensor_1_thermocouple_type = COALESCE(sensor_1_thermocouple_type, 'K'),
    sensor_2_thermocouple_type = COALESCE(sensor_2_thermocouple_type, 'K'),
    sensor_3_thermocouple_type = COALESCE(sensor_3_thermocouple_type, 'K'),
    sensor_4_thermocouple_type = COALESCE(sensor_4_thermocouple_type, 'K');
