'use client';

import React from 'react';

interface TemperatureGaugeProps {
  label: string;
  value: number | null;
  status?: 'normal' | 'warning' | 'alarm' | 'error' | 'offline';
  warningThreshold?: number;
  alarmThreshold?: number;
  minValue?: number;
  maxValue?: number;
  unit?: string;
  lastUpdate?: string | null;
  showThresholds?: boolean;
  showStatus?: boolean;
}

export default function TemperatureGauge({
  label,
  value,
  status = 'normal',
  warningThreshold,
  alarmThreshold,
  minValue = 0,
  maxValue = 120,
  unit = '°C',
  lastUpdate,
  showThresholds = true,
  showStatus = true,
}: TemperatureGaugeProps) {
  const normalizedValue = value !== null
    ? Math.min(Math.max((value - minValue) / (maxValue - minValue), 0), 1)
    : 0;

  // SVG arc calculations
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270 degrees
  const dashOffset = arcLength * (1 - normalizedValue);

  // Color based on status
  const getStatusColor = () => {
    switch (status) {
      case 'normal':
        return '#4caf50';
      case 'warning':
        return '#ff9800';
      case 'alarm':
        return '#f44336';
      case 'error':
      case 'offline':
      default:
        return '#9e9e9e';
    }
  };

  const getStatusClass = () => {
    switch (status) {
      case 'alarm':
        return 'alarm-pulse';
      case 'warning':
        return 'warning-pulse';
      default:
        return '';
    }
  };

  // Calculate threshold positions on the gauge
  const warningPos = warningThreshold !== undefined ? (warningThreshold - minValue) / (maxValue - minValue) : 0;
  const alarmPos = alarmThreshold !== undefined ? (alarmThreshold - minValue) / (maxValue - minValue) : 0;

  return (
    <div className={`flex flex-col items-center ${getStatusClass()} gauge-container`}>
      <div className="relative w-36 h-28 sm:w-48 sm:h-40">
        <svg
          viewBox="0 0 200 150"
          className="w-full h-full"
        >
          {/* Background arc */}
          <path
            d="M 20 130 A 80 80 0 1 1 180 130"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="12"
            strokeLinecap="round"
          />

          {/* Warning zone indicator */}
          {showThresholds && warningThreshold !== undefined && (
            <path
              d="M 20 130 A 80 80 0 1 1 180 130"
              fill="none"
              stroke="rgba(255,152,0,0.2)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${arcLength * (1 - warningPos)} ${arcLength * warningPos}`}
              strokeDashoffset={-arcLength * warningPos}
            />
          )}

          {/* Alarm zone indicator */}
          {showThresholds && alarmThreshold !== undefined && (
            <path
              d="M 20 130 A 80 80 0 1 1 180 130"
              fill="none"
              stroke="rgba(244,67,54,0.2)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${arcLength * (1 - alarmPos)} ${arcLength * alarmPos}`}
              strokeDashoffset={-arcLength * alarmPos}
            />
          )}

          {/* Value arc */}
          <path
            d="M 20 130 A 80 80 0 1 1 180 130"
            fill="none"
            stroke={getStatusColor()}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={dashOffset}
            className="gauge-circle transition-all duration-500"
            style={{
              filter: status === 'alarm' ? 'drop-shadow(0 0 8px rgba(244,67,54,0.5))' : undefined,
            }}
          />

          {/* Center text */}
          <text
            x="100"
            y="95"
            textAnchor="middle"
            className="fill-white text-3xl font-bold"
          >
            {value !== null ? value.toFixed(1) : '---'}
          </text>
          <text
            x="100"
            y="115"
            textAnchor="middle"
            className="fill-gray-400 text-sm"
          >
            {unit}
          </text>

          {/* Min/Max labels */}
          <text
            x="30"
            y="148"
            textAnchor="middle"
            className="fill-gray-500"
            style={{ fontSize: '10px' }}
          >
            {minValue}
          </text>
          <text
            x="170"
            y="148"
            textAnchor="middle"
            className="fill-gray-500"
            style={{ fontSize: '10px' }}
          >
            {maxValue}
          </text>
        </svg>
      </div>

      {/* Label */}
      <div className="text-center mt-1 sm:mt-2">
        <h3 className="text-sm sm:text-lg font-semibold text-white truncate max-w-[140px] sm:max-w-none">{label}</h3>
        {showStatus && (
          <span
            className={`badge mt-1 ${
              status === 'normal'
                ? 'badge-normal'
                : status === 'warning'
                ? 'badge-warning'
                : status === 'alarm'
                ? 'badge-alarm'
                : 'badge-offline'
            }`}
          >
            {status.toUpperCase()}
          </span>
        )}
      </div>

      {/* Thresholds - hidden on small mobile */}
      {showThresholds && warningThreshold !== undefined && alarmThreshold !== undefined && (
        <div className="hidden sm:flex justify-between w-full mt-3 text-xs text-gray-500">
          <span>Warn: {warningThreshold}{unit}</span>
          <span>Alarm: {alarmThreshold}{unit}</span>
        </div>
      )}

      {/* Last Update - hidden on mobile */}
      {lastUpdate && (
        <p className="hidden sm:block text-xs text-gray-500 mt-2">
          Updated: {new Date(lastUpdate).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
