-- Test Data
-- Run this in Supabase SQL Editor to insert test data

-- First ensure the device exists
INSERT INTO devices (device_id, name, description, location, is_online, last_seen)
VALUES ('DEVICE01', 'Temperature Monitor', 'Temperature Monitoring System', 'Location', true, NOW())
ON CONFLICT (device_id) DO UPDATE SET is_online = true, last_seen = NOW();

-- Ensure config exists
INSERT INTO device_config (device_id, main_tank_warning, main_tank_alarm, tap_changer_warning, tap_changer_alarm)
VALUES ('DEVICE01', 80.0, 95.0, 70.0, 85.0)
ON CONFLICT (device_id) DO NOTHING;

-- Insert 24 hours of test readings (every 5 minutes = 288 readings)
-- Simulates daily temperature cycle with load variation

INSERT INTO temperature_readings (device_id, main_tank_temp, tap_changer_temp, ambient_temp, main_tank_status, tap_changer_status, recorded_at)
SELECT
    'DEVICE01',
    -- Main tank: base 45°C, varies with time of day (higher during day), some noise
    ROUND((45 + 15 * SIN((EXTRACT(HOUR FROM ts) - 6) * PI() / 12) + (RANDOM() * 4 - 2))::numeric, 1),
    -- Tap changer: base 38°C, similar pattern but lower
    ROUND((38 + 10 * SIN((EXTRACT(HOUR FROM ts) - 6) * PI() / 12) + (RANDOM() * 3 - 1.5))::numeric, 1),
    -- Ambient: base 20°C, varies with time of day
    ROUND((20 + 8 * SIN((EXTRACT(HOUR FROM ts) - 6) * PI() / 12) + (RANDOM() * 2 - 1))::numeric, 1),
    'normal',
    'normal',
    ts
FROM generate_series(
    NOW() - INTERVAL '24 hours',
    NOW(),
    INTERVAL '5 minutes'
) AS ts;

-- Add a few warning readings (simulating high load period)
INSERT INTO temperature_readings (device_id, main_tank_temp, tap_changer_temp, ambient_temp, main_tank_status, tap_changer_status, recorded_at)
VALUES
    ('DEVICE01', 82.5, 68.2, 28.1, 'warning', 'normal', NOW() - INTERVAL '6 hours'),
    ('DEVICE01', 84.1, 71.5, 28.5, 'warning', 'warning', NOW() - INTERVAL '5 hours 55 minutes'),
    ('DEVICE01', 83.8, 70.2, 28.3, 'warning', 'warning', NOW() - INTERVAL '5 hours 50 minutes');

-- Verify data was inserted
SELECT
    COUNT(*) as total_readings,
    MIN(recorded_at) as earliest,
    MAX(recorded_at) as latest,
    ROUND(AVG(main_tank_temp)::numeric, 1) as avg_main_tank,
    ROUND(AVG(tap_changer_temp)::numeric, 1) as avg_tap_changer
FROM temperature_readings
WHERE device_id = 'DEVICE01';
