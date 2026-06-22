import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types based on database schema
export interface Device {
  id: string;
  device_id: string;
  name: string;
  description: string | null;
  location: string | null;
  firmware_version: string | null;
  mac_address: string | null;
  ip_address: string | null;
  is_online: boolean;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemperatureReading {
  id: number;
  device_id: string;
  main_tank_temp: number | null;
  tap_changer_temp: number | null;
  sensor_3_temp: number | null;
  sensor_4_temp: number | null;
  ambient_temp: number | null;
  main_tank_status: 'normal' | 'warning' | 'alarm' | 'error';
  tap_changer_status: 'normal' | 'warning' | 'alarm' | 'error';
  sensor_3_status: 'normal' | 'warning' | 'alarm' | 'error';
  sensor_4_status: 'normal' | 'warning' | 'alarm' | 'error';
  // Filtered temperature values (computed by DB trigger, null when filtering disabled)
  main_tank_temp_filtered: number | null;
  tap_changer_temp_filtered: number | null;
  sensor_3_temp_filtered: number | null;
  sensor_4_temp_filtered: number | null;
  recorded_at: string;
}

export interface Alert {
  id: string;
  device_id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: number | null;
  threshold: number | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface DeviceConfig {
  id: string;
  device_id: string;
  // Display settings
  dashboard_title: string | null;
  show_differential: boolean;
  sensors_enabled: number;
  sensor_1_alerts_enabled: boolean;
  sensor_2_alerts_enabled: boolean;
  sensor_3_alerts_enabled: boolean;
  sensor_4_alerts_enabled: boolean;
  differential_alerts_enabled: boolean;
  // Sensor enable flags
  sensor_2_enabled: boolean;
  sensor_3_enabled: boolean;
  sensor_4_enabled: boolean;
  // Sensor 1 (Main Tank) thresholds
  main_tank_warning: number;
  main_tank_alarm: number;
  // Sensor 2 (Tap Changer) thresholds
  tap_changer_warning: number;
  tap_changer_alarm: number;
  // Sensor 3 thresholds
  sensor_3_warning: number;
  sensor_3_alarm: number;
  // Sensor 4 thresholds
  sensor_4_warning: number;
  sensor_4_alarm: number;
  // Differential thresholds
  differential_warning: number;
  differential_alarm: number;
  // Gauge labels
  main_tank_label: string;
  tap_changer_label: string;
  sensor_3_label: string;
  sensor_4_label: string;
  differential_label: string;
  // Gauge range settings - Sensor 1 (Main Tank)
  main_tank_min: number;
  main_tank_max: number;
  // Gauge range settings - Sensor 2 (Tap Changer)
  tap_changer_min: number;
  tap_changer_max: number;
  // Gauge range settings - Sensor 3
  sensor_3_min: number;
  sensor_3_max: number;
  // Gauge range settings - Sensor 4
  sensor_4_min: number;
  sensor_4_max: number;
  // Gauge range settings - Differential
  differential_min: number;
  differential_max: number;
  // Chart settings
  chart_y_min: number | null;
  chart_y_max: number | null;
  report_interval: number;
  display_update_interval: number;
  display_brightness: number;
  display_timeout: number;
  wifi_ssid: string | null;
  ntp_server: string;
  timezone: string;
  // Telegram alert settings
  telegram_enabled: boolean;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  telegram_alert_on_warning: boolean;
  telegram_alert_on_alarm: boolean;
  telegram_cooldown_minutes: number;
  // Per-sensor thermocouple types (K, J, T, N, S, E, B, R for MCP9600)
  sensor_1_thermocouple_type: string;
  sensor_2_thermocouple_type: string;
  sensor_3_thermocouple_type: string;
  sensor_4_thermocouple_type: string;
  // Signal filtering settings
  filter_enabled: boolean;
  filter_type: string;
  filter_window: number;
  filter_alpha: number;
  // Supabase connection settings
  supabase_url: string | null;
  supabase_key: string | null;
  // Sensor display order (JSON array of sensor keys)
  sensor_order: string | null;
}

export interface Camera {
  id: string;
  camera_id: string;
  name: string;
  description: string | null;
  stream_url: string | null;
  snapshot_url: string | null;
  is_online: boolean;
  last_seen: string | null;
}

export interface DeviceLog {
  id: number;
  device_id: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  created_at: string;
}

export interface ChartNote {
  id: string;
  device_id: string;
  timestamp: string;
  text: string;
  sensor: 'general' | 'sensor1' | 'sensor2' | 'sensor3' | 'sensor4';
  created_at: string;
}

// Helper functions
export async function getLatestReading(deviceId: string): Promise<TemperatureReading | null> {
  const { data, error } = await supabase
    .from('temperature_readings')
    .select('*')
    .eq('device_id', deviceId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching latest reading:', error);
    return null;
  }

  return data;
}

export async function getReadings(
  deviceId: string,
  hours: number = 24,
  maxRows: number = 1500
): Promise<TemperatureReading[]> {
  const since = new Date();
  since.setHours(since.getHours() - hours);

  // For performance, limit total rows fetched
  // First, get a count to determine if we need sampling
  const { count } = await supabase
    .from('temperature_readings')
    .select('*', { count: 'exact', head: true })
    .eq('device_id', deviceId)
    .gte('recorded_at', since.toISOString());

  const totalRows = count || 0;

  // If data fits in maxRows, fetch all; otherwise fetch limited set
  if (totalRows <= maxRows) {
    const { data, error } = await supabase
      .from('temperature_readings')
      .select('*')
      .eq('device_id', deviceId)
      .gte('recorded_at', since.toISOString())
      .order('recorded_at', { ascending: true });

    if (error) {
      console.error('Error fetching readings:', error);
      return [];
    }
    return data || [];
  }

  // Too many rows - fetch evenly spaced samples by getting chunks
  // Fetch first chunk, last chunk, and samples from middle
  const chunkSize = Math.floor(maxRows / 3);
  const allData: TemperatureReading[] = [];

  // First chunk (oldest)
  const { data: firstChunk } = await supabase
    .from('temperature_readings')
    .select('*')
    .eq('device_id', deviceId)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: true })
    .limit(chunkSize);

