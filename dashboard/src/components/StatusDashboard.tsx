'use client';

import React, { useEffect, useState } from 'react';

type SensorStatus = 'normal' | 'warning' | 'alarm' | 'error' | 'offline';

interface SensorInfo {
  status: SensorStatus;
  label: string;
  enabled: boolean;
}

interface StatusDashboardProps {
  isOnline: boolean;
  lastSeen: string | null;
  sensorStatuses: {
    sensor1: SensorInfo;
    sensor2: SensorInfo;
    sensor3: SensorInfo;
    sensor4: SensorInfo;
  };
  alertCount: number;
  hasAlarms: boolean;
  lastReading: Date | null;
  reportInterval: number; // in seconds
}

const getSensorBadgeClass = (status: SensorStatus): string => {
  switch (status) {
    case 'normal':
      return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30';
    case 'warning':
      return 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30';
    case 'alarm':
    case 'error':
      return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30';
    case 'offline':
    default:
      return 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/30';
  }
};

export default function StatusDashboard({
  isOnline,
  lastSeen,
  sensorStatuses,
  alertCount,
  hasAlarms,
  lastReading,
  reportInterval,
}: StatusDashboardProps) {
  const [now, setNow] = useState(new Date());

  // Update every second for freshness indicator
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate data freshness based on report interval
  const getFreshnessInfo = () => {
    if (!lastReading) return { text: 'No data', className: 'text-red-600 dark:text-red-400' };

    const ageMs = now.getTime() - lastReading.getTime();
    const ageSec = Math.floor(ageMs / 1000);

    // Format time string
    let text: string;
    if (ageSec < 60) {
      text = `${ageSec}s`;
    } else if (ageSec < 3600) {
      const mins = Math.floor(ageSec / 60);
      const secs = ageSec % 60;
      text = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    } else {
      const hours = Math.floor(ageSec / 3600);
      const mins = Math.floor((ageSec % 3600) / 60);
      text = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }

    // Color based on report interval
    // Fresh: within expected interval
    // Stale: within 2x interval
    // Old: beyond 2x interval
    let className: string;
    if (ageSec <= reportInterval) {
      className = 'text-green-600 dark:text-green-400';
    } else if (ageSec <= reportInterval * 2) {
      className = 'text-orange-600 dark:text-orange-400';
    } else {
      className = 'text-red-600 dark:text-red-400';
    }

    return { text, className };
  };

  const freshness = getFreshnessInfo();

  // Get enabled sensors only
  const enabledSensors = Object.entries(sensorStatuses).filter(
    ([, info]) => info.enabled
  ) as [string, SensorInfo][];

  // Format last seen time
  const formatLastSeen = (timestamp: string | null): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-gray-100/80 dark:bg-gray-800/50 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700/50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2">
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">

          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <svg className={`w-4 h-4 ${isOnline ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
            <span className={`badge ${isOnline ? 'badge-normal' : 'badge-offline'}`}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
            {lastSeen && (
              <span className="hidden sm:inline text-gray-500 text-xs">
                {formatLastSeen(lastSeen)}
              </span>
            )}
          </div>

          {/* Separator */}
          <div className="hidden sm:block w-px h-4 bg-gray-300 dark:bg-gray-700" />

          {/* Sensor Badges */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 dark:text-gray-400 text-xs font-medium hidden sm:inline">Sensors:</span>
            {enabledSensors.map(([id, info]) => (
              <span
                key={id}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${getSensorBadgeClass(info.status)}`}
                title={`${info.label}: ${info.status.toUpperCase()}`}
              >
                {id.replace('sensor', 'S')}
              </span>
            ))}
          </div>

          {/* Separator */}
          <div className="hidden sm:block w-px h-4 bg-gray-300 dark:bg-gray-700" />

          {/* Alerts */}
          {alertCount > 0 ? (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className={`badge ${hasAlarms ? 'badge-alarm alarm-pulse' : 'badge-warning'}`}>
                {alertCount} Alert{alertCount > 1 ? 's' : ''}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-green-600 dark:text-green-400 text-xs">No alerts</span>
            </div>
          )}

          {/* Data Freshness - pushed to right */}
          <div className="flex items-center gap-2 ml-auto">
            <svg className={`w-4 h-4 ${freshness.className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-gray-500 dark:text-gray-400 text-xs hidden sm:inline">Data:</span>
            <span className={`text-sm font-medium ${freshness.className}`}>{freshness.text}</span>
          </div>

        </div>
      </div>
    </div>
  );
}
