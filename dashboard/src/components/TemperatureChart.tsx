'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
import { TemperatureReading, ChartNote } from '@/lib/supabase';
import { useTheme } from './ThemeProvider';

interface SensorConfig {
  enabled: boolean;
  label: string;
}

interface FilterConfig {
  enabled: boolean;
  type: 'moving_average' | 'exponential';
  window: number;
  alpha: number;
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
  filterEnabled?: boolean;
  filterConfig?: FilterConfig;
  sensors?: {
    sensor1: SensorConfig;
    sensor2: SensorConfig;
    sensor3: SensorConfig;
    sensor4: SensorConfig;
  };
  sensorOrder?: string[];
  notes?: ChartNote[];
  onAddNote?: (timestamp: Date, text: string, sensor: ChartNote['sensor']) => void;
  onEditNote?: (noteId: string, text: string, sensor: ChartNote['sensor']) => void;
  onDeleteNote?: (noteId: string) => void;
  onRequestTimeRange?: (centerTimestamp: Date) => void;
}

// Sensor colors
const SENSOR_COLORS = {
  sensor1: '#2196f3', // Blue
  sensor2: '#9c27b0', // Purple
  sensor3: '#4caf50', // Green
  sensor4: '#ff9800', // Orange
};

// Apply moving average filter to an array of values
function applyMovingAverage(values: (number | null)[], windowSize: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] === null) {
      result.push(null);
      continue;
    }
    // Get window of values (up to windowSize previous values including current)
    const windowStart = Math.max(0, i - windowSize + 1);
    const window = values.slice(windowStart, i + 1).filter((v): v is number => v !== null);
    if (window.length === 0) {
      result.push(null);
    } else {
      const avg = window.reduce((sum, v) => sum + v, 0) / window.length;
      result.push(avg);
    }
  }
  return result;
}

// Apply exponential smoothing filter to an array of values
function applyExponentialSmoothing(values: (number | null)[], alpha: number): (number | null)[] {
  const result: (number | null)[] = [];
  let prevFiltered: number = 0;
  let hasPrev = false;
  for (let i = 0; i < values.length; i++) {
    const current = values[i];
    if (current === null) {
      result.push(null);
      continue;
    }
    if (!hasPrev) {
      // First valid value - no smoothing possible
      result.push(current);
      prevFiltered = current;
      hasPrev = true;
    } else {
      // EMA formula: filtered = alpha * current + (1 - alpha) * previous_filtered
      const filtered: number = alpha * current + (1 - alpha) * prevFiltered;
      result.push(filtered);
      prevFiltered = filtered;
    }
  }
  return result;
}

// Downsample data to target number of points using LTTB-like algorithm
// Preserves visual shape by keeping points that contribute most to the line
// Always preserves null points (gap markers)
function downsampleData<T extends { time: number }>(
  data: T[],
  targetPoints: number,
  valueKeys: (keyof T)[]
): T[] {
  if (data.length <= targetPoints) return data;

  // First, identify and extract null points (gap markers)
  const nullIndices = new Set<number>();
  data.forEach((point, i) => {
    const isNull = valueKeys.every(key => point[key] === null);
    if (isNull) nullIndices.add(i);
  });

  // If too many null points, just return as-is
  if (nullIndices.size > targetPoints / 2) return data;

  // Adjust target to account for null points we'll keep
  const adjustedTarget = targetPoints - nullIndices.size;
  if (adjustedTarget < 3) return data;

  const bucketSize = (data.length - 2) / (adjustedTarget - 2);
  const result: T[] = [data[0]]; // Always keep first point

  for (let i = 0; i < adjustedTarget - 2; i++) {
    const bucketStart = Math.floor(i * bucketSize) + 1;
    const bucketEnd = Math.floor((i + 1) * bucketSize) + 1;

    // Always include any null points in this bucket
    for (let j = bucketStart; j < bucketEnd && j < data.length - 1; j++) {
      if (nullIndices.has(j)) {
        result.push(data[j]);
      }
    }

    // Find the best non-null point in this bucket
    let maxDeviation = -1;
    let selectedPoint: T | null = null;

    for (let j = bucketStart; j < bucketEnd && j < data.length - 1; j++) {
      if (nullIndices.has(j)) continue;

      let deviation = 0;
      for (const key of valueKeys) {
        const val = data[j][key];
        if (typeof val === 'number' && val !== null) {
          deviation += Math.abs(val);
        }
      }
      if (deviation > maxDeviation) {
        maxDeviation = deviation;
        selectedPoint = data[j];
      }
    }

    if (selectedPoint) {
      result.push(selectedPoint);
    }
  }

  result.push(data[data.length - 1]); // Always keep last point

  // Sort by time to maintain order
  return result.sort((a, b) => a.time - b.time);
}

