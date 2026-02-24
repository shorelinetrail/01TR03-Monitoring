-- Migration: Add device_logs table for serial log storage
-- Logs are retained for 24 hours only

-- Device logs table (serial output from ESP32)
CREATE TABLE IF NOT EXISTS device_logs (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    level VARCHAR(10) NOT NULL DEFAULT 'INFO',  -- DEBUG, INFO, WARN, ERROR
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_logs_device
        FOREIGN KEY(device_id)
        REFERENCES devices(device_id)
        ON DELETE CASCADE
);

-- Index for efficient queries by device and time
CREATE INDEX idx_device_logs_device_time
    ON device_logs(device_id, created_at DESC);

-- Index for cleanup queries
CREATE INDEX idx_device_logs_created_at
    ON device_logs(created_at);

-- Enable RLS
ALTER TABLE device_logs ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (dashboard read access)
CREATE POLICY "Allow authenticated read access to device_logs"
    ON device_logs FOR SELECT
    TO authenticated
    USING (true);

-- Policies for service role (device write access)
CREATE POLICY "Allow service role full access to device_logs"
    ON device_logs FOR ALL
    TO service_role
    USING (true);

-- Policies for anon role (device can insert logs)
CREATE POLICY "Allow anon insert to device_logs"
    ON device_logs FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Allow anon read device_logs"
    ON device_logs FOR SELECT
    TO anon
    USING (true);

-- Function to clean up logs older than 24 hours
CREATE OR REPLACE FUNCTION cleanup_old_device_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM device_logs
    WHERE created_at < NOW() - INTERVAL '24 hours';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Comment on table
COMMENT ON TABLE device_logs IS 'Device serial logs with 24-hour retention';
COMMENT ON COLUMN device_logs.level IS 'Log level: DEBUG, INFO, WARN, ERROR';
