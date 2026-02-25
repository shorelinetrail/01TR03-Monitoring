-- Migration: Add configurable temperature signal filtering
-- Adds filtered temperature columns computed by a database trigger
-- Supports Moving Average and Exponential Smoothing algorithms

-- ============================================================================
-- Add filtered temperature columns to temperature_readings
-- ============================================================================

ALTER TABLE temperature_readings
ADD COLUMN IF NOT EXISTS main_tank_temp_filtered DECIMAL(6,2);

ALTER TABLE temperature_readings
ADD COLUMN IF NOT EXISTS tap_changer_temp_filtered DECIMAL(6,2);

ALTER TABLE temperature_readings
ADD COLUMN IF NOT EXISTS sensor_3_temp_filtered DECIMAL(6,2);

ALTER TABLE temperature_readings
ADD COLUMN IF NOT EXISTS sensor_4_temp_filtered DECIMAL(6,2);

-- ============================================================================
-- Add filter configuration columns to device_config
-- ============================================================================

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS filter_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS filter_type VARCHAR(20) DEFAULT 'moving_average';

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS filter_window INTEGER DEFAULT 5;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS filter_alpha DECIMAL(4,3) DEFAULT 0.3;

-- ============================================================================
-- Backfill existing device_config rows with defaults
-- ============================================================================

UPDATE device_config SET
    filter_enabled = COALESCE(filter_enabled, FALSE),
    filter_type = COALESCE(filter_type, 'moving_average'),
    filter_window = COALESCE(filter_window, 5),
    filter_alpha = COALESCE(filter_alpha, 0.3);

-- ============================================================================
-- Add constraints for filter parameters
-- ============================================================================

ALTER TABLE device_config DROP CONSTRAINT IF EXISTS check_filter_window;
ALTER TABLE device_config ADD CONSTRAINT check_filter_window CHECK (filter_window >= 2 AND filter_window <= 50);

ALTER TABLE device_config DROP CONSTRAINT IF EXISTS check_filter_alpha;
ALTER TABLE device_config ADD CONSTRAINT check_filter_alpha CHECK (filter_alpha >= 0.01 AND filter_alpha <= 1.0);

ALTER TABLE device_config DROP CONSTRAINT IF EXISTS check_filter_type;
ALTER TABLE device_config ADD CONSTRAINT check_filter_type CHECK (filter_type IN ('moving_average', 'exponential'));

-- ============================================================================
-- Signal filtering trigger function
-- Runs AFTER INSERT to compute filtered values from historical data
-- ============================================================================

CREATE OR REPLACE FUNCTION compute_filtered_temperatures()
RETURNS TRIGGER AS $$
DECLARE
    config_rec device_config%ROWTYPE;
    v_main_filtered DECIMAL(6,2);
    v_tap_filtered DECIMAL(6,2);
    v_s3_filtered DECIMAL(6,2);
    v_s4_filtered DECIMAL(6,2);
    v_prev_main DECIMAL(6,2);
    v_prev_tap DECIMAL(6,2);
    v_prev_s3 DECIMAL(6,2);
    v_prev_s4 DECIMAL(6,2);
