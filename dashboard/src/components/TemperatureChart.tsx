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
}: TemperatureChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Theme-aware colors for the recharts SVG elements (these are inline
  // attributes, so they can't use Tailwind dark: variants).
  const axisColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.55)';
  const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const brushStroke = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  const brushFill = isDark ? 'rgba(30,30,30,0.8)' : 'rgba(255,255,255,0.8)';

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

  // Whether to show raw signals alongside filtered (off by default)
  const [showRaw, setShowRaw] = useState(false);

  // Notes panel state
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [addNoteMode, setAddNoteMode] = useState(false);
  const [selectedSensorForNote, setSelectedSensorForNote] = useState<ChartNote['sensor']>('general');
  const [hoveredNote, setHoveredNote] = useState<string | null>(null);
  const [pendingNoteText, setPendingNoteText] = useState('');
  const [editingNote, setEditingNote] = useState<ChartNote | null>(null);

  // Select a note for viewing/editing
  const selectNote = (note: ChartNote) => {
    setEditingNote(note);
    setPendingNoteText(note.text);
    setSelectedSensorForNote(note.sensor);
    setShowNotesPanel(true);
    setAddNoteMode(false);
  };

  // Clear editing state
  const clearEditing = () => {
    setEditingNote(null);
    setPendingNoteText('');
    setSelectedSensorForNote('general');
  };

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

    return data.map((reading, i) => ({
      time: new Date(reading.recorded_at).getTime(),
      sensor1: reading.main_tank_temp,
      sensor2: reading.tap_changer_temp,
      sensor3: reading.sensor_3_temp,
      sensor4: reading.sensor_4_temp,
      sensor1_filtered: sensor1Filtered[i],
      sensor2_filtered: sensor2Filtered[i],
      sensor3_filtered: sensor3Filtered[i],
      sensor4_filtered: sensor4Filtered[i],
    }));
  }, [data, filterConfig]);

  // Track data changes to restore zoom only when data updates, not during drag
  const prevDataRef = useRef<string>('');
  const [shouldRestoreZoom, setShouldRestoreZoom] = useState(false);

  // Detect when chart data actually changes (new data points)
  useEffect(() => {
    const dataKey = chartData.length > 0
      ? `${chartData[0]?.time}-${chartData[chartData.length - 1]?.time}-${chartData.length}`
      : '';

    if (prevDataRef.current && prevDataRef.current !== dataKey && timeRange.start) {
      // Data changed and we have a stored zoom - restore it
      setShouldRestoreZoom(true);
    }
    prevDataRef.current = dataKey;
  }, [chartData, timeRange.start]);

  // Calculate brush indices - only used for restoration after data changes
  const brushIndices = useMemo(() => {
    if (!shouldRestoreZoom || !timeRange.start || !timeRange.end || chartData.length === 0) {
      return { startIndex: undefined, endIndex: undefined };
    }

    const startTime = timeRange.start;
    const endTime = timeRange.end;

    // Find the index of the first point >= start time
    let startIndex = chartData.findIndex(d => d.time >= startTime);
    if (startIndex === -1) startIndex = 0;

    // Find the index of the last point <= end time
    let endIndex = chartData.length - 1;
    for (let i = chartData.length - 1; i >= 0; i--) {
      if (chartData[i].time <= endTime) {
        endIndex = i;
        break;
      }
    }

    // Ensure valid range
    if (startIndex > endIndex) {
      startIndex = endIndex;
    }

    return { startIndex, endIndex };
  }, [shouldRestoreZoom, timeRange, chartData]);

  // Clear the restore flag after indices have been applied
  useEffect(() => {
    if (shouldRestoreZoom && brushIndices.startIndex !== undefined) {
      // Small delay to let Brush apply the indices before clearing
      const timer = setTimeout(() => setShouldRestoreZoom(false), 100);
      return () => clearTimeout(timer);
    }
  }, [shouldRestoreZoom, brushIndices]);

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
              onClick={() => setShowNotesPanel(prev => !prev)}
              className={`
                flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm
                transition-all duration-200
                ${showNotesPanel
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}
              `}
            >
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <span>Notes{notes.length > 0 ? ` (${notes.length})` : ''}</span>
            </button>
          </>
        )}
      </div>

      {/* Notes Panel */}
      {showNotesPanel && onAddNote && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          {/* Edit/Add form */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {editingNote && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Editing: {format(new Date(editingNote.timestamp), 'dd MMM HH:mm')}
              </span>
            )}
            <input
              type="text"
              value={pendingNoteText}
              onChange={(e) => setPendingNoteText(e.target.value)}
              placeholder={editingNote ? "Edit note text..." : "Note text..."}
              className="flex-1 min-w-[150px] text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white placeholder-gray-400"
            />
            <select
              value={selectedSensorForNote}
              onChange={(e) => setSelectedSensorForNote(e.target.value as ChartNote['sensor'])}
              className="text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white"
            >
              <option value="general">General</option>
              <option value="sensor1">{sensors.sensor1.label}</option>
              {sensors.sensor2.enabled && <option value="sensor2">{sensors.sensor2.label}</option>}
              {sensors.sensor3.enabled && <option value="sensor3">{sensors.sensor3.label}</option>}
              {sensors.sensor4.enabled && <option value="sensor4">{sensors.sensor4.label}</option>}
            </select>
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
                  className="text-sm px-3 py-1 rounded transition-colors bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={clearEditing}
                  className="text-sm px-3 py-1 rounded transition-colors bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  if (pendingNoteText.trim()) {
                    setAddNoteMode(prev => !prev);
                  }
                }}
                disabled={!pendingNoteText.trim()}
                className={`
                  text-sm px-3 py-1 rounded transition-colors
                  ${addNoteMode
                    ? 'bg-primary-600 text-white'
                    : pendingNoteText.trim()
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'}
                `}
              >
                {addNoteMode ? 'Click chart to place...' : 'Place on Chart'}
              </button>
            )}
          </div>
          {notes.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className={`flex items-center justify-between text-sm rounded px-2 py-1 cursor-pointer transition-colors ${
                    editingNote?.id === note.id
                      ? 'bg-primary-100 dark:bg-primary-900/30 ring-1 ring-primary-500'
                      : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                  onMouseEnter={() => setHoveredNote(note.id)}
                  onMouseLeave={() => setHoveredNote(null)}
                  onClick={() => selectNote(note)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                      {format(new Date(note.timestamp), 'dd MMM HH:mm')}
                    </span>
                    {note.sensor !== 'general' && (
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: SENSOR_COLORS[note.sensor as keyof typeof SENSOR_COLORS] }}
                      />
                    )}
                    <span className="text-gray-900 dark:text-white truncate">{note.text}</span>
                  </div>
                  {onDeleteNote && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNote(note.id);
                        if (editingNote?.id === note.id) {
                          clearEditing();
                        }
                      }}
                      className="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
            onClick={(e) => {
              if (addNoteMode && onAddNote && e && e.activeLabel !== undefined && pendingNoteText.trim()) {
                const timestamp = new Date(Number(e.activeLabel));
                onAddNote(timestamp, pendingNoteText.trim(), selectedSensorForNote);
                setAddNoteMode(false);
                setPendingNoteText('');
              }
            }}
            style={{ cursor: addNoteMode ? 'crosshair' : undefined }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="time"
              tickFormatter={formatXAxis}
              stroke={axisColor}
              tick={{ fill: axisColor, fontSize: 12 }}
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

            {/* Note reference lines */}
            {notes.map((note) => {
              const noteTime = new Date(note.timestamp).getTime();
              const noteColor = note.sensor === 'general'
                ? (isDark ? '#9ca3af' : '#6b7280')
                : SENSOR_COLORS[note.sensor as keyof typeof SENSOR_COLORS];
              const isHovered = hoveredNote === note.id;
              const isEditing = editingNote?.id === note.id;
              return (
                <ReferenceLine
                  key={note.id}
                  x={noteTime}
                  stroke={isEditing ? '#3b82f6' : noteColor}
                  strokeWidth={isEditing ? 3 : isHovered ? 2 : 1}
                  strokeDasharray={isEditing ? undefined : "3 3"}
                  strokeOpacity={isEditing ? 1 : isHovered ? 1 : 0.7}
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
              startIndex={brushIndices.startIndex}
              endIndex={brushIndices.endIndex}
              onChange={handleBrushChange}
              travellerWidth={10}
            />
          </LineChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
