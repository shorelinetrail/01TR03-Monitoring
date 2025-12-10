-- Migration: Add dashboard configuration columns to device_config
-- Date: 2025-12-10
-- Description: Adds display settings, gauge ranges, labels, chart settings, and Telegram alerts

-- ============================================================================
-- Display Settings
-- ============================================================================

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS dashboard_title TEXT DEFAULT '01TR03 Transformer Monitor';

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS show_differential BOOLEAN DEFAULT TRUE;

-- ============================================================================
-- Differential Thresholds
-- ============================================================================

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
ADD COLUMN IF NOT EXISTS differential_label VARCHAR(100) DEFAULT 'Differential (Tank - Tap)';

-- ============================================================================
-- Gauge Ranges
-- ============================================================================

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS main_tank_min DECIMAL(6,2) DEFAULT 0;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS main_tank_max DECIMAL(6,2) DEFAULT 120;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS tap_changer_min DECIMAL(6,2) DEFAULT 0;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS tap_changer_max DECIMAL(6,2) DEFAULT 120;

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
-- Telegram Alert Settings
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
-- Update existing rows with defaults (if any null values)
-- ============================================================================

UPDATE device_config SET
    dashboard_title = COALESCE(dashboard_title, '01TR03 Transformer Monitor'),
    show_differential = COALESCE(show_differential, TRUE),
    differential_warning = COALESCE(differential_warning, 15.0),
    differential_alarm = COALESCE(differential_alarm, 25.0),
    main_tank_label = COALESCE(main_tank_label, 'Main Tank'),
    tap_changer_label = COALESCE(tap_changer_label, 'Tap Changer Cover'),
    differential_label = COALESCE(differential_label, 'Differential (Tank - Tap)'),
    main_tank_min = COALESCE(main_tank_min, 0),
    main_tank_max = COALESCE(main_tank_max, 120),
    tap_changer_min = COALESCE(tap_changer_min, 0),
    tap_changer_max = COALESCE(tap_changer_max, 120),
    differential_min = COALESCE(differential_min, -30),
    differential_max = COALESCE(differential_max, 30),
    telegram_enabled = COALESCE(telegram_enabled, FALSE),
    telegram_alert_on_warning = COALESCE(telegram_alert_on_warning, FALSE),
    telegram_alert_on_alarm = COALESCE(telegram_alert_on_alarm, TRUE),
    telegram_cooldown_minutes = COALESCE(telegram_cooldown_minutes, 15);
