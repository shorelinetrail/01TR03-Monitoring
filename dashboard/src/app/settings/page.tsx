'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDeviceConfig, updateDeviceConfig, DeviceConfig } from '@/lib/supabase';

const DEVICE_ID = process.env.NEXT_PUBLIC_DEVICE_ID || '01TR03';

// Default thresholds
const DEFAULT_THRESHOLDS = {
  main_tank_warning: 85,
  main_tank_alarm: 95,
  tap_changer_warning: 70,
  tap_changer_alarm: 85,
};

export default function Settings() {
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load thresholds from Supabase on mount
  useEffect(() => {
    async function loadConfig() {
      const config = await getDeviceConfig(DEVICE_ID);
      if (config) {
        setThresholds({
          main_tank_warning: config.main_tank_warning,
          main_tank_alarm: config.main_tank_alarm,
          tap_changer_warning: config.tap_changer_warning,
          tap_changer_alarm: config.tap_changer_alarm,
        });
      }
      setLoading(false);
    }
    loadConfig();
  }, []);

  const handleChange = (field: keyof typeof thresholds, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setThresholds((prev) => ({ ...prev, [field]: numValue }));
      setSaved(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const success = await updateDeviceConfig(DEVICE_ID, thresholds);
    setSaving(false);
    if (success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError('Failed to save settings');
    }
  };

  const handleReset = () => {
    setThresholds(DEFAULT_THRESHOLDS);
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
                <h3 className="text-md font-medium text-white mb-3">Main Tank</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Warning Threshold (°C)
                    </label>
                    <input
                      type="number"
                      value={thresholds.main_tank_warning}
                      onChange={(e) => handleChange('main_tank_warning', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Alarm Threshold (°C)
                    </label>
                    <input
                      type="number"
                      value={thresholds.main_tank_alarm}
                      onChange={(e) => handleChange('main_tank_alarm', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Tap Changer */}
              <div>
                <h3 className="text-md font-medium text-white mb-3">Tap Changer Cover</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Warning Threshold (°C)
                    </label>
                    <input
                      type="number"
                      value={thresholds.tap_changer_warning}
                      onChange={(e) => handleChange('tap_changer_warning', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Alarm Threshold (°C)
                    </label>
                    <input
                      type="number"
                      value={thresholds.tap_changer_alarm}
                      onChange={(e) => handleChange('tap_changer_alarm', e.target.value)}
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
