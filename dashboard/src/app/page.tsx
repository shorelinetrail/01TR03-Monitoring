'use client';

import React, { useEffect, useState, useCallback } from 'react';
import TemperatureGauge from '@/components/TemperatureGauge';
import TemperatureChart from '@/components/TemperatureChart';
import CameraFeed from '@/components/CameraFeed';
import AlertPanel from '@/components/AlertPanel';
import {
  supabase,
  TemperatureReading,
  Alert,
  Device,
  getLatestReading,
  getReadings,
  getUnacknowledgedAlerts,
  getDevice,
  subscribeToReadings,
  subscribeToAlerts,
} from '@/lib/supabase';

const DEVICE_ID = process.env.NEXT_PUBLIC_DEVICE_ID || '01TR03';
const REFRESH_INTERVAL = 5000; // 5 seconds

// Default thresholds
const DEFAULT_THRESHOLDS = {
  mainTankWarning: 85,
  mainTankAlarm: 95,
  tapChangerWarning: 70,
  tapChangerAlarm: 85,
};

export default function Dashboard() {
  const [device, setDevice] = useState<Device | null>(null);
  const [latestReading, setLatestReading] = useState<TemperatureReading | null>(null);
  const [historicalData, setHistoricalData] = useState<TemperatureReading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');

  const getHoursFromRange = (range: string): number => {
    switch (range) {
      case '1h': return 1;
      case '6h': return 6;
      case '24h': return 24;
      case '7d': return 168;
      default: return 24;
    }
  };

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      const [deviceData, reading, readings, alertsData] = await Promise.all([
        getDevice(DEVICE_ID),
        getLatestReading(DEVICE_ID),
        getReadings(DEVICE_ID, getHoursFromRange(timeRange)),
        getUnacknowledgedAlerts(DEVICE_ID),
      ]);

      setDevice(deviceData);
      setLatestReading(reading);
      setHistoricalData(readings);
      setAlerts(alertsData);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch data from server');
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  // Initial data fetch and polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Real-time subscriptions
  useEffect(() => {
    const readingsChannel = subscribeToReadings(DEVICE_ID, (newReading) => {
      setLatestReading(newReading);
      setHistoricalData((prev) => [...prev, newReading].slice(-1000));
      setLastUpdate(new Date());
    });

    const alertsChannel = subscribeToAlerts(DEVICE_ID, (newAlert) => {
      setAlerts((prev) => [newAlert, ...prev]);
    });

    return () => {
      supabase.removeChannel(readingsChannel);
      supabase.removeChannel(alertsChannel);
    };
  }, []);

  const handleAlertAcknowledge = (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  // Determine status from latest reading
  const getStatus = (status: string | undefined) => {
    if (!status || !device?.is_online) return 'offline';
    return status as 'normal' | 'warning' | 'alarm' | 'error';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-gray-900/50 border-b border-gray-800 sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-white">01TR03 Transformer Monitor</h1>
              <span className={`badge ${device?.is_online ? 'badge-normal' : 'badge-offline'}`}>
                {device?.is_online ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {alerts.length > 0 && (
                <span className="badge badge-alarm alarm-pulse">
                  {alerts.length} ACTIVE ALERT{alerts.length > 1 ? 'S' : ''}
                </span>
              )}
              {lastUpdate && (
                <span className="text-sm text-gray-400">
                  Updated: {lastUpdate.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/20 border-b border-red-500/30 px-4 py-2">
          <p className="text-red-400 text-center text-sm">{error}</p>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Temperature Gauges */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Current Temperatures</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="card card-body">
              <TemperatureGauge
                label="Main Tank"
                value={latestReading?.main_tank_temp ?? null}
                status={getStatus(latestReading?.main_tank_status)}
                warningThreshold={DEFAULT_THRESHOLDS.mainTankWarning}
                alarmThreshold={DEFAULT_THRESHOLDS.mainTankAlarm}
              />
            </div>
            <div className="card card-body">
              <TemperatureGauge
                label="Tap Changer Cover"
                value={latestReading?.tap_changer_temp ?? null}
                status={getStatus(latestReading?.tap_changer_status)}
                warningThreshold={DEFAULT_THRESHOLDS.tapChangerWarning}
                alarmThreshold={DEFAULT_THRESHOLDS.tapChangerAlarm}
              />
            </div>
            <div className="card card-body">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-4">Ambient</h3>
                <p className="text-4xl font-bold text-green-400">
                  {latestReading?.ambient_temp?.toFixed(1) ?? '---'}°C
                </p>
                <p className="text-gray-400 mt-2">Cold Junction Temperature</p>
              </div>
            </div>
          </div>
        </section>

        {/* Temperature Trend Chart */}
        <section className="mb-8">
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Temperature Trend</h2>
              <div className="flex gap-2">
                {(['1h', '6h', '24h', '7d'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      timeRange === range
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-body">
              <TemperatureChart
                data={historicalData}
                thresholds={DEFAULT_THRESHOLDS}
              />
            </div>
          </div>
        </section>

        {/* Camera Feeds and Alerts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Camera Feeds */}
          <section className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-white mb-4">Camera Feeds</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card card-body">
                <CameraFeed
                  name="Oil & Winding Temperatures"
                  description="Temperature gauge monitoring"
                  snapshotUrl={`/api/camera-snapshot?camera=1`}
                  refreshInterval={1000}
                />
              </div>
              <div className="card card-body">
                <CameraFeed
                  name="Oil Level"
                  description="Oil level indicator monitoring"
                  snapshotUrl={`/api/camera-snapshot?camera=2`}
                  refreshInterval={1000}
                />
              </div>
            </div>
          </section>

          {/* Alerts Panel */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">Active Alerts</h2>
            <div className="card card-body">
              <AlertPanel
                alerts={alerts}
                onAcknowledge={handleAlertAcknowledge}
              />
            </div>
          </section>
        </div>

        {/* Device Info */}
        <section className="mt-8">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-white">Device Information</h2>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Device ID</p>
                  <p className="text-white font-medium">{device?.device_id || DEVICE_ID}</p>
                </div>
                <div>
                  <p className="text-gray-400">Firmware</p>
                  <p className="text-white font-medium">{device?.firmware_version || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-gray-400">IP Address</p>
                  <p className="text-white font-medium">{device?.ip_address || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Last Seen</p>
                  <p className="text-white font-medium">
                    {device?.last_seen
                      ? new Date(device.last_seen).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900/50 border-t border-gray-800 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-500 text-sm">
            01TR03 Transformer Monitoring System | 66/11kV 50MVA Power Transformer
          </p>
        </div>
      </footer>
    </div>
  );
}
