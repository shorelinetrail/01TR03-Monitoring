-- Migration: Auto-update last_seen timestamp on devices table
-- This trigger automatically sets last_seen to current timestamp when device record is updated

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_device_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_seen = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_last_seen ON devices;

-- Create the trigger
CREATE TRIGGER trigger_update_last_seen
    BEFORE UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION update_device_last_seen();

-- Also update last_seen on insert
DROP TRIGGER IF EXISTS trigger_insert_last_seen ON devices;

CREATE TRIGGER trigger_insert_last_seen
    BEFORE INSERT ON devices
    FOR EACH ROW
    EXECUTE FUNCTION update_device_last_seen();
