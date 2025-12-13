-- Migration: Add write permissions for devices table
-- Date: 2025-12-13
-- Description: Allow anon users to insert/update devices (needed for settings save)

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anon read access to devices" ON devices;
DROP POLICY IF EXISTS "Allow anon insert access to devices" ON devices;
DROP POLICY IF EXISTS "Allow anon update access to devices" ON devices;

-- Allow anon users to read devices
CREATE POLICY "Allow anon read access to devices"
    ON devices FOR SELECT
    TO anon
    USING (true);

-- Allow anon users to insert devices
CREATE POLICY "Allow anon insert access to devices"
    ON devices FOR INSERT
    TO anon
    WITH CHECK (true);

-- Allow anon users to update devices
CREATE POLICY "Allow anon update access to devices"
    ON devices FOR UPDATE
    TO anon
    USING (true);