  if (firstChunk) allData.push(...firstChunk);

  // Last chunk (newest)
  const { data: lastChunk } = await supabase
    .from('temperature_readings')
    .select('*')
    .eq('device_id', deviceId)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: false })
    .limit(chunkSize);

  if (lastChunk) allData.push(...lastChunk.reverse());

  // Middle samples - offset into the middle
  const middleOffset = Math.floor(totalRows / 2) - Math.floor(chunkSize / 2);
  const { data: middleChunk } = await supabase
    .from('temperature_readings')
    .select('*')
    .eq('device_id', deviceId)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: true })
    .range(middleOffset, middleOffset + chunkSize - 1);

  if (middleChunk) allData.push(...middleChunk);

  // Sort by time and dedupe
  const seen = new Set<number>();
  return allData
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
}

export async function getReadingsByDateRange(
  deviceId: string,
  startDate: Date,
  endDate: Date
): Promise<TemperatureReading[]> {
  const allData: TemperatureReading[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('temperature_readings')
      .select('*')
      .eq('device_id', deviceId)
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString())
      .order('recorded_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Error fetching readings by date range:', error);
      return allData;
    }

    if (data && data.length > 0) {
      allData.push(...data);
      offset += data.length;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

export async function getUnacknowledgedAlerts(deviceId: string): Promise<Alert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('device_id', deviceId)
    .eq('acknowledged', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching alerts:', error);
    return [];
  }

  return data || [];
}

