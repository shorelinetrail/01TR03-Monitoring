-- Migration: Add write permissions for device_config
-- Date: 2025-12-13
-- Description: Allow anon and authenticated users to insert/update device_config

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow anon read access to device_config" ON device_config;
DROP POLICY IF EXISTS "Allow anon insert access to device_config" ON device_config;
DROP POLICY IF EXISTS "Allow anon update access to device_config" ON device_config;
DROP POLICY IF EXISTS "Allow authenticated insert access to device_config" ON device_config;
DROP POLICY IF EXISTS "Allow authenticated update access to device_config" ON device_config;

-- Allow anon users to read device_config (for public dashboard access)
CREATE POLICY "Allow anon read access to device_config"
    ON device_config FOR SELECT
    TO anon
    USING (true);

-- Allow anon users to insert device_config
CREATE POLICY "Allow anon insert access to device_config"
    ON device_config FOR INSERT
    TO anon
    WITH CHECK (true);

-- Allow anon users to update device_config
CREATE POLICY "Allow anon update access to device_config"
    ON device_config FOR UPDATE
    TO anon
    USING (true);

-- Allow authenticated users to insert device_config
CREATE POLICY "Allow authenticated insert access to device_config"
    ON device_config FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to update device_config
CREATE POLICY "Allow authenticated update access to device_config"
    ON device_config FOR UPDATE
    TO authenticated
    USING (true);
