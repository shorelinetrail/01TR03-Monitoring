'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import TemperatureGauge from '@/components/TemperatureGauge';
import TemperatureChart from '@/components/TemperatureChart';
import ExportModal from '@/components/ExportModal';
import {
  supabase,
  TemperatureReading,
  Device,
  getLatestReading,
  getReadings,
  getReadingsByDateRange,
  getDevice,
  getDeviceConfig,
  subscribeToReadings,
} from '@/lib/supabase';
import { format } from 'date-fns';

const DEVICE_ID = process.env.NEXT_PUBLIC_DEVICE_ID || '01TR03';
const REFRESH_INTERVAL = 5000; // 5 seconds

// Default thresholds
const DEFAULT_THRESHOLDS = {
  mainTankWarning: 85,
  mainTankAlarm: 95,
  tapChangerWarning: 70,
  tapChangerAlarm: 85,
  differentialWarning: 15,
  differentialAlarm: 25,
};

// Default labels
const DEFAULT_LABELS = {
  mainTank: 'Main Tank',
  tapChanger: 'Tap Changer Cover',
  differential: 'Differential (Tank - Tap)',
};

// Default telegram settings
const DEFAULT_TELEGRAM = {
  enabled: false,
  botToken: '',
  chatId: '',
  alertOnWarning: false,
  alertOnAlarm: true,
  cooldownMinutes: 15,
};

// Default gauge ranges
const DEFAULT_RANGES = {
  mainTankMin: 0,
  mainTankMax: 120,
  tapChangerMin: 0,
  tapChangerMax: 120,
  differentialMin: -30,
  differentialMax: 30,
};

// Default chart settings
const DEFAULT_CHART = {
  yMin: null as number | null,
  yMax: null as number | null,
};

// Default display settings
const DEFAULT_DISPLAY = {
  title: '01TR03 Transformer Monitor',
  showDifferential: true,
};

// Convert time range to hours
const getHoursFromRange = (range: string): number => {
  switch (range) {
    case '1h': return 1;
    case '6h': return 6;
    case '24h': return 24;
    case '7d': return 168;
    default: return 24;
  }
};