export default function TemperatureChart({
  data,
  thresholds,
  yAxisMin,
  yAxisMax,
  filterEnabled = false,
  filterConfig = { enabled: false, type: 'moving_average', window: 5, alpha: 0.3 },
  sensors = {
    sensor1: { enabled: true, label: 'Main Tank' },
    sensor2: { enabled: true, label: 'Tap Changer' },
    sensor3: { enabled: false, label: 'Sensor 3' },
    sensor4: { enabled: false, label: 'Sensor 4' },
  },
  sensorOrder = ['sensor1', 'sensor2', 'sensor3', 'sensor4'],
  notes = [],
  onAddNote,
  onEditNote,
  onDeleteNote,
  onRequestTimeRange,
}: TemperatureChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Theme-aware colors for the recharts SVG elements (these are inline
  // attributes, so they can't use Tailwind dark: variants).
  const axisColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.55)';
  const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const brushStroke = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  const brushFill = isDark ? 'rgba(30,30,30,0.8)' : 'rgba(255,255,255,0.8)';

  // Store zoom domain for XAxis - null means show all data
  const [zoomDomain, setZoomDomain] = useState<{ left: number | 'dataMin'; right: number | 'dataMax' }>({
    left: 'dataMin',
    right: 'dataMax',
  });
  const [isZoomed, setIsZoomed] = useState(false);

  // Track which sensors are visible on the chart (local toggle state)
  const [visibleSensors, setVisibleSensors] = useState({
    sensor1: true,
    sensor2: true,
    sensor3: true,
    sensor4: true,
  });

  // Whether to show raw signals alongside filtered (off by default)
  const [showRaw, setShowRaw] = useState(false);

  // Notes modal state
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedSensorForNote, setSelectedSensorForNote] = useState<ChartNote['sensor']>('general');
  const [pendingNoteText, setPendingNoteText] = useState('');
  const [pendingNoteTime, setPendingNoteTime] = useState('');
  const [editingNote, setEditingNote] = useState<ChartNote | null>(null);
  const [selectedNote, setSelectedNote] = useState<ChartNote | null>(null);

  // Enter edit mode for the selected note
  const startEditingNote = (note: ChartNote) => {
    setEditingNote(note);
    setPendingNoteText(note.text);
    setSelectedSensorForNote(note.sensor);
    setPendingNoteTime(format(new Date(note.timestamp), "yyyy-MM-dd'T'HH:mm"));
  };

  // Clear editing state
  const clearEditing = () => {
    setEditingNote(null);
    setPendingNoteText('');
    setSelectedSensorForNote('general');
    setPendingNoteTime('');
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedNote(null);
    clearEditing();
  };

  // Group notes by date for display
  const groupedNotes = useMemo(() => {
    const groups: Record<string, ChartNote[]> = {};
    notes.forEach(note => {
      const dateKey = format(new Date(note.timestamp), 'yyyy-MM-dd');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(note);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0])); // Most recent first
  }, [notes]);

  // Transform data for recharts with client-side filtering
  const chartData = useMemo(() => {
    // Extract raw values for each sensor
    const sensor1Raw = data.map(r => r.main_tank_temp);
    const sensor2Raw = data.map(r => r.tap_changer_temp);
    const sensor3Raw = data.map(r => r.sensor_3_temp);
    const sensor4Raw = data.map(r => r.sensor_4_temp);

    // Apply client-side filtering based on current filter settings
    let sensor1Filtered: (number | null)[];
    let sensor2Filtered: (number | null)[];
    let sensor3Filtered: (number | null)[];
    let sensor4Filtered: (number | null)[];

    if (filterConfig.enabled) {
      if (filterConfig.type === 'moving_average') {
        sensor1Filtered = applyMovingAverage(sensor1Raw, filterConfig.window);
        sensor2Filtered = applyMovingAverage(sensor2Raw, filterConfig.window);
        sensor3Filtered = applyMovingAverage(sensor3Raw, filterConfig.window);
        sensor4Filtered = applyMovingAverage(sensor4Raw, filterConfig.window);
      } else {
        // exponential smoothing
        sensor1Filtered = applyExponentialSmoothing(sensor1Raw, filterConfig.alpha);
        sensor2Filtered = applyExponentialSmoothing(sensor2Raw, filterConfig.alpha);
        sensor3Filtered = applyExponentialSmoothing(sensor3Raw, filterConfig.alpha);
        sensor4Filtered = applyExponentialSmoothing(sensor4Raw, filterConfig.alpha);
      }
    } else {
      // Filtering disabled - no filtered values
      sensor1Filtered = data.map(() => null);
      sensor2Filtered = data.map(() => null);
      sensor3Filtered = data.map(() => null);
      sensor4Filtered = data.map(() => null);
    }

    // Build data with gap detection - insert null points to break lines
    const fullData: Array<{
      time: number;
      sensor1: number | null;
      sensor2: number | null;
      sensor3: number | null;
      sensor4: number | null;
      sensor1_filtered: number | null;
      sensor2_filtered: number | null;
      sensor3_filtered: number | null;
      sensor4_filtered: number | null;
    }> = [];

    // Calculate median interval to detect gaps
    const intervals: number[] = [];
    for (let i = 1; i < data.length && i < 100; i++) {
      const t1 = new Date(data[i - 1].recorded_at).getTime();
      const t2 = new Date(data[i].recorded_at).getTime();
      intervals.push(t2 - t1);
    }
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals.length > 0 ? intervals[Math.floor(intervals.length / 2)] : 60000;
    // Gap threshold: 5x the median interval (or at least 5 minutes)
    const gapThreshold = Math.max(medianInterval * 5, 5 * 60 * 1000);

    for (let i = 0; i < data.length; i++) {
      const reading = data[i];
      const time = new Date(reading.recorded_at).getTime();

      // Check for gap before this point
      if (i > 0) {
        const prevTime = new Date(data[i - 1].recorded_at).getTime();
        if (time - prevTime > gapThreshold) {
          // Insert a null point to break the line
          fullData.push({
            time: prevTime + 1,
            sensor1: null,
            sensor2: null,
            sensor3: null,
            sensor4: null,
            sensor1_filtered: null,
            sensor2_filtered: null,
            sensor3_filtered: null,
            sensor4_filtered: null,
          });
        }
      }

      fullData.push({
        time,
        sensor1: reading.main_tank_temp,
        sensor2: reading.tap_changer_temp,
        sensor3: reading.sensor_3_temp,
        sensor4: reading.sensor_4_temp,
        sensor1_filtered: sensor1Filtered[i],
        sensor2_filtered: sensor2Filtered[i],
        sensor3_filtered: sensor3Filtered[i],
        sensor4_filtered: sensor4Filtered[i],
      });
    }

    // Downsample if too many points for smooth rendering
    const MAX_POINTS = 800;
    if (fullData.length > MAX_POINTS) {
      return downsampleData(
        fullData,
        MAX_POINTS,
        ['sensor1', 'sensor2', 'sensor3', 'sensor4']
      );
    }

    return fullData;
  }, [data, filterConfig]);

  // Get notes that fall within current chart time range
  const visibleNoteIds = useMemo(() => {
    if (chartData.length < 2) return new Set<string>();
    const minTime = chartData[0].time;
    const maxTime = chartData[chartData.length - 1].time;
    return new Set(
      notes
        .filter(n => {
          const t = new Date(n.timestamp).getTime();
          return t >= minTime && t <= maxTime;
        })
        .map(n => n.id)
    );
  }, [notes, chartData]);

  // Select a note (view only, scroll to show it if needed)
  const selectNote = useCallback((note: ChartNote) => {
    setSelectedNote(note);

    const noteTime = new Date(note.timestamp).getTime();
    if (chartData.length < 2) {
      // No data loaded - request data for the note's time
      if (onRequestTimeRange) {
        onRequestTimeRange(new Date(note.timestamp));
      }
      return;
    }

    const dataStart = chartData[0].time;
    const dataEnd = chartData[chartData.length - 1].time;
    const totalTimeSpan = dataEnd - dataStart;

    // Check if note is within loaded data range
    if (noteTime < dataStart || noteTime > dataEnd) {
      // Note is outside loaded data - request data centered on note
      if (onRequestTimeRange) {
        onRequestTimeRange(new Date(note.timestamp));
      }
      return;
    }

    // Note is within loaded data - check if already in current view
    const currentLeft = typeof zoomDomain.left === 'number' ? zoomDomain.left : dataStart;
    const currentRight = typeof zoomDomain.right === 'number' ? zoomDomain.right : dataEnd;

    if (noteTime >= currentLeft && noteTime <= currentRight) {
      // Note is already in view - don't change zoom
      return;
    }

    // Note is in loaded data but not in current view
    // Maintain current window size, center on note
    const currentWindowSize = currentRight - currentLeft;
    const halfWindow = currentWindowSize / 2;
    let left = noteTime - halfWindow;
    let right = noteTime + halfWindow;

    // Clamp to data bounds
    if (left < dataStart) {
      left = dataStart;
      right = Math.min(dataEnd, dataStart + currentWindowSize);
    }
    if (right > dataEnd) {
      right = dataEnd;
      left = Math.max(dataStart, dataEnd - currentWindowSize);
    }

    setZoomDomain({ left, right });
    setIsZoomed(true);
  }, [chartData, onRequestTimeRange, zoomDomain]);

  // Reset zoom to show all data
  const resetZoom = useCallback(() => {
    setZoomDomain({ left: 'dataMin', right: 'dataMax' });
    setIsZoomed(false);
  }, []);

  // Handle brush change - update zoom domain
  const handleBrushChange = useCallback((newIndex: { startIndex?: number; endIndex?: number }) => {
    if (newIndex.startIndex !== undefined && newIndex.endIndex !== undefined && chartData.length > 0) {
      const startTime = chartData[newIndex.startIndex]?.time;
      const endTime = chartData[newIndex.endIndex]?.time;
      if (startTime && endTime && startTime !== endTime) {
        setZoomDomain({ left: startTime, right: endTime });
        setIsZoomed(true);
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
      // Sort payload entries to match sensorOrder
      const sortedPayload = [...payload].sort((a, b) => {
        // Extract sensor key from dataKey (e.g., 'sensor1' or 'sensor1_filtered' -> 'sensor1')
        const keyA = a.dataKey?.replace('_filtered', '') || '';
        const keyB = b.dataKey?.replace('_filtered', '') || '';
        const idxA = sensorOrder.indexOf(keyA);
        const idxB = sensorOrder.indexOf(keyB);
        // If not found in order, put at end
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">{formatTooltipTime(label)}</p>
          {sortedPayload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value?.toFixed(1)}°C
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Get list of enabled sensors in the specified order
  const allSensors: Record<string, { key: 'sensor1' | 'sensor2' | 'sensor3' | 'sensor4'; enabled: boolean; label: string; color: string }> = {
    sensor1: { key: 'sensor1', ...sensors.sensor1, color: SENSOR_COLORS.sensor1 },
    sensor2: { key: 'sensor2', ...sensors.sensor2, color: SENSOR_COLORS.sensor2 },
    sensor3: { key: 'sensor3', ...sensors.sensor3, color: SENSOR_COLORS.sensor3 },
    sensor4: { key: 'sensor4', ...sensors.sensor4, color: SENSOR_COLORS.sensor4 },
  };
  const enabledSensors = sensorOrder
    .filter(key => allSensors[key]?.enabled)
    .map(key => allSensors[key]);

  return (
    <div className="w-full">
      {/* Sensor Toggle Controls */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
        {enabledSensors.map((sensor) => (
          <button
            key={sensor.key}
            onClick={() => toggleSensor(sensor.key)}
            className={`
              flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm
              transition-all duration-200
              ${visibleSensors[sensor.key]
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'}
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
        {filterEnabled && (
          <>
            <span className="text-gray-600 text-xs hidden sm:inline">|</span>
            <button
              onClick={() => setShowRaw(prev => !prev)}
              className={`
                flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm
                transition-all duration-200
                ${showRaw
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'}
              `}
            >
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" d="M4 12h16" />
              </svg>
              <span>Show Raw</span>
            </button>
          </>
        )}
        {onAddNote && (
          <>
            <span className="text-gray-600 text-xs hidden sm:inline">|</span>
            <button
              onClick={() => setShowNotesModal(true)}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm transition-all duration-200 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <span>Notes{notes.length > 0 ? ` (${notes.length})` : ''}</span>
            </button>
          </>
        )}
        {isZoomed && (
          <>
            <span className="text-gray-600 text-xs hidden sm:inline">|</span>
            <button
              onClick={resetZoom}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm transition-all duration-200 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
            >
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
              <span>Reset Zoom</span>
            </button>
          </>
        )}
      </div>


      {/* Chart */}
      <div className="h-64 sm:h-96">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-2 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm">No data available</p>
            </div>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="time"
              tickFormatter={formatXAxis}
              stroke={axisColor}
              tick={{ fill: axisColor, fontSize: 12 }}
              domain={[zoomDomain.left, zoomDomain.right]}
              allowDataOverflow={true}
              type="number"
              scale="time"
            />
            <YAxis
              stroke={axisColor}
              tick={{ fill: axisColor, fontSize: 12 }}
              domain={[yAxisMin ?? 'auto', yAxisMax ?? 'auto']}
              unit="°C"
              allowDecimals={false}
              tickCount={6}
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

            {/* Note markers - vertical lines for notes in visible time range */}
            {notes.filter(n => visibleNoteIds.has(n.id)).map((note) => {
              const noteTime = new Date(note.timestamp).getTime();
              const noteColor = note.sensor === 'general'
                ? (isDark ? '#a855f7' : '#7c3aed')
                : SENSOR_COLORS[note.sensor as keyof typeof SENSOR_COLORS];
              const isSelected = selectedNote?.id === note.id;
              return (
                <ReferenceLine
                  key={note.id}
                  x={noteTime}
                  stroke={isSelected ? '#3b82f6' : noteColor}
                  strokeWidth={isSelected ? 3 : 2}
                  strokeDasharray={isSelected ? undefined : "4 2"}
                />
              );
            })}

            {/* Sensor 1 (Main Tank) - Raw */}
            {sensors.sensor1.enabled && visibleSensors.sensor1 && (!filterEnabled || showRaw) && (
              <Line
                type="monotone"
                dataKey="sensor1"
                name={filterEnabled ? `${sensors.sensor1.label} (Raw)` : sensors.sensor1.label}
                stroke={SENSOR_COLORS.sensor1}
                strokeWidth={filterEnabled ? 1 : 2}
                strokeDasharray={filterEnabled ? "4 3" : undefined}
                dot={false}
                activeDot={{ r: filterEnabled ? 4 : 6 }}
              />
            )}
            {/* Sensor 1 (Main Tank) - Filtered */}
            {filterEnabled && sensors.sensor1.enabled && visibleSensors.sensor1 && (
              <Line
                type="monotone"
                dataKey="sensor1_filtered"
                name={sensors.sensor1.label}
                stroke={SENSOR_COLORS.sensor1}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            )}

            {/* Sensor 2 (Tap Changer) - Raw */}
            {sensors.sensor2.enabled && visibleSensors.sensor2 && (!filterEnabled || showRaw) && (
              <Line
                type="monotone"
                dataKey="sensor2"
                name={filterEnabled ? `${sensors.sensor2.label} (Raw)` : sensors.sensor2.label}
                stroke={SENSOR_COLORS.sensor2}
                strokeWidth={filterEnabled ? 1 : 2}
                strokeDasharray={filterEnabled ? "4 3" : undefined}
                dot={false}
                activeDot={{ r: filterEnabled ? 4 : 6 }}
              />
            )}
            {/* Sensor 2 (Tap Changer) - Filtered */}
            {filterEnabled && sensors.sensor2.enabled && visibleSensors.sensor2 && (
              <Line
                type="monotone"
                dataKey="sensor2_filtered"
                name={sensors.sensor2.label}
                stroke={SENSOR_COLORS.sensor2}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            )}

            {/* Sensor 3 - Raw */}
            {sensors.sensor3.enabled && visibleSensors.sensor3 && (!filterEnabled || showRaw) && (
              <Line
                type="monotone"
                dataKey="sensor3"
                name={filterEnabled ? `${sensors.sensor3.label} (Raw)` : sensors.sensor3.label}
                stroke={SENSOR_COLORS.sensor3}
                strokeWidth={filterEnabled ? 1 : 2}
                strokeDasharray={filterEnabled ? "4 3" : undefined}
                dot={false}
                activeDot={{ r: filterEnabled ? 4 : 6 }}
              />
            )}
            {/* Sensor 3 - Filtered */}
            {filterEnabled && sensors.sensor3.enabled && visibleSensors.sensor3 && (
              <Line
                type="monotone"
                dataKey="sensor3_filtered"
                name={sensors.sensor3.label}
                stroke={SENSOR_COLORS.sensor3}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            )}

            {/* Sensor 4 - Raw */}
            {sensors.sensor4.enabled && visibleSensors.sensor4 && (!filterEnabled || showRaw) && (
              <Line
                type="monotone"
                dataKey="sensor4"
                name={filterEnabled ? `${sensors.sensor4.label} (Raw)` : sensors.sensor4.label}
                stroke={SENSOR_COLORS.sensor4}
                strokeWidth={filterEnabled ? 1 : 2}
                strokeDasharray={filterEnabled ? "4 3" : undefined}
                dot={false}
                activeDot={{ r: filterEnabled ? 4 : 6 }}
              />
            )}
            {/* Sensor 4 - Filtered */}
            {filterEnabled && sensors.sensor4.enabled && visibleSensors.sensor4 && (
              <Line
                type="monotone"
                dataKey="sensor4_filtered"
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
              stroke={brushStroke}
              fill={brushFill}
              tickFormatter={formatXAxis}
              onChange={handleBrushChange}
              travellerWidth={10}
            />
          </LineChart>
        </ResponsiveContainer>
        )}
      </div>

      {/* Inline Notes Panel */}
      {onAddNote && showNotesModal && (
        <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
          {/* Add/Edit form - compact inline */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="datetime-local"
                value={pendingNoteTime}
                onChange={(e) => setPendingNoteTime(e.target.value)}
                className="text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white"
              />
              <select
                value={selectedSensorForNote}
                onChange={(e) => setSelectedSensorForNote(e.target.value as ChartNote['sensor'])}
                className="text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white"
              >
                <option value="general">General</option>
                <option value="sensor1">{sensors.sensor1.label}</option>
                {sensors.sensor2.enabled && <option value="sensor2">{sensors.sensor2.label}</option>}
                {sensors.sensor3.enabled && <option value="sensor3">{sensors.sensor3.label}</option>}
                {sensors.sensor4.enabled && <option value="sensor4">{sensors.sensor4.label}</option>}
              </select>
              <input
                type="text"
                value={pendingNoteText}
                onChange={(e) => setPendingNoteText(e.target.value)}
                placeholder="Note text..."
                className="flex-1 min-w-[150px] text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white placeholder-gray-400"
              />
              {editingNote ? (
                <>
                  <button
                    onClick={() => {
                      if (onEditNote && pendingNoteText.trim()) {
                        onEditNote(editingNote.id, pendingNoteText.trim(), selectedSensorForNote);
                        clearEditing();
                      }
                    }}
                    disabled={!pendingNoteText.trim()}
                    className="text-sm px-3 py-1 rounded bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button onClick={clearEditing} className="text-sm px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    if (pendingNoteText.trim() && pendingNoteTime) {
                      onAddNote(new Date(pendingNoteTime), pendingNoteText.trim(), selectedSensorForNote);
                      setPendingNoteText('');
                      setPendingNoteTime('');
                    }
                  }}
                  disabled={!pendingNoteText.trim() || !pendingNoteTime}
                  className="text-sm px-3 py-1 rounded bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              )}
            </div>
          </div>

          {/* Selected note detail */}
          {selectedNote && !editingNote && (
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>{format(new Date(selectedNote.timestamp), 'EEEE d MMMM yyyy, HH:mm')}</span>
                    {selectedNote.sensor !== 'general' && (
                      <>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SENSOR_COLORS[selectedNote.sensor as keyof typeof SENSOR_COLORS] }} />
                        <span>{sensors[selectedNote.sensor as keyof typeof sensors]?.label || selectedNote.sensor}</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedNote.text}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {onEditNote && (
                    <button
                      onClick={() => startEditingNote(selectedNote)}
                      className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Edit
                    </button>
                  )}
                  {onDeleteNote && (
                    <button
                      onClick={() => { onDeleteNote(selectedNote.id); clearSelection(); }}
                      className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    onClick={clearSelection}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notes list - compact horizontal scroll or wrap */}
          <div className="p-3 max-h-40 overflow-y-auto">
            {notes.length === 0 ? (
              <p className="text-sm text-gray-500 text-center">No notes yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => selectNote(note)}
                    className={`inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 cursor-pointer transition-colors ${
                      selectedNote?.id === note.id
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 ring-1 ring-blue-500'
                        : visibleNoteIds.has(note.id)
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <span className="text-gray-500 dark:text-gray-400">
                      {format(new Date(note.timestamp), 'dd/MM HH:mm')}
                    </span>
                    {note.sensor !== 'general' && (
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SENSOR_COLORS[note.sensor as keyof typeof SENSOR_COLORS] }} />
                    )}
                    <span className="max-w-[150px] truncate">{note.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
