-- Migration: Add per-sensor thermocouple types and Supabase settings to device_config
-- This allows configuring thermocouple type per sensor from the dashboard UI

-- Add per-sensor thermocouple type columns (K, J, T, N, S, E, B, R)
ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_1_thermocouple_type VARCHAR(10) DEFAULT 'K';

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_2_thermocouple_type VARCHAR(10) DEFAULT 'K';

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_3_thermocouple_type VARCHAR(10) DEFAULT 'K';

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS sensor_4_thermocouple_type VARCHAR(10) DEFAULT 'K';

-- Add Supabase settings columns
ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS supabase_url TEXT DEFAULT NULL;

ALTER TABLE device_config
ADD COLUMN IF NOT EXISTS supabase_key TEXT DEFAULT NULL;

-- Update existing records to have default thermocouple type
UPDATE device_config
SET sensor_1_thermocouple_type = 'K',
    sensor_2_thermocouple_type = 'K',
    sensor_3_thermocouple_type = 'K',
    sensor_4_thermocouple_type = 'K'
WHERE sensor_1_thermocouple_type IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN device_config.sensor_1_thermocouple_type IS 'Sensor 1 thermocouple type: K, J, T, N, S, E, B, R (for MCP9600)';
COMMENT ON COLUMN device_config.sensor_2_thermocouple_type IS 'Sensor 2 thermocouple type: K, J, T, N, S, E, B, R (for MCP9600)';
COMMENT ON COLUMN device_config.sensor_3_thermocouple_type IS 'Sensor 3 thermocouple type: K, J, T, N, S, E, B, R (for MCP9600)';
COMMENT ON COLUMN device_config.sensor_4_thermocouple_type IS 'Sensor 4 thermocouple type: K, J, T, N, S, E, B, R (for MCP9600)';
COMMENT ON COLUMN device_config.supabase_url IS 'Supabase project URL for device connection';
COMMENT ON COLUMN device_config.supabase_key IS 'Supabase anon key for device connection';
