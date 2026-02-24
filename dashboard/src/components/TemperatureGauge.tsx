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
  thermocoupleType?: string;
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
  thermocoupleType,
}: TemperatureGaugeProps) {
  const normalizedValue = value !== null
    ? Math.min(Math.max((value - minValue) / (maxValue - minValue), 0), 1)
    : 0;

  // SVG arc calculations
  const centerX = 100;
  const centerY = 130;
  const radius = 80;

  // Arc spans 270 degrees, from 225° (bottom-left) to -45° (bottom-right)
  // In SVG coords: 225° = start, going clockwise to 315° (-45°)
  const startAngle = 225; // degrees from positive X axis
  const endAngle = -45;   // degrees (or 315)
  const angleRange = 270; // total degrees

  // Calculate needle angle based on normalized value
  // 0 = 225° (left), 1 = -45° (right)
  const needleAngle = startAngle - (normalizedValue * angleRange);
  const needleAngleRad = (needleAngle * Math.PI) / 180;

  // Needle endpoint (longer needle)
  const needleLength = 70;
  const needleX = centerX + needleLength * Math.cos(needleAngleRad);
  const needleY = centerY - needleLength * Math.sin(needleAngleRad);

  // Needle base (small circle at center)
  const needleBaseRadius = 8;

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

  // Calculate threshold positions on the gauge (as angles)
  const warningPos = warningThreshold !== undefined
    ? Math.min(Math.max((warningThreshold - minValue) / (maxValue - minValue), 0), 1)
    : 1;
  const alarmPos = alarmThreshold !== undefined
    ? Math.min(Math.max((alarmThreshold - minValue) / (maxValue - minValue), 0), 1)
    : 1;

  // Helper to create arc path
  const createArcPath = (startNorm: number, endNorm: number) => {
    const startAng = startAngle - (startNorm * angleRange);
    const endAng = startAngle - (endNorm * angleRange);
    const startRad = (startAng * Math.PI) / 180;
    const endRad = (endAng * Math.PI) / 180;

    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY - radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY - radius * Math.sin(endRad);

    const largeArc = (endNorm - startNorm) > 0.5 ? 1 : 0;

    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  return (
    <div className={`flex flex-col items-center ${getStatusClass()} gauge-container`}>
      <div className="relative w-36 h-28 sm:w-48 sm:h-40">
        <svg
          viewBox="0 0 200 150"
          className="w-full h-full"
        >
          {/* Background arc - normal zone (green) */}
          <path
            d={createArcPath(0, warningPos)}
            fill="none"
            stroke="rgba(76,175,80,0.3)"
            strokeWidth="12"
            strokeLinecap="round"
          />

          {/* Warning zone (orange) */}
          {showThresholds && warningThreshold !== undefined && warningPos < 1 && (
            <path
              d={createArcPath(warningPos, alarmPos)}
              fill="none"
              stroke="rgba(255,152,0,0.4)"
              strokeWidth="12"
              strokeLinecap="butt"
            />
          )}

          {/* Alarm zone (red) */}
          {showThresholds && alarmThreshold !== undefined && alarmPos < 1 && (
            <path
              d={createArcPath(alarmPos, 1)}
              fill="none"
              stroke="rgba(244,67,54,0.4)"
              strokeWidth="12"
              strokeLinecap="round"
            />
          )}

          {/* Tick marks */}
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const tickAngle = startAngle - (tick * angleRange);
            const tickRad = (tickAngle * Math.PI) / 180;
            const innerR = radius - 6;
            const outerR = radius + 6;
            const x1 = centerX + innerR * Math.cos(tickRad);
            const y1 = centerY - innerR * Math.sin(tickRad);
            const x2 = centerX + outerR * Math.cos(tickRad);
            const y2 = centerY - outerR * Math.sin(tickRad);
            return (
              <line
                key={tick}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="2"
              />
            );
          })}

          {/* Needle */}
          {value !== null && (
            <>
              <line
                x1={centerX}
                y1={centerY}
                x2={needleX}
                y2={needleY}
                stroke={getStatusColor()}
                strokeWidth="3"
                strokeLinecap="round"
                className="transition-all duration-500"
                style={{
                  filter: status === 'alarm' ? 'drop-shadow(0 0 6px rgba(244,67,54,0.8))' :
                          status === 'warning' ? 'drop-shadow(0 0 4px rgba(255,152,0,0.6))' :
                          'drop-shadow(0 0 4px rgba(76,175,80,0.4))',
                }}
              />
              <circle
                cx={centerX}
                cy={centerY}
                r={needleBaseRadius}
                fill={getStatusColor()}
                className="transition-all duration-500"
              />
            </>
          )}

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
      <div className="flex flex-col items-center mt-1 sm:mt-2">
        <h3 className="text-sm sm:text-lg font-semibold text-white truncate max-w-[140px] sm:max-w-none">{label}</h3>
        {thermocoupleType && (
          <span className="text-xs text-gray-400 mt-0.5">Type {thermocoupleType}</span>
        )}
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
