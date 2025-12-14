'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
} from 'recharts';
import { format } from 'date-fns';
import { TemperatureReading } from '@/lib/supabase';

interface SensorConfig {
  enabled: boolean;
  label: string;
}

interface TemperatureChartProps {
  data: TemperatureReading[];
  thresholds?: {
    mainTankWarning: number;
    mainTankAlarm: number;
    tapChangerWarning: number;
    tapChangerAlarm: number;
  };
  yAxisMin?: number | null;
  yAxisMax?: number | null;
  sensors?: {
    sensor1: SensorConfig;
    sensor2: SensorConfig;
    sensor3: SensorConfig;
    sensor4: SensorConfig;
  };
}

// Sensor colors
const SENSOR_COLORS = {
  sensor1: '#2196f3', // Blue
  sensor2: '#9c27b0', // Purple
  sensor3: '#4caf50', // Green
  sensor4: '#ff9800', // Orange
};

export default function TemperatureChart({
  data,
  thresholds,
  yAxisMin,
  yAxisMax,
  sensors = {
    sensor1: { enabled: true, label: 'Main Tank' },
    sensor2: { enabled: true, label: 'Tap Changer' },
    sensor3: { enabled: false, label: 'Sensor 3' },
    sensor4: { enabled: false, label: 'Sensor 4' },
  }
}: TemperatureChartProps) {
  // Store time range (timestamps) instead of indices so zoom persists across data updates
  const [timeRange, setTimeRange] = useState<{ start: number | null; end: number | null }>({
    start: null,
    end: null,
  });

  // Track which sensors are visible on the chart (local toggle state)
  const [visibleSensors, setVisibleSensors] = useState({
    sensor1: true,
    sensor2: true,
    sensor3: true,
    sensor4: true,
  });

  // Transform data for recharts
  const chartData = useMemo(() => data.map((reading) => ({
    time: new Date(reading.recorded_at).getTime(),
    sensor1: reading.main_tank_temp,
    sensor2: reading.tap_changer_temp,
    sensor3: reading.sensor_3_temp,
    sensor4: reading.sensor_4_temp,
  })), [data]);

  // Calculate brush indices from stored time range
  const brushIndices = useMemo(() => {
    if (!timeRange.start || !timeRange.end || chartData.length === 0) {
      return { startIndex: undefined, endIndex: undefined };
    }

    let startIndex = 0;
    let endIndex = chartData.length - 1;

    // Find closest indices to the stored time range
    for (let i = 0; i < chartData.length; i++) {
      if (chartData[i].time >= timeRange.start && startIndex === 0) {
        startIndex = Math.max(0, i - 1);
      }
      if (chartData[i].time <= timeRange.end) {
        endIndex = i;
      }
    }

    return { startIndex, endIndex };
  }, [timeRange, chartData]);

  // Handle brush change - store time range, not indices
  const handleBrushChange = useCallback((newIndex: { startIndex?: number; endIndex?: number }) => {
    if (newIndex.startIndex !== undefined && newIndex.endIndex !== undefined && chartData.length > 0) {
      const startTime = chartData[newIndex.startIndex]?.time;
      const endTime = chartData[newIndex.endIndex]?.time;
      if (startTime && endTime) {
        setTimeRange({ start: startTime, end: endTime });
      }
    }
  }, [chartData]);

  const toggleSensor = (sensor: keyof typeof visibleSensors) => {
    setVisibleSensors(prev => ({
      ...prev,
      [sensor]: !prev[sensor],
    }));
  };

  const formatXAxis = (timestamp: number) => {
    return format(new Date(timestamp), 'HH:mm');
  };

  const formatTooltipTime = (timestamp: number) => {
    return format(new Date(timestamp), 'dd MMM HH:mm:ss');
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-gray-400 text-sm mb-2">{formatTooltipTime(label)}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value?.toFixed(1)}°C
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Get list of enabled sensors that can be toggled
  const enabledSensors = [
    { key: 'sensor1' as const, ...sensors.sensor1, color: SENSOR_COLORS.sensor1 },
    { key: 'sensor2' as const, ...sensors.sensor2, color: SENSOR_COLORS.sensor2 },
    { key: 'sensor3' as const, ...sensors.sensor3, color: SENSOR_COLORS.sensor3 },
    { key: 'sensor4' as const, ...sensors.sensor4, color: SENSOR_COLORS.sensor4 },
  ].filter(s => s.enabled);

  return (
    <div className="w-full">
      {/* Sensor Toggle Controls */}
      <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
        {enabledSensors.map((sensor) => (
          <button
            key={sensor.key}
            onClick={() => toggleSensor(sensor.key)}
            className={`
              flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm
              transition-all duration-200
              ${visibleSensors[sensor.key]
                ? 'bg-gray-700 text-white'
                : 'bg-gray-800 text-gray-500'}
            `}
          >
            <span
              className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-opacity ${
                visibleSensors[sensor.key] ? 'opacity-100' : 'opacity-30'
              }`}
              style={{ backgroundColor: sensor.color }}
            />
            <span className={visibleSensors[sensor.key] ? '' : 'line-through'}>
              {sensor.label}
            </span>
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="time"
              tickFormatter={formatXAxis}
              stroke="rgba(255,255,255,0.5)"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
            />
            <YAxis
              stroke="rgba(255,255,255,0.5)"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
              domain={[yAxisMin ?? 'auto', yAxisMax ?? 'auto']}
              unit="°C"
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Threshold reference lines */}
            {thresholds && (
              <>
                <ReferenceLine
                  y={thresholds.mainTankWarning}
                  stroke="#ff9800"
                  strokeDasharray="5 5"
                  strokeOpacity={0.5}
                />
                <ReferenceLine
                  y={thresholds.mainTankAlarm}
                  stroke="#f44336"
                  strokeDasharray="5 5"
                  strokeOpacity={0.5}
                />
              </>
            )}

            {/* Sensor 1 (Main Tank) */}
            {sensors.sensor1.enabled && visibleSensors.sensor1 && (
              <Line
                type="monotone"
                dataKey="sensor1"
                name={sensors.sensor1.label}
                stroke={SENSOR_COLORS.sensor1}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            )}

            {/* Sensor 2 (Tap Changer) */}
            {sensors.sensor2.enabled && visibleSensors.sensor2 && (
              <Line
                type="monotone"
                dataKey="sensor2"
                name={sensors.sensor2.label}
                stroke={SENSOR_COLORS.sensor2}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            )}

            {/* Sensor 3 */}
            {sensors.sensor3.enabled && visibleSensors.sensor3 && (
              <Line
                type="monotone"
                dataKey="sensor3"
                name={sensors.sensor3.label}
                stroke={SENSOR_COLORS.sensor3}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            )}

            {/* Sensor 4 */}
            {sensors.sensor4.enabled && visibleSensors.sensor4 && (
              <Line
                type="monotone"
                dataKey="sensor4"
                name={sensors.sensor4.label}
                stroke={SENSOR_COLORS.sensor4}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            )}

            {/* X-axis range slider */}
            <Brush
              dataKey="time"
              height={30}
              stroke="rgba(255,255,255,0.3)"
              fill="rgba(30,30,30,0.8)"
              tickFormatter={formatXAxis}
              startIndex={brushIndices.startIndex}
              endIndex={brushIndices.endIndex}
              onChange={handleBrushChange}
              travellerWidth={10}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
