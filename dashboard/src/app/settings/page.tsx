'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

// Default thresholds
const DEFAULT_THRESHOLDS = {
  mainTankWarning: 85,
  mainTankAlarm: 95,
  tapChangerWarning: 70,
  tapChangerAlarm: 85,
};

export default function Settings() {
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [saved, setSaved] = useState(false);

  // Load thresholds from localStorage on mount
  useEffect(() => {
    const savedThresholds = localStorage.getItem('temperatureThresholds');
    if (savedThresholds) {
      try {
        setThresholds({ ...DEFAULT_THRESHOLDS, ...JSON.parse(savedThresholds) });
      } catch {
        // Use defaults
      }
    }
  }, []);

  const handleChange = (field: keyof typeof thresholds, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setThresholds((prev) => ({ ...prev, [field]: numValue }));
      setSaved(false);
    }
  };

  const handleSave = () => {
    localStorage.setItem('temperatureThresholds', JSON.stringify(thresholds));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setThresholds(DEFAULT_THRESHOLDS);
    localStorage.removeItem('temperatureThresholds');
    setSaved(false);
  };

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
                      value={thresholds.mainTankWarning}
                      onChange={(e) => handleChange('mainTankWarning', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Alarm Threshold (°C)
                    </label>
                    <input
                      type="number"
                      value={thresholds.mainTankAlarm}
                      onChange={(e) => handleChange('mainTankAlarm', e.target.value)}
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
                      value={thresholds.tapChangerWarning}
                      onChange={(e) => handleChange('tapChangerWarning', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Alarm Threshold (°C)
                    </label>
                    <input
                      type="number"
                      value={thresholds.tapChangerAlarm}
                      onChange={(e) => handleChange('tapChangerAlarm', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-700">
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors"
                >
                  Save Changes
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

        {/* Info */}
        <section>
          <div className="card card-body">
            <p className="text-sm text-gray-400">
              These thresholds are stored locally in your browser and are used to display warning/alarm indicators on the dashboard gauges and charts.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