BEGIN
    -- Get device configuration
    SELECT * INTO config_rec FROM device_config WHERE device_id = NEW.device_id;

    -- If no config or filtering disabled, leave filtered columns NULL
    IF config_rec IS NULL OR NOT config_rec.filter_enabled THEN
        RETURN NEW;
    END IF;

    IF config_rec.filter_type = 'moving_average' THEN
        -- Moving Average: average of the last N readings (including this one)
        -- Each sensor computed independently; NULL raw values are excluded from avg

        SELECT
            ROUND(AVG(main_tank_temp), 2),
            ROUND(AVG(tap_changer_temp), 2),
            ROUND(AVG(sensor_3_temp), 2),
            ROUND(AVG(sensor_4_temp), 2)
        INTO v_main_filtered, v_tap_filtered, v_s3_filtered, v_s4_filtered
        FROM (
            SELECT main_tank_temp, tap_changer_temp, sensor_3_temp, sensor_4_temp
            FROM temperature_readings
            WHERE device_id = NEW.device_id
            ORDER BY recorded_at DESC
            LIMIT config_rec.filter_window
        ) recent;

    ELSIF config_rec.filter_type = 'exponential' THEN
        -- Exponential Moving Average: alpha * current + (1 - alpha) * prev_filtered
        -- Get previous reading's filtered values (the most recent row before this one)

        SELECT
            main_tank_temp_filtered,
            tap_changer_temp_filtered,
            sensor_3_temp_filtered,
            sensor_4_temp_filtered
        INTO v_prev_main, v_prev_tap, v_prev_s3, v_prev_s4
        FROM temperature_readings
        WHERE device_id = NEW.device_id
          AND id != NEW.id
        ORDER BY recorded_at DESC
        LIMIT 1;

        -- Compute EMA for each sensor
        -- If no previous filtered value exists (first reading), seed with current raw
        IF NEW.main_tank_temp IS NOT NULL THEN
            v_main_filtered := ROUND(
                config_rec.filter_alpha * NEW.main_tank_temp
                + (1 - config_rec.filter_alpha) * COALESCE(v_prev_main, NEW.main_tank_temp),
                2
            );
        END IF;

        IF NEW.tap_changer_temp IS NOT NULL THEN
            v_tap_filtered := ROUND(
                config_rec.filter_alpha * NEW.tap_changer_temp
                + (1 - config_rec.filter_alpha) * COALESCE(v_prev_tap, NEW.tap_changer_temp),
                2
            );
        END IF;

        IF NEW.sensor_3_temp IS NOT NULL THEN
            v_s3_filtered := ROUND(
                config_rec.filter_alpha * NEW.sensor_3_temp
                + (1 - config_rec.filter_alpha) * COALESCE(v_prev_s3, NEW.sensor_3_temp),
                2
            );
        END IF;

        IF NEW.sensor_4_temp IS NOT NULL THEN
            v_s4_filtered := ROUND(
                config_rec.filter_alpha * NEW.sensor_4_temp
                + (1 - config_rec.filter_alpha) * COALESCE(v_prev_s4, NEW.sensor_4_temp),
                2
            );
        END IF;

    END IF;

    -- UPDATE the current row with computed filtered values
    UPDATE temperature_readings SET
        main_tank_temp_filtered = v_main_filtered,
        tap_changer_temp_filtered = v_tap_filtered,
        sensor_3_temp_filtered = v_s3_filtered,
        sensor_4_temp_filtered = v_s4_filtered
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AFTER INSERT trigger for temperature filtering
-- ============================================================================

DROP TRIGGER IF EXISTS compute_filtered_on_insert ON temperature_readings;

CREATE TRIGGER compute_filtered_on_insert
    AFTER INSERT ON temperature_readings
    FOR EACH ROW
    EXECUTE FUNCTION compute_filtered_temperatures();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN temperature_readings.main_tank_temp_filtered IS 'Filtered main tank temperature (computed by trigger)';
COMMENT ON COLUMN temperature_readings.tap_changer_temp_filtered IS 'Filtered tap changer temperature (computed by trigger)';
COMMENT ON COLUMN temperature_readings.sensor_3_temp_filtered IS 'Filtered sensor 3 temperature (computed by trigger)';
COMMENT ON COLUMN temperature_readings.sensor_4_temp_filtered IS 'Filtered sensor 4 temperature (computed by trigger)';

COMMENT ON COLUMN device_config.filter_enabled IS 'Enable signal filtering for temperature readings';
COMMENT ON COLUMN device_config.filter_type IS 'Filter algorithm: moving_average or exponential';
COMMENT ON COLUMN device_config.filter_window IS 'Window size for moving average filter (2-50)';
COMMENT ON COLUMN device_config.filter_alpha IS 'Smoothing factor for exponential filter (0.01-1.0)';
