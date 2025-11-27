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
  ambient_temp: number | null;
  main_tank_status: 'normal' | 'warning' | 'alarm' | 'error';
  tap_changer_status: 'normal' | 'warning' | 'alarm' | 'error';
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
  main_tank_warning: number;
  main_tank_alarm: number;
  tap_changer_warning: number;
  tap_changer_alarm: number;
  differential_warning: number;
  differential_alarm: number;
  main_tank_label: string;
  tap_changer_label: string;
  differential_label: string;
  // Gauge range settings
  main_tank_min: number;
  main_tank_max: number;
  tap_changer_min: number;
  tap_changer_max: number;
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
  hours: number = 24
): Promise<TemperatureReading[]> {
  const since = new Date();
  since.setHours(since.getHours() - hours);

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

export async function getReadingsByDateRange(
  deviceId: string,
  startDate: Date,
  endDate: Date
): Promise<TemperatureReading[]> {
  const { data, error } = await supabase
    .from('temperature_readings')
    .select('*')
    .eq('device_id', deviceId)
    .gte('recorded_at', startDate.toISOString())
    .lte('recorded_at', endDate.toISOString())
    .order('recorded_at', { ascending: true });

  if (error) {
    console.error('Error fetching readings by date range:', error);
    return [];
  }

  return data || [];
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
): Promise<boolean> {
  const { error } = await supabase
    .from('device_config')
    .update(config)
    .eq('device_id', deviceId);

  if (error) {
    console.error('Error updating device config:', error);
    return false;
  }

  return true;
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