export async function acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
  const { error } = await supabase
    .from('alerts')
    .update({
      acknowledged: true,
      acknowledged_by: acknowledgedBy,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', alertId);

  if (error) {
    console.error('Error acknowledging alert:', error);
    return false;
  }

  return true;
}

export async function getDevice(deviceId: string): Promise<Device | null> {
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .eq('device_id', deviceId)
    .single();

  if (error) {
    console.error('Error fetching device:', error);
    return null;
  }

  return data;
}

export async function getDeviceConfig(deviceId: string): Promise<DeviceConfig | null> {
  const { data, error } = await supabase
    .from('device_config')
    .select('*')
    .eq('device_id', deviceId)
    .single();

  if (error) {
    console.error('Error fetching device config:', error);
    return null;
  }

  return data;
}

export async function updateDeviceConfig(
  deviceId: string,
  config: Partial<DeviceConfig>
): Promise<{ success: boolean; error?: string }> {
  try {
    // First, ensure the device exists in the devices table (required for foreign key)
    const { error: deviceError } = await supabase
      .from('devices')
      .upsert(
        { device_id: deviceId, name: 'Temperature Monitor' },
        { onConflict: 'device_id', ignoreDuplicates: true }
      );

    if (deviceError) {
      console.error('Error ensuring device exists:', deviceError.message);
      // Continue anyway - device might already exist
    }

    // Remove any undefined values and id field (let DB handle it)
    const cleanConfig: Record<string, unknown> = { device_id: deviceId };
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined && key !== 'id') {
        cleanConfig[key] = value;
      }
    }

    console.log('Saving config for device:', deviceId);

    // Use upsert to insert if row doesn't exist, or update if it does
    const { data, error } = await supabase
      .from('device_config')
      .upsert(cleanConfig, { onConflict: 'device_id' })
      .select();

    if (error) {
      const errorMsg = `${error.message}${error.details ? ` - ${error.details}` : ''}${error.hint ? ` (${error.hint})` : ''}`;
      console.error('Error updating device config:', errorMsg);
      return { success: false, error: errorMsg };
    }

    console.log('Config saved successfully:', data);

    // Try to notify the device to refresh its config immediately
    try {
      const { data: deviceData } = await supabase
        .from('devices')
        .select('ip_address')
        .eq('device_id', deviceId)
        .single();

      if (deviceData?.ip_address) {
        console.log('Notifying device at', deviceData.ip_address);
        // Fire and forget - don't wait for response
        fetch(`http://${deviceData.ip_address}/refresh`, {
          method: 'GET',
          mode: 'no-cors', // Device might not have proper CORS
        }).catch(() => {
          // Ignore errors - device might be unreachable
          console.log('Could not reach device for immediate refresh');
        });
      }
    } catch {
      // Ignore - device notification is best-effort
    }

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Exception saving config:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

export async function getCameras(): Promise<Camera[]> {
  const { data, error } = await supabase
    .from('cameras')
    .select('*')
    .order('camera_id');

  if (error) {
    console.error('Error fetching cameras:', error);
    return [];
  }

  return data || [];
}

// Real-time subscription helper
// Subscribes to both INSERT and UPDATE events because the AFTER INSERT trigger
// performs an UPDATE to set filtered values after the row is inserted
export function subscribeToReadings(
  deviceId: string,
  callback: (reading: TemperatureReading) => void
) {
  return supabase
    .channel('temperature_readings')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'temperature_readings',
        filter: `device_id=eq.${deviceId}`,
      },
      (payload) => {
        callback(payload.new as TemperatureReading);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'temperature_readings',
        filter: `device_id=eq.${deviceId}`,
      },
      (payload) => {
        callback(payload.new as TemperatureReading);
      }
    )
    .subscribe();
}

export function subscribeToAlerts(
  deviceId: string,
  callback: (alert: Alert) => void
) {
  return supabase
    .channel('alerts')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'alerts',
        filter: `device_id=eq.${deviceId}`,
      },
      (payload) => {
        callback(payload.new as Alert);
      }
    )
    .subscribe();
}

// Device logs functions
export async function getDeviceLogs(
  deviceId: string,
  limit: number = 1000,
  level?: string
): Promise<DeviceLog[]> {
  let query = supabase
    .from('device_logs')
    .select('*')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (level && level !== 'ALL') {
    query = query.eq('level', level);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching device logs:', error);
    return [];
  }

  return data || [];
}

export function subscribeToDeviceLogs(
  deviceId: string,
  callback: (log: DeviceLog) => void
) {
  return supabase
    .channel('device_logs')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'device_logs',
        filter: `device_id=eq.${deviceId}`,
      },
      (payload) => {
        callback(payload.new as DeviceLog);
      }
    )
    .subscribe();
}

// Chart notes functions
export async function getChartNotes(
  deviceId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ChartNote[]> {
  let query = supabase
    .from('chart_notes')
    .select('*')
    .eq('device_id', deviceId)
    .order('timestamp', { ascending: true });

  if (startDate) {
    query = query.gte('timestamp', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('timestamp', endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching chart notes:', error);
    return [];
  }

  return data || [];
}

export async function createChartNote(
  deviceId: string,
  timestamp: Date,
  text: string,
  sensor: ChartNote['sensor'] = 'general'
): Promise<ChartNote | null> {
  const { data, error } = await supabase
    .from('chart_notes')
    .insert({
      device_id: deviceId,
      timestamp: timestamp.toISOString(),
      text,
      sensor,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating chart note:', error);
    return null;
  }

  return data;
}

export async function deleteChartNote(noteId: string): Promise<boolean> {
  const { error } = await supabase
    .from('chart_notes')
    .delete()
    .eq('id', noteId);

  if (error) {
    console.error('Error deleting chart note:', error);
    return false;
  }

  return true;
}

export async function updateChartNote(
  noteId: string,
  text: string,
  sensor: ChartNote['sensor']
): Promise<ChartNote | null> {
  const { data, error } = await supabase
    .from('chart_notes')
    .update({ text, sensor })
    .eq('id', noteId)
    .select()
    .single();

  if (error) {
    console.error('Error updating chart note:', error);
    return null;
  }

  return data;
}
