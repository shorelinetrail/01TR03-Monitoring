'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDeviceConfig, updateDeviceConfig } from '@/lib/supabase';

const DEVICE_ID = process.env.NEXT_PUBLIC_DEVICE_ID || '01TR03';

// Default settings
const DEFAULT_SETTINGS = {
  main_tank_warning: 85,
  main_tank_alarm: 95,
  tap_changer_warning: 70,
  tap_changer_alarm: 85,
  differential_warning: 15,
  differential_alarm: 25,
  main_tank_label: 'Main Tank',
  tap_changer_label: 'Tap Changer Cover',
  differential_label: 'Differential (Tank - Tap)',
};

export default function Settings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load settings from Supabase on mount
  useEffect(() => {
    async function loadConfig() {
      const config = await getDeviceConfig(DEVICE_ID);
      if (config) {
        setSettings({
          main_tank_warning: config.main_tank_warning ?? DEFAULT_SETTINGS.main_tank_warning,
          main_tank_alarm: config.main_tank_alarm ?? DEFAULT_SETTINGS.main_tank_alarm,
          tap_changer_warning: config.tap_changer_warning ?? DEFAULT_SETTINGS.tap_changer_warning,
          tap_changer_alarm: config.tap_changer_alarm ?? DEFAULT_SETTINGS.tap_changer_alarm,
          differential_warning: config.differential_warning ?? DEFAULT_SETTINGS.differential_warning,
          differential_alarm: config.differential_alarm ?? DEFAULT_SETTINGS.differential_alarm,
          main_tank_label: config.main_tank_label ?? DEFAULT_SETTINGS.main_tank_label,
          tap_changer_label: config.tap_changer_label ?? DEFAULT_SETTINGS.tap_changer_label,
          differential_label: config.differential_label ?? DEFAULT_SETTINGS.differential_label,
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
                <label className="block text-sm text-gray-400 mb-1">Main Tank Label</label>
                <input
                  type="text"
                  value={settings.main_tank_label}
                  onChange={(e) => handleTextChange('main_tank_label', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tap Changer Label</label>
                <input
                  type="text"
                  value={settings.tap_changer_label}
                  onChange={(e) => handleTextChange('tap_changer_label', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                />
              </div>
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

              {/* Error message */}
              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-700">
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
