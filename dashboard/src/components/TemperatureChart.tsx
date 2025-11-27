'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
} from 'recharts';
import { format } from 'date-fns';
import { TemperatureReading } from '@/lib/supabase';

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
}

export default function TemperatureChart({ data, thresholds, yAxisMin, yAxisMax }: TemperatureChartProps) {
  // Transform data for recharts
  const chartData = data.map((reading) => ({
    time: new Date(reading.recorded_at).getTime(),
    mainTank: reading.main_tank_temp,
    tapChanger: reading.tap_changer_temp,
  }));

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

  return (
    <div className="w-full h-96">
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
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => <span className="text-gray-300">{value}</span>}
          />

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

          <Line
            type="monotone"
            dataKey="mainTank"
            name="Main Tank"
            stroke="#2196f3"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="tapChanger"
            name="Tap Changer"
            stroke="#9c27b0"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />

          {/* X-axis range slider */}
          <Brush
            dataKey="time"
            height={30}
            stroke="rgba(255,255,255,0.3)"
            fill="rgba(30,30,30,0.8)"
            tickFormatter={formatXAxis}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
