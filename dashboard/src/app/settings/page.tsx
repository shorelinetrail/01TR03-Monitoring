'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDeviceConfig, updateDeviceConfig } from '@/lib/supabase';

const DEVICE_ID = process.env.NEXT_PUBLIC_DEVICE_ID || '01TR03';

// Default settings
const DEFAULT_SETTINGS = {
  dashboard_title: '01TR03 Transformer Monitor',
  show_differential: true,
  sensors_enabled: 2,
  sensor_3_enabled: false,
  sensor_4_enabled: false,
  report_interval: 30,
  // Sensor thresholds
  main_tank_warning: 85,
  main_tank_alarm: 95,
  tap_changer_warning: 70,
  tap_changer_alarm: 85,
  sensor_3_warning: 70,
  sensor_3_alarm: 85,
  sensor_4_warning: 70,
  sensor_4_alarm: 85,
  differential_warning: 15,
  differential_alarm: 25,
  // Gauge labels
  main_tank_label: 'Main Tank',
  tap_changer_label: 'Tap Changer Cover',
  sensor_3_label: 'Sensor 3',
  sensor_4_label: 'Sensor 4',
  differential_label: 'Differential (Tank - Tap)',
  // Gauge ranges
  main_tank_min: 0,
  main_tank_max: 120,
  tap_changer_min: 0,
  tap_changer_max: 120,
  sensor_3_min: 0,
  sensor_3_max: 120,
  sensor_4_min: 0,
  sensor_4_max: 120,
  differential_min: -30,
  differential_max: 30,
  chart_y_min: null as number | null,
  chart_y_max: null as number | null,
  telegram_enabled: false,
  telegram_bot_token: '',
  telegram_chat_id: '',
  telegram_alert_on_warning: false,
  telegram_alert_on_alarm: true,
  telegram_cooldown_minutes: 15,
};

