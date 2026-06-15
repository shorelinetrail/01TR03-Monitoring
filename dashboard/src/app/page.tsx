'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import TemperatureGauge from '@/components/TemperatureGauge';
import TemperatureChart from '@/components/TemperatureChart';
import ExportModal from '@/components/ExportModal';
import StatusDashboard from '@/components/StatusDashboard';
import ThemeToggle from '@/components/ThemeToggle';

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

const DEVICE_ID = process.env.NEXT_PUBLIC_DEVICE_ID || 'DEVICE01';
const REFRESH_INTERVAL = 5000; // 5 seconds

// Default thresholds
const DEFAULT_THRESHOLDS = {
  mainTankWarning: 85,
  mainTankAlarm: 95,
  tapChangerWarning: 70,
  tapChangerAlarm: 85,
  sensor3Warning: 70,
  sensor3Alarm: 85,
  sensor4Warning: 70,
  sensor4Alarm: 85,
  differentialWarning: 15,
  differentialAlarm: 25,
};

// Default labels
const DEFAULT_LABELS = {
  mainTank: 'Main Tank',
  tapChanger: 'Tap Changer Cover',
  sensor3: 'Sensor 3',
  sensor4: 'Sensor 4',
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
  sensor3Min: 0,
  sensor3Max: 120,
  sensor4Min: 0,
  sensor4Max: 120,
  differentialMin: -30,
  differentialMax: 30,
};

// Default chart settings
const DEFAULT_CHART = {
  yMin: null as number | null,
  yMax: null as number | null,
};

// Default filter settings
const DEFAULT_FILTER = {
  enabled: false,
  type: 'moving_average',
  window: 5,
  alpha: 0.3,
};

