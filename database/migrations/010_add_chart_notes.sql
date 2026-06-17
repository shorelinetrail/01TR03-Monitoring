-- Chart notes for annotating temperature trend data
-- Allows users to add timestamped notes to the chart, either general or sensor-specific

CREATE TABLE IF NOT EXISTS chart_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(50) NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  text TEXT NOT NULL,
  sensor VARCHAR(20) NOT NULL DEFAULT 'general' CHECK (sensor IN ('general', 'sensor1', 'sensor2', 'sensor3', 'sensor4')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying by device and time range
CREATE INDEX IF NOT EXISTS idx_chart_notes_device_timestamp
  ON chart_notes(device_id, timestamp);

-- Enable RLS
ALTER TABLE chart_notes ENABLE ROW LEVEL SECURITY;

-- Allow all operations (adjust based on your auth requirements)
CREATE POLICY "Allow all for chart_notes" ON chart_notes
  FOR ALL USING (true) WITH CHECK (true);