export default function Settings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load settings from Supabase on mount
  useEffect(() => {
    async function loadConfig() {
      const config = await getDeviceConfig(DEVICE_ID);
      if (config) {
        setSettings({
          dashboard_title: config.dashboard_title ?? DEFAULT_SETTINGS.dashboard_title,
          show_differential: config.show_differential ?? DEFAULT_SETTINGS.show_differential,
          sensors_enabled: config.sensors_enabled ?? DEFAULT_SETTINGS.sensors_enabled,
          sensor_3_enabled: config.sensor_3_enabled ?? DEFAULT_SETTINGS.sensor_3_enabled,
          sensor_4_enabled: config.sensor_4_enabled ?? DEFAULT_SETTINGS.sensor_4_enabled,
          report_interval: config.report_interval ?? DEFAULT_SETTINGS.report_interval,
          main_tank_warning: config.main_tank_warning ?? DEFAULT_SETTINGS.main_tank_warning,
          main_tank_alarm: config.main_tank_alarm ?? DEFAULT_SETTINGS.main_tank_alarm,
          tap_changer_warning: config.tap_changer_warning ?? DEFAULT_SETTINGS.tap_changer_warning,
          tap_changer_alarm: config.tap_changer_alarm ?? DEFAULT_SETTINGS.tap_changer_alarm,
          sensor_3_warning: config.sensor_3_warning ?? DEFAULT_SETTINGS.sensor_3_warning,
          sensor_3_alarm: config.sensor_3_alarm ?? DEFAULT_SETTINGS.sensor_3_alarm,
          sensor_4_warning: config.sensor_4_warning ?? DEFAULT_SETTINGS.sensor_4_warning,
          sensor_4_alarm: config.sensor_4_alarm ?? DEFAULT_SETTINGS.sensor_4_alarm,
          differential_warning: config.differential_warning ?? DEFAULT_SETTINGS.differential_warning,
          differential_alarm: config.differential_alarm ?? DEFAULT_SETTINGS.differential_alarm,
          main_tank_label: config.main_tank_label ?? DEFAULT_SETTINGS.main_tank_label,
          tap_changer_label: config.tap_changer_label ?? DEFAULT_SETTINGS.tap_changer_label,
          sensor_3_label: config.sensor_3_label ?? DEFAULT_SETTINGS.sensor_3_label,
          sensor_4_label: config.sensor_4_label ?? DEFAULT_SETTINGS.sensor_4_label,
          differential_label: config.differential_label ?? DEFAULT_SETTINGS.differential_label,
          main_tank_min: config.main_tank_min ?? DEFAULT_SETTINGS.main_tank_min,
          main_tank_max: config.main_tank_max ?? DEFAULT_SETTINGS.main_tank_max,
          tap_changer_min: config.tap_changer_min ?? DEFAULT_SETTINGS.tap_changer_min,
          tap_changer_max: config.tap_changer_max ?? DEFAULT_SETTINGS.tap_changer_max,
          sensor_3_min: config.sensor_3_min ?? DEFAULT_SETTINGS.sensor_3_min,
          sensor_3_max: config.sensor_3_max ?? DEFAULT_SETTINGS.sensor_3_max,
          sensor_4_min: config.sensor_4_min ?? DEFAULT_SETTINGS.sensor_4_min,
          sensor_4_max: config.sensor_4_max ?? DEFAULT_SETTINGS.sensor_4_max,
          differential_min: config.differential_min ?? DEFAULT_SETTINGS.differential_min,
          differential_max: config.differential_max ?? DEFAULT_SETTINGS.differential_max,
          chart_y_min: config.chart_y_min ?? DEFAULT_SETTINGS.chart_y_min,
          chart_y_max: config.chart_y_max ?? DEFAULT_SETTINGS.chart_y_max,
          telegram_enabled: config.telegram_enabled ?? DEFAULT_SETTINGS.telegram_enabled,
          telegram_bot_token: config.telegram_bot_token ?? DEFAULT_SETTINGS.telegram_bot_token,
          telegram_chat_id: config.telegram_chat_id ?? DEFAULT_SETTINGS.telegram_chat_id,
          telegram_alert_on_warning: config.telegram_alert_on_warning ?? DEFAULT_SETTINGS.telegram_alert_on_warning,
          telegram_alert_on_alarm: config.telegram_alert_on_alarm ?? DEFAULT_SETTINGS.telegram_alert_on_alarm,
          telegram_cooldown_minutes: config.telegram_cooldown_minutes ?? DEFAULT_SETTINGS.telegram_cooldown_minutes,
        });
      }
      setLoading(false);
    }
    loadConfig();
  }, []);

  const handleNumberChange = (field: keyof typeof settings, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setSettings((prev) => ({ ...prev, [field]: numValue }));
      setSaved(false);
    }
  };

  const handleTextChange = (field: keyof typeof settings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleBooleanChange = (field: keyof typeof settings, value: boolean) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleNullableNumberChange = (field: keyof typeof settings, value: string) => {
    if (value === '') {
      setSettings((prev) => ({ ...prev, [field]: null }));
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        setSettings((prev) => ({ ...prev, [field]: numValue }));
      }
    }
    setSaved(false);
  };

  const testTelegram = async () => {
    if (!settings.telegram_bot_token || !settings.telegram_chat_id) {
      setTelegramTestResult({ success: false, message: 'Please enter bot token and chat ID' });
      return;
    }

    setTestingTelegram(true);
    setTelegramTestResult(null);

    try {
      const response = await fetch('/api/send-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: settings.telegram_bot_token,
          chatId: settings.telegram_chat_id,
          message: `<b>01TR03 Test Alert</b>\n\nThis is a test message from your Transformer Monitoring System.\n\nIf you received this, Telegram alerts are working correctly!`,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTelegramTestResult({ success: true, message: 'Test message sent successfully!' });
      } else {
        setTelegramTestResult({ success: false, message: data.error || 'Failed to send test message' });
      }
    } catch {
      setTelegramTestResult({ success: false, message: 'Network error - check your connection' });
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const success = await updateDeviceConfig(DEVICE_ID, settings);
    setSaving(false);
    if (success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError('Failed to save settings');
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setSaved(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading settings...</p>
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
              <Link href="/" className="text-gray-400 hover:text-white">
                &larr; Back
              </Link>
              <h1 className="text-xl font-bold text-white">Settings</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Display Settings */}
        <section className="mb-8">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-white">Display Settings</h2>
              <p className="text-sm text-gray-400 mt-1">
                Configure dashboard title and visibility options.
              </p>
            </div>
            <div className="card-body space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Dashboard Title</label>
                <input
                  type="text"
                  value={settings.dashboard_title}
                  onChange={(e) => handleTextChange('dashboard_title', e.target.value)}
                  placeholder="01TR03 Transformer Monitor"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-white">Show Differential Gauge</label>
                  <p className="text-xs text-gray-500">Display the temperature differential gauge on the dashboard</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleBooleanChange('show_differential', !settings.show_differential)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.show_differential ? 'bg-primary-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.show_differential ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-white">Enable Sensor 3</label>
                  <p className="text-xs text-gray-500">Enable the third MCP9600 temperature sensor (I2C address 0x65)</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleBooleanChange('sensor_3_enabled', !settings.sensor_3_enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.sensor_3_enabled ? 'bg-primary-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.sensor_3_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-white">Enable Sensor 4</label>
                  <p className="text-xs text-gray-500">Enable the fourth MCP9600 temperature sensor (I2C address 0x67)</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleBooleanChange('sensor_4_enabled', !settings.sensor_4_enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.sensor_4_enabled ? 'bg-primary-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.sensor_4_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Device Settings */}
        <section className="mb-8">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-white">Device Settings</h2>
              <p className="text-sm text-gray-400 mt-1">
                Configure ESP32 device behavior.
              </p>
            </div>
            <div className="card-body space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Log Interval (seconds)</label>
                <input
                  type="number"
                  value={settings.report_interval}
                  onChange={(e) => handleNumberChange('report_interval', e.target.value)}
                  min="10"
                  max="3600"
                  className="w-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How often the device uploads temperature readings (10-3600 seconds). Device will apply on next restart.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Gauge Labels */}
        <section className="mb-8">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-white">Gauge Labels</h2>
              <p className="text-sm text-gray-400 mt-1">
                Customize the display labels for each gauge.
              </p>
            </div>
            <div className="card-body space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Sensor 1 Label (Main Tank)</label>
                <input
                  type="text"
                  value={settings.main_tank_label}
                  onChange={(e) => handleTextChange('main_tank_label', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Sensor 2 Label (Tap Changer)</label>
                <input
                  type="text"
                  value={settings.tap_changer_label}
                  onChange={(e) => handleTextChange('tap_changer_label', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                />
              </div>
              {settings.sensor_3_enabled && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Sensor 3 Label</label>
                  <input
                    type="text"
                    value={settings.sensor_3_label}
                    onChange={(e) => handleTextChange('sensor_3_label', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                  />
                </div>
              )}
              {settings.sensor_4_enabled && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Sensor 4 Label</label>
                  <input
                    type="text"
                    value={settings.sensor_4_label}
                    onChange={(e) => handleTextChange('sensor_4_label', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Differential Label</label>
                <input
                  type="text"
                  value={settings.differential_label}
                  onChange={(e) => handleTextChange('differential_label', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Gauge Ranges */}
        <section className="mb-8">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-white">Gauge Ranges</h2>
              <p className="text-sm text-gray-400 mt-1">
                Configure the minimum and maximum values displayed on each gauge.
              </p>
            </div>
            <div className="card-body space-y-6">
              {/* Main Tank Range */}
              <div>
                <h3 className="text-md font-medium text-white mb-3">{settings.main_tank_label}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Min (°C)</label>
                    <input
                      type="number"
                      value={settings.main_tank_min}
                      onChange={(e) => handleNumberChange('main_tank_min', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Max (°C)</label>
                    <input
                      type="number"
                      value={settings.main_tank_max}
                      onChange={(e) => handleNumberChange('main_tank_max', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Tap Changer Range */}
              <div>
                <h3 className="text-md font-medium text-white mb-3">{settings.tap_changer_label}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Min (°C)</label>
                    <input
                      type="number"
                      value={settings.tap_changer_min}
                      onChange={(e) => handleNumberChange('tap_changer_min', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Max (°C)</label>
                    <input
                      type="number"
                      value={settings.tap_changer_max}
                      onChange={(e) => handleNumberChange('tap_changer_max', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sensor 3 Range */}
              {settings.sensor_3_enabled && (
                <div>
                  <h3 className="text-md font-medium text-white mb-3">{settings.sensor_3_label}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Min (°C)</label>
                      <input
                        type="number"
                        value={settings.sensor_3_min}
                        onChange={(e) => handleNumberChange('sensor_3_min', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Max (°C)</label>
                      <input
                        type="number"
                        value={settings.sensor_3_max}
                        onChange={(e) => handleNumberChange('sensor_3_max', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Sensor 4 Range */}
              {settings.sensor_4_enabled && (
                <div>
                  <h3 className="text-md font-medium text-white mb-3">{settings.sensor_4_label}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Min (°C)</label>
                      <input
                        type="number"
                        value={settings.sensor_4_min}
                        onChange={(e) => handleNumberChange('sensor_4_min', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Max (°C)</label>
                      <input
                        type="number"
                        value={settings.sensor_4_max}
                        onChange={(e) => handleNumberChange('sensor_4_max', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Differential Range */}
              <div>
                <h3 className="text-md font-medium text-white mb-3">{settings.differential_label}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Min (°C)</label>
                    <input
                      type="number"
                      value={settings.differential_min}
                      onChange={(e) => handleNumberChange('differential_min', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Max (°C)</label>
                    <input
                      type="number"
                      value={settings.differential_max}
                      onChange={(e) => handleNumberChange('differential_max', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Chart Settings */}
        <section className="mb-8">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-white">Chart Settings</h2>
              <p className="text-sm text-gray-400 mt-1">
                Configure the temperature trend chart. Leave blank for auto-scaling.
              </p>
            </div>
            <div className="card-body">
              <h3 className="text-md font-medium text-white mb-3">Y-Axis Range</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Min (°C)</label>
                  <input
                    type="number"
                    value={settings.chart_y_min ?? ''}
                    onChange={(e) => handleNullableNumberChange('chart_y_min', e.target.value)}
                    placeholder="Auto"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Max (°C)</label>
                  <input
                    type="number"
                    value={settings.chart_y_max ?? ''}
                    onChange={(e) => handleNullableNumberChange('chart_y_max', e.target.value)}
                    placeholder="Auto"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Alarm Thresholds */}
        <section className="mb-8">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-white">Alarm Thresholds</h2>
              <p className="text-sm text-gray-400 mt-1">
                Configure warning and alarm temperature levels for each sensor.
              </p>
            </div>
            <div className="card-body space-y-6">
              {/* Main Tank */}
              <div>
                <h3 className="text-md font-medium text-white mb-3">{settings.main_tank_label}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Warning (°C)</label>
                    <input
                      type="number"
                      value={settings.main_tank_warning}
                      onChange={(e) => handleNumberChange('main_tank_warning', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Alarm (°C)</label>
                    <input
                      type="number"
                      value={settings.main_tank_alarm}
                      onChange={(e) => handleNumberChange('main_tank_alarm', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Tap Changer */}
              <div>
                <h3 className="text-md font-medium text-white mb-3">{settings.tap_changer_label}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Warning (°C)</label>
                    <input
                      type="number"
                      value={settings.tap_changer_warning}
                      onChange={(e) => handleNumberChange('tap_changer_warning', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Alarm (°C)</label>
                    <input
                      type="number"
                      value={settings.tap_changer_alarm}
                      onChange={(e) => handleNumberChange('tap_changer_alarm', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sensor 3 */}
              {settings.sensor_3_enabled && (
                <div>
                  <h3 className="text-md font-medium text-white mb-3">{settings.sensor_3_label}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Warning (°C)</label>
                      <input
                        type="number"
                        value={settings.sensor_3_warning}
                        onChange={(e) => handleNumberChange('sensor_3_warning', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Alarm (°C)</label>
                      <input
                        type="number"
                        value={settings.sensor_3_alarm}
                        onChange={(e) => handleNumberChange('sensor_3_alarm', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Sensor 4 */}
              {settings.sensor_4_enabled && (
                <div>
                  <h3 className="text-md font-medium text-white mb-3">{settings.sensor_4_label}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Warning (°C)</label>
                      <input
                        type="number"
                        value={settings.sensor_4_warning}
                        onChange={(e) => handleNumberChange('sensor_4_warning', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Alarm (°C)</label>
                      <input
                        type="number"
                        value={settings.sensor_4_alarm}
                        onChange={(e) => handleNumberChange('sensor_4_alarm', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Differential */}
              <div>
                <h3 className="text-md font-medium text-white mb-3">{settings.differential_label}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Warning (±°C)</label>
                    <input
                      type="number"
                      value={settings.differential_warning}
                      onChange={(e) => handleNumberChange('differential_warning', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Alarm (±°C)</label>
                    <input
                      type="number"
                      value={settings.differential_alarm}
                      onChange={(e) => handleNumberChange('differential_alarm', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Telegram Alerts */}
        <section className="mb-8">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-white">Telegram Alerts</h2>
              <p className="text-sm text-gray-400 mt-1">
                Receive instant alerts via Telegram when thresholds are exceeded.
              </p>
            </div>
            <div className="card-body space-y-4">
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-white">Enable Telegram Alerts</label>
                  <p className="text-xs text-gray-500">Send notifications when alerts are triggered</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleBooleanChange('telegram_enabled', !settings.telegram_enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.telegram_enabled ? 'bg-primary-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.telegram_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Bot Token */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Bot Token</label>
                <input
                  type="password"
                  value={settings.telegram_bot_token}
                  onChange={(e) => handleTextChange('telegram_bot_token', e.target.value)}
                  placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get this from @BotFather on Telegram
                </p>
              </div>

              {/* Chat ID */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Chat ID</label>
                <input
                  type="text"
                  value={settings.telegram_chat_id}
                  onChange={(e) => handleTextChange('telegram_chat_id', e.target.value)}
                  placeholder="-1001234567890 or 123456789"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your user ID or group chat ID (use @userinfobot to find it)
                </p>
              </div>

              {/* Alert levels */}
              <div className="space-y-3">
                <label className="block text-sm text-gray-400">Alert on:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="alert-warning"
                    checked={settings.telegram_alert_on_warning}
                    onChange={(e) => handleBooleanChange('telegram_alert_on_warning', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="alert-warning" className="text-sm text-white">Warning thresholds</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="alert-alarm"
                    checked={settings.telegram_alert_on_alarm}
                    onChange={(e) => handleBooleanChange('telegram_alert_on_alarm', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="alert-alarm" className="text-sm text-white">Alarm thresholds</label>
                </div>
              </div>

              {/* Cooldown */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Cooldown (minutes)</label>
                <input
                  type="number"
                  value={settings.telegram_cooldown_minutes}
                  onChange={(e) => handleNumberChange('telegram_cooldown_minutes', e.target.value)}
                  min="1"
                  max="60"
                  className="w-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimum time between alerts for the same condition (prevents spam)
                </p>
              </div>

              {/* Test button */}
              <div className="pt-4 border-t border-gray-700">
                <button
                  onClick={testTelegram}
                  disabled={testingTelegram || !settings.telegram_bot_token || !settings.telegram_chat_id}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded transition-colors"
                >
                  {testingTelegram ? 'Sending...' : 'Send Test Message'}
                </button>
                {telegramTestResult && (
                  <span className={`ml-3 text-sm ${telegramTestResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {telegramTestResult.message}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Save Section */}
        <section className="mb-8">
          <div className="card">
            <div className="card-body">
              {/* Error message */}
              {error && (
                <p className="text-red-400 text-sm mb-4">{error}</p>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 text-white rounded transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                >
                  Reset to Defaults
                </button>
                {saved && (
                  <span className="flex items-center text-green-400 text-sm">
                    Saved!
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