// Default display settings
const DEFAULT_DISPLAY = {
  title: 'Temperature Monitor',
  showDifferential: true,
  sensor2Enabled: true,
  sensor3Enabled: false,
  sensor4Enabled: false,
  sensor1ThermocoupleType: 'K',
  sensor2ThermocoupleType: 'K',
  sensor3ThermocoupleType: 'K',
  sensor4ThermocoupleType: 'K',
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
  const [filter, setFilter] = useState(DEFAULT_FILTER);
  const [reportInterval, setReportInterval] = useState(30); // Default 30 seconds
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
          sensor3Warning: configData.sensor_3_warning ?? DEFAULT_THRESHOLDS.sensor3Warning,
          sensor3Alarm: configData.sensor_3_alarm ?? DEFAULT_THRESHOLDS.sensor3Alarm,
          sensor4Warning: configData.sensor_4_warning ?? DEFAULT_THRESHOLDS.sensor4Warning,
          sensor4Alarm: configData.sensor_4_alarm ?? DEFAULT_THRESHOLDS.sensor4Alarm,
          differentialWarning: configData.differential_warning ?? DEFAULT_THRESHOLDS.differentialWarning,
          differentialAlarm: configData.differential_alarm ?? DEFAULT_THRESHOLDS.differentialAlarm,
        });
        setLabels({
          mainTank: configData.main_tank_label ?? DEFAULT_LABELS.mainTank,
          tapChanger: configData.tap_changer_label ?? DEFAULT_LABELS.tapChanger,
          sensor3: configData.sensor_3_label ?? DEFAULT_LABELS.sensor3,
          sensor4: configData.sensor_4_label ?? DEFAULT_LABELS.sensor4,
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
          sensor3Min: configData.sensor_3_min ?? DEFAULT_RANGES.sensor3Min,
          sensor3Max: configData.sensor_3_max ?? DEFAULT_RANGES.sensor3Max,
          sensor4Min: configData.sensor_4_min ?? DEFAULT_RANGES.sensor4Min,
          sensor4Max: configData.sensor_4_max ?? DEFAULT_RANGES.sensor4Max,
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
          sensor2Enabled: configData.sensor_2_enabled ?? DEFAULT_DISPLAY.sensor2Enabled,
          sensor3Enabled: configData.sensor_3_enabled ?? DEFAULT_DISPLAY.sensor3Enabled,
          sensor4Enabled: configData.sensor_4_enabled ?? DEFAULT_DISPLAY.sensor4Enabled,
          sensor1ThermocoupleType: configData.sensor_1_thermocouple_type ?? DEFAULT_DISPLAY.sensor1ThermocoupleType,
          sensor2ThermocoupleType: configData.sensor_2_thermocouple_type ?? DEFAULT_DISPLAY.sensor2ThermocoupleType,
          sensor3ThermocoupleType: configData.sensor_3_thermocouple_type ?? DEFAULT_DISPLAY.sensor3ThermocoupleType,
          sensor4ThermocoupleType: configData.sensor_4_thermocouple_type ?? DEFAULT_DISPLAY.sensor4ThermocoupleType,
        });
        setFilter({
          enabled: configData.filter_enabled ?? DEFAULT_FILTER.enabled,
          type: configData.filter_type ?? DEFAULT_FILTER.type,
          window: configData.filter_window ?? DEFAULT_FILTER.window,
          alpha: configData.filter_alpha ?? DEFAULT_FILTER.alpha,
        });
        setReportInterval(configData.report_interval ?? 30);
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
  // Handles both INSERT (new reading) and UPDATE (filtered values computed by trigger)
  useEffect(() => {
    const readingsChannel = subscribeToReadings(DEVICE_ID, (newReading) => {
      setLatestReading(newReading);
      setHistoricalData((prev) => {
        // Check if this reading already exists (UPDATE event for same row)
        const existingIndex = prev.findIndex(r => r.id === newReading.id);
        if (existingIndex >= 0) {
          // Replace the existing entry with the updated one (now has filtered values)
          const updated = [...prev];
          updated[existingIndex] = newReading;
          return updated;
        }
        // New reading (INSERT event) - append and trim
        return [...prev, newReading].slice(-1000);
      });
      setLastUpdate(new Date());
    });

    return () => {
      supabase.removeChannel(readingsChannel);
    };
  }, []);

  // Check if device is actually online based on last_seen timestamp
  const isDeviceOnline = (): boolean => {
    if (!device?.last_seen) return false;
    const lastSeenDate = new Date(device.last_seen);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
    // Consider offline if no update in last 5 minutes
    return diffMinutes < 5;
  };

  // Evaluate status based on temperature and thresholds
  const getMainTankStatus = (): 'normal' | 'warning' | 'alarm' | 'offline' => {
    if (!isDeviceOnline() || latestReading?.main_tank_temp === null || latestReading?.main_tank_temp === undefined) {
      return 'offline';
    }
    const temp = latestReading.main_tank_temp;
    if (temp >= thresholds.mainTankAlarm) return 'alarm';
    if (temp >= thresholds.mainTankWarning) return 'warning';
    return 'normal';
  };

  const getTapChangerStatus = (): 'normal' | 'warning' | 'alarm' | 'offline' => {
    if (!isDeviceOnline() || latestReading?.tap_changer_temp === null || latestReading?.tap_changer_temp === undefined) {
      return 'offline';
    }
    const temp = latestReading.tap_changer_temp;
    if (temp >= thresholds.tapChangerAlarm) return 'alarm';
    if (temp >= thresholds.tapChangerWarning) return 'warning';
    return 'normal';
  };

  const getSensor3Status = (): 'normal' | 'warning' | 'alarm' | 'offline' => {
    if (!isDeviceOnline() || latestReading?.sensor_3_temp === null || latestReading?.sensor_3_temp === undefined) {
      return 'offline';
    }
    const temp = latestReading.sensor_3_temp;
    if (temp >= thresholds.sensor3Alarm) return 'alarm';
    if (temp >= thresholds.sensor3Warning) return 'warning';
    return 'normal';
  };

  const getSensor4Status = (): 'normal' | 'warning' | 'alarm' | 'offline' => {
    if (!isDeviceOnline() || latestReading?.sensor_4_temp === null || latestReading?.sensor_4_temp === undefined) {
      return 'offline';
    }
    const temp = latestReading.sensor_4_temp;
    if (temp >= thresholds.sensor4Alarm) return 'alarm';
    if (temp >= thresholds.sensor4Warning) return 'warning';
    return 'normal';
  };

  // Get the display value for a sensor: filtered if available and enabled, raw otherwise
  const getDisplayTemp = (
    reading: TemperatureReading | null,
    sensor: 'main_tank' | 'tap_changer' | 'sensor_3' | 'sensor_4'
  ): number | null => {
    if (!reading) return null;
    if (filter.enabled) {
      const filteredKey = `${sensor}_temp_filtered` as keyof TemperatureReading;
      const filtered = reading[filteredKey] as number | null;
      if (filtered !== null) return filtered;
    }
    const rawKey = `${sensor}_temp` as keyof TemperatureReading;
    return reading[rawKey] as number | null;
  };

  // Calculate temperature differential and status
  const getDifferential = (): number | null => {
    const mainTemp = getDisplayTemp(latestReading, 'main_tank');
    const tapTemp = getDisplayTemp(latestReading, 'tap_changer');
    if (mainTemp === null || tapTemp === null) {
      return null;
    }
    return mainTemp - tapTemp;
  };

  const getDifferentialStatus = (): 'normal' | 'warning' | 'alarm' | 'offline' => {
    const diff = getDifferential();
    if (!isDeviceOnline() || diff === null) {
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

    if (latestReading && isDeviceOnline()) {
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

      // Sensor 2 (Tap Changer) alerts (only if sensor 2 is enabled)
      if (display.sensor2Enabled) {
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
      }

      // Sensor 3 alerts (only if sensor 3 is enabled)
      if (display.sensor3Enabled) {
        const sensor3Temp = latestReading.sensor_3_temp;
        if (sensor3Temp !== null && sensor3Temp >= thresholds.sensor3Alarm) {
          clientAlerts.push({
            id: 'sensor-3-alarm',
            message: `${labels.sensor3} ALARM: ${sensor3Temp.toFixed(1)}°C (threshold: ${thresholds.sensor3Alarm}°C)`,
            severity: 'critical',
          });
        } else if (sensor3Temp !== null && sensor3Temp >= thresholds.sensor3Warning) {
          clientAlerts.push({
            id: 'sensor-3-warning',
            message: `${labels.sensor3} WARNING: ${sensor3Temp.toFixed(1)}°C (threshold: ${thresholds.sensor3Warning}°C)`,
            severity: 'warning',
          });
        }
      }

      // Sensor 4 alerts (only if sensor 4 is enabled)
      if (display.sensor4Enabled) {
        const sensor4Temp = latestReading.sensor_4_temp;
        if (sensor4Temp !== null && sensor4Temp >= thresholds.sensor4Alarm) {
          clientAlerts.push({
            id: 'sensor-4-alarm',
            message: `${labels.sensor4} ALARM: ${sensor4Temp.toFixed(1)}°C (threshold: ${thresholds.sensor4Alarm}°C)`,
            severity: 'critical',
          });
        } else if (sensor4Temp !== null && sensor4Temp >= thresholds.sensor4Warning) {
          clientAlerts.push({
            id: 'sensor-4-warning',
            message: `${labels.sensor4} WARNING: ${sensor4Temp.toFixed(1)}°C (threshold: ${thresholds.sensor4Warning}°C)`,
            severity: 'warning',
          });
        }
      }

      // Differential alerts (only if differential gauge is shown and sensor 2 is enabled)
      if (display.showDifferential && display.sensor2Enabled) {
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
      const formattedMessage = `${severityEmoji} <b>${severity.toUpperCase()}</b>\n\n${message}\n\n<i>${new Date().toLocaleString()}</i>`;

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
    <div className="min-h-screen safe-top">
      {/* Header - Mobile Optimized */}
      <header className="bg-white/80 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Mobile: stacked layout, Desktop: horizontal */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 sm:py-0 sm:h-16 gap-1 sm:gap-4">
            <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
              <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">{display.title}</h1>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
              {activeAlerts.length > 0 && (
                <span className="badge badge-alarm alarm-pulse">
                  {activeAlerts.length} ALERT{activeAlerts.length > 1 ? 'S' : ''}
                </span>
              )}
              {lastUpdate && (
                <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {format(lastUpdate, 'HH:mm:ss')}
                </span>
              )}
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Status Dashboard Strip */}
      <StatusDashboard
        isOnline={isDeviceOnline()}
        lastSeen={device?.last_seen ?? null}
        sensorStatuses={{
          sensor1: {
            status: getMainTankStatus(),
            label: labels.mainTank,
            enabled: true,
          },
          sensor2: {
            status: getTapChangerStatus(),
            label: labels.tapChanger,
            enabled: display.sensor2Enabled,
          },
          sensor3: {
            status: getSensor3Status(),
            label: labels.sensor3,
            enabled: display.sensor3Enabled,
          },
          sensor4: {
            status: getSensor4Status(),
            label: labels.sensor4,
            enabled: display.sensor4Enabled,
          },
        }}
        alertCount={activeAlerts.length}
        hasAlarms={activeAlerts.some((a) => a.severity === 'critical')}
        lastReading={latestReading ? new Date(latestReading.recorded_at) : null}
        reportInterval={reportInterval}
      />

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/20 border-b border-red-500/30 px-4 py-2">
          <p className="text-red-400 text-center text-sm">{error}</p>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-8 safe-bottom">
        {/* Temperature Gauges */}
        <section id="gauges-section" className="mb-4 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 px-2 sm:px-0">Live Data</h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-6">
            <div className="card card-body">
              <TemperatureGauge
                label={labels.mainTank}
                value={getDisplayTemp(latestReading, 'main_tank')}
                status={getMainTankStatus()}
                warningThreshold={thresholds.mainTankWarning}
                alarmThreshold={thresholds.mainTankAlarm}
                minValue={ranges.mainTankMin}
                maxValue={ranges.mainTankMax}
                lastUpdate={latestReading?.recorded_at}
                thermocoupleType={display.sensor1ThermocoupleType}
              />
            </div>
            {display.sensor2Enabled && (
              <div className="card card-body">
                <TemperatureGauge
                  label={labels.tapChanger}
                  value={getDisplayTemp(latestReading, 'tap_changer')}
                  status={getTapChangerStatus()}
                  warningThreshold={thresholds.tapChangerWarning}
                  alarmThreshold={thresholds.tapChangerAlarm}
                  minValue={ranges.tapChangerMin}
                  maxValue={ranges.tapChangerMax}
                  lastUpdate={latestReading?.recorded_at}
                  thermocoupleType={display.sensor2ThermocoupleType}
                />
              </div>
            )}
            {display.sensor3Enabled && (
              <div className="card card-body">
                <TemperatureGauge
                  label={labels.sensor3}
                  value={getDisplayTemp(latestReading, 'sensor_3')}
                  status={getSensor3Status()}
                  warningThreshold={thresholds.sensor3Warning}
                  alarmThreshold={thresholds.sensor3Alarm}
                  minValue={ranges.sensor3Min}
                  maxValue={ranges.sensor3Max}
                  lastUpdate={latestReading?.recorded_at}
                  thermocoupleType={display.sensor3ThermocoupleType}
                />
              </div>
            )}
            {display.sensor4Enabled && (
              <div className="card card-body">
                <TemperatureGauge
                  label={labels.sensor4}
                  value={getDisplayTemp(latestReading, 'sensor_4')}
                  status={getSensor4Status()}
                  warningThreshold={thresholds.sensor4Warning}
                  alarmThreshold={thresholds.sensor4Alarm}
                  minValue={ranges.sensor4Min}
                  maxValue={ranges.sensor4Max}
                  lastUpdate={latestReading?.recorded_at}
                  thermocoupleType={display.sensor4ThermocoupleType}
                />
              </div>
            )}
            {display.showDifferential && display.sensor2Enabled && (
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
        <section className="mb-4 sm:mb-8">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Trend</h2>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded text-xs sm:text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  title="Export data to CSV"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span className="hidden sm:inline">Export</span>
                </button>
              </div>
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
                <div className="flex gap-1.5 sm:gap-2">
                  {(['1h', '6h', '24h', '7d'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => {
                        setTimeRange(range);
                        setUseCustomDateRange(false);
                      }}
                      className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 sm:py-1 rounded text-xs sm:text-sm transition-colors ${
                        !useCustomDateRange && timeRange === range
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
                <span className="hidden sm:inline text-gray-500 text-sm">or</span>
                <div className="hidden sm:flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      setUseCustomDateRange(true);
                    }}
                    className="px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <span className="text-gray-400 text-sm">to</span>
                  <input
                    type="datetime-local"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      setUseCustomDateRange(true);
                    }}
                    className="px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
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
                filterEnabled={filter.enabled}
                filterConfig={{
                  enabled: filter.enabled,
                  type: filter.type as 'moving_average' | 'exponential',
                  window: filter.window,
                  alpha: filter.alpha,
                }}
                sensors={{
                  sensor1: { enabled: true, label: labels.mainTank },
                  sensor2: { enabled: display.sensor2Enabled, label: labels.tapChanger },
                  sensor3: { enabled: display.sensor3Enabled, label: labels.sensor3 },
                  sensor4: { enabled: display.sensor4Enabled, label: labels.sensor4 },
                }}
              />
            </div>
          </div>
        </section>

        {/* Alerts Panel */}
        <section className="mt-4 sm:mt-8">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 px-2 sm:px-0">Active Alerts</h2>
          <div className="card card-body">
            {activeAlerts.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-gray-500">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm sm:text-base">No active alerts</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`border rounded-lg p-3 sm:p-4 ${
                      alert.severity === 'critical'
                        ? 'border-red-500/30 bg-red-500/10 alarm-pulse'
                        : 'border-orange-500/30 bg-orange-500/10'
                    }`}
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {alert.severity === 'critical' ? (
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
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
                        <p className="mt-1 text-xs sm:text-sm text-gray-300">{alert.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Device Info - Collapsible on mobile */}
        <section className="mt-4 sm:mt-8">
          <div className="card">
            <div className="card-header">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Device Information</h2>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                <div>
                  <p className="text-gray-400">Device ID</p>
                  <p className="text-gray-900 dark:text-white font-medium">{device?.device_id || DEVICE_ID}</p>
                </div>
                <div>
                  <p className="text-gray-400">Firmware</p>
                  <p className="text-gray-900 dark:text-white font-medium">{device?.firmware_version || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-gray-400">IP Address</p>
                  <p className="text-gray-900 dark:text-white font-medium truncate">{device?.ip_address || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Last Seen</p>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {device?.last_seen
                      ? format(new Date(device.last_seen), 'dd/MM HH:mm')
                      : 'Never'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer - Fixed on mobile for easy settings access */}
      <footer className="bg-gray-900/80 border-t border-gray-800 mt-4 sm:mt-8 sticky bottom-0 sm:relative backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-6">
          <p className="text-center flex items-center justify-center gap-4 sm:gap-6">
            <Link
              href="/logs"
              className="inline-flex items-center gap-2 text-primary-400 hover:text-primary-300 text-sm sm:text-base py-2 px-4"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Logs
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 text-primary-400 hover:text-primary-300 text-sm sm:text-base py-2 px-4"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
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