export default function Dashboard() {
  const [device, setDevice] = useState<Device | null>(null);
  const [latestReading, setLatestReading] = useState<TemperatureReading | null>(null);
  const [historicalData, setHistoricalData] = useState<TemperatureReading[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [labels, setLabels] = useState(DEFAULT_LABELS);
  const [telegram, setTelegram] = useState(DEFAULT_TELEGRAM);
  const [ranges, setRanges] = useState(DEFAULT_RANGES);
  const [chart, setChart] = useState(DEFAULT_CHART);
  const [display, setDisplay] = useState(DEFAULT_DISPLAY);
  const [showExportModal, setShowExportModal] = useState(false);
  const [useCustomDateRange, setUseCustomDateRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return format(date, "yyyy-MM-dd'T'HH:mm");
  });
  const [customEndDate, setCustomEndDate] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));

  // Track last alert times to implement cooldown
  const lastAlertTimes = useRef<Record<string, number>>({});

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      // Fetch readings based on preset or custom date range
      const readingsPromise = useCustomDateRange
        ? getReadingsByDateRange(DEVICE_ID, new Date(customStartDate), new Date(customEndDate))
        : getReadings(DEVICE_ID, getHoursFromRange(timeRange));

      const [deviceData, configData, reading, readings] = await Promise.all([
        getDevice(DEVICE_ID),
        getDeviceConfig(DEVICE_ID),
        getLatestReading(DEVICE_ID),
        readingsPromise,
      ]);

      setDevice(deviceData);
      if (configData) {
        setThresholds({
          mainTankWarning: configData.main_tank_warning ?? DEFAULT_THRESHOLDS.mainTankWarning,
          mainTankAlarm: configData.main_tank_alarm ?? DEFAULT_THRESHOLDS.mainTankAlarm,
          tapChangerWarning: configData.tap_changer_warning ?? DEFAULT_THRESHOLDS.tapChangerWarning,
          tapChangerAlarm: configData.tap_changer_alarm ?? DEFAULT_THRESHOLDS.tapChangerAlarm,
          differentialWarning: configData.differential_warning ?? DEFAULT_THRESHOLDS.differentialWarning,
          differentialAlarm: configData.differential_alarm ?? DEFAULT_THRESHOLDS.differentialAlarm,
        });
        setLabels({
          mainTank: configData.main_tank_label ?? DEFAULT_LABELS.mainTank,
          tapChanger: configData.tap_changer_label ?? DEFAULT_LABELS.tapChanger,
          differential: configData.differential_label ?? DEFAULT_LABELS.differential,
        });
        setTelegram({
          enabled: configData.telegram_enabled ?? DEFAULT_TELEGRAM.enabled,
          botToken: configData.telegram_bot_token ?? DEFAULT_TELEGRAM.botToken,
          chatId: configData.telegram_chat_id ?? DEFAULT_TELEGRAM.chatId,
          alertOnWarning: configData.telegram_alert_on_warning ?? DEFAULT_TELEGRAM.alertOnWarning,
          alertOnAlarm: configData.telegram_alert_on_alarm ?? DEFAULT_TELEGRAM.alertOnAlarm,
          cooldownMinutes: configData.telegram_cooldown_minutes ?? DEFAULT_TELEGRAM.cooldownMinutes,
        });
        setRanges({
          mainTankMin: configData.main_tank_min ?? DEFAULT_RANGES.mainTankMin,
          mainTankMax: configData.main_tank_max ?? DEFAULT_RANGES.mainTankMax,
          tapChangerMin: configData.tap_changer_min ?? DEFAULT_RANGES.tapChangerMin,
          tapChangerMax: configData.tap_changer_max ?? DEFAULT_RANGES.tapChangerMax,
          differentialMin: configData.differential_min ?? DEFAULT_RANGES.differentialMin,
          differentialMax: configData.differential_max ?? DEFAULT_RANGES.differentialMax,
        });
        setChart({
          yMin: configData.chart_y_min ?? DEFAULT_CHART.yMin,
          yMax: configData.chart_y_max ?? DEFAULT_CHART.yMax,
        });
        setDisplay({
          title: configData.dashboard_title ?? DEFAULT_DISPLAY.title,
          showDifferential: configData.show_differential ?? DEFAULT_DISPLAY.showDifferential,
        });
      }
      setLatestReading(reading);
      setHistoricalData(readings);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch data from server');
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, useCustomDateRange, customStartDate, customEndDate]);

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

    return () => {
      supabase.removeChannel(readingsChannel);
    };
  }, []);

  // Evaluate status based on temperature and thresholds
  const getMainTankStatus = (): 'normal' | 'warning' | 'alarm' | 'offline' => {
    if (!device?.is_online || latestReading?.main_tank_temp === null || latestReading?.main_tank_temp === undefined) {
      return 'offline';
    }
    const temp = latestReading.main_tank_temp;
    if (temp >= thresholds.mainTankAlarm) return 'alarm';
    if (temp >= thresholds.mainTankWarning) return 'warning';
    return 'normal';
  };

  const getTapChangerStatus = (): 'normal' | 'warning' | 'alarm' | 'offline' => {
    if (!device?.is_online || latestReading?.tap_changer_temp === null || latestReading?.tap_changer_temp === undefined) {
      return 'offline';
    }
    const temp = latestReading.tap_changer_temp;
    if (temp >= thresholds.tapChangerAlarm) return 'alarm';
    if (temp >= thresholds.tapChangerWarning) return 'warning';
    return 'normal';
  };

  // Calculate temperature differential and status
  const getDifferential = (): number | null => {
    if (latestReading?.main_tank_temp === null || latestReading?.main_tank_temp === undefined ||
        latestReading?.tap_changer_temp === null || latestReading?.tap_changer_temp === undefined) {
      return null;
    }
    return latestReading.main_tank_temp - latestReading.tap_changer_temp;
  };

  const getDifferentialStatus = (): 'normal' | 'warning' | 'alarm' | 'offline' => {
    const diff = getDifferential();
    if (!device?.is_online || diff === null) {
      return 'offline';
    }
    const absDiff = Math.abs(diff);
    if (absDiff >= thresholds.differentialAlarm) return 'alarm';
    if (absDiff >= thresholds.differentialWarning) return 'warning';
    return 'normal';
  };

  // Generate client-side alerts based on current readings
  const getActiveAlerts = () => {
    const clientAlerts: Array<{ id: string; message: string; severity: 'warning' | 'critical' }> = [];

    if (latestReading && device?.is_online) {
      const mainTemp = latestReading.main_tank_temp;
      const tapTemp = latestReading.tap_changer_temp;

      if (mainTemp !== null && mainTemp >= thresholds.mainTankAlarm) {
        clientAlerts.push({
          id: 'main-tank-alarm',
          message: `${labels.mainTank} ALARM: ${mainTemp.toFixed(1)}°C (threshold: ${thresholds.mainTankAlarm}°C)`,
          severity: 'critical',
        });
      } else if (mainTemp !== null && mainTemp >= thresholds.mainTankWarning) {
        clientAlerts.push({
          id: 'main-tank-warning',
          message: `${labels.mainTank} WARNING: ${mainTemp.toFixed(1)}°C (threshold: ${thresholds.mainTankWarning}°C)`,
          severity: 'warning',
        });
      }

      if (tapTemp !== null && tapTemp >= thresholds.tapChangerAlarm) {
        clientAlerts.push({
          id: 'tap-changer-alarm',
          message: `${labels.tapChanger} ALARM: ${tapTemp.toFixed(1)}°C (threshold: ${thresholds.tapChangerAlarm}°C)`,
          severity: 'critical',
        });
      } else if (tapTemp !== null && tapTemp >= thresholds.tapChangerWarning) {
        clientAlerts.push({
          id: 'tap-changer-warning',
          message: `${labels.tapChanger} WARNING: ${tapTemp.toFixed(1)}°C (threshold: ${thresholds.tapChangerWarning}°C)`,
          severity: 'warning',
        });
      }

      // Differential alerts (only if differential gauge is shown)
      if (display.showDifferential) {
        const diff = getDifferential();
        if (diff !== null) {
          const absDiff = Math.abs(diff);
          if (absDiff >= thresholds.differentialAlarm) {
            clientAlerts.push({
              id: 'differential-alarm',
              message: `${labels.differential} ALARM: ${diff.toFixed(1)}°C (threshold: ±${thresholds.differentialAlarm}°C)`,
              severity: 'critical',
            });
          } else if (absDiff >= thresholds.differentialWarning) {
            clientAlerts.push({
              id: 'differential-warning',
              message: `${labels.differential} WARNING: ${diff.toFixed(1)}°C (threshold: ±${thresholds.differentialWarning}°C)`,
              severity: 'warning',
            });
          }
        }
      }
    }

    return clientAlerts;
  };

  // Send Telegram alert with cooldown
  const sendTelegramAlert = useCallback(async (alertId: string, message: string, severity: 'warning' | 'critical') => {
    if (!telegram.enabled || !telegram.botToken || !telegram.chatId) return;

    // Check if we should alert based on severity
    if (severity === 'warning' && !telegram.alertOnWarning) return;
    if (severity === 'critical' && !telegram.alertOnAlarm) return;

    // Check cooldown
    const now = Date.now();
    const lastTime = lastAlertTimes.current[alertId] || 0;
    const cooldownMs = telegram.cooldownMinutes * 60 * 1000;

    if (now - lastTime < cooldownMs) return;

    // Send the alert
    try {
      const severityEmoji = severity === 'critical' ? '🚨' : '⚠️';
      const formattedMessage = `${severityEmoji} <b>01TR03 ${severity.toUpperCase()}</b>\n\n${message}\n\n<i>${new Date().toLocaleString()}</i>`;

      const response = await fetch('/api/send-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: telegram.botToken,
          chatId: telegram.chatId,
          message: formattedMessage,
        }),
      });

      if (response.ok) {
        lastAlertTimes.current[alertId] = now;
      }
    } catch (err) {
      console.error('Failed to send Telegram alert:', err);
    }
  }, [telegram]);

  // Trigger Telegram alerts when active alerts change
  useEffect(() => {
    const alerts = getActiveAlerts();
    alerts.forEach((alert) => {
      sendTelegramAlert(alert.id, alert.message, alert.severity);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestReading, sendTelegramAlert]);

  const activeAlerts = getActiveAlerts();

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
              <h1 className="text-xl font-bold text-white">{display.title}</h1>
              <span className={`badge ${device?.is_online ? 'badge-normal' : 'badge-offline'}`}>
                {device?.is_online ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {activeAlerts.length > 0 && (
                <span className="badge badge-alarm alarm-pulse">
                  {activeAlerts.length} ACTIVE ALERT{activeAlerts.length > 1 ? 'S' : ''}
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
                label={labels.mainTank}
                value={latestReading?.main_tank_temp ?? null}
                status={getMainTankStatus()}
                warningThreshold={thresholds.mainTankWarning}
                alarmThreshold={thresholds.mainTankAlarm}
                minValue={ranges.mainTankMin}
                maxValue={ranges.mainTankMax}
                lastUpdate={latestReading?.recorded_at}
              />
            </div>
            <div className="card card-body">
              <TemperatureGauge
                label={labels.tapChanger}
                value={latestReading?.tap_changer_temp ?? null}
                status={getTapChangerStatus()}
                warningThreshold={thresholds.tapChangerWarning}
                alarmThreshold={thresholds.tapChangerAlarm}
                minValue={ranges.tapChangerMin}
                maxValue={ranges.tapChangerMax}
                lastUpdate={latestReading?.recorded_at}
              />
            </div>
            {display.showDifferential && (
              <div className="card card-body">
                <TemperatureGauge
                  label={labels.differential}
                  value={getDifferential()}
                  status={getDifferentialStatus()}
                  warningThreshold={thresholds.differentialWarning}
                  alarmThreshold={thresholds.differentialAlarm}
                  minValue={ranges.differentialMin}
                  maxValue={ranges.differentialMax}
                  lastUpdate={latestReading?.recorded_at}
                />
              </div>
            )}
          </div>
        </section>

        {/* Temperature Trend Chart */}
        <section className="mb-8">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                <h2 className="text-lg font-semibold text-white">Temperature Trend</h2>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                  title="Export data to CSV"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-2">
                  {(['1h', '6h', '24h', '7d'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => {
                        setTimeRange(range);
                        setUseCustomDateRange(false);
                      }}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        !useCustomDateRange && timeRange === range
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
                <span className="text-gray-500 text-sm">or</span>
                <div className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      setUseCustomDateRange(true);
                    }}
                    className="px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <span className="text-gray-400 text-sm">to</span>
                  <input
                    type="datetime-local"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      setUseCustomDateRange(true);
                    }}
                    className="px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
            <div className="card-body">
              <TemperatureChart
                data={historicalData}
                thresholds={thresholds}
                yAxisMin={chart.yMin}
                yAxisMax={chart.yMax}
              />
            </div>
          </div>
        </section>

        {/* Alerts Panel */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-white mb-4">Active Alerts</h2>
          <div className="card card-body">
            {activeAlerts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>No active alerts</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`border rounded-lg p-4 ${
                      alert.severity === 'critical'
                        ? 'border-red-500/30 bg-red-500/10 alarm-pulse'
                        : 'border-orange-500/30 bg-orange-500/10'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {alert.severity === 'critical' ? (
                          <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`badge ${
                            alert.severity === 'critical' ? 'badge-alarm' : 'badge-warning'
                          }`}>
                            {alert.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-300">{alert.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

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
          <p className="text-center">
            <Link href="/settings" className="text-primary-400 hover:text-primary-300 text-sm">
              Settings
            </Link>
          </p>
        </div>
      </footer>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        deviceId={DEVICE_ID}
        labels={labels}
      />
    </div>
  );
}
