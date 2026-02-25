'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { TemperatureReading, getReadingsByDateRange } from '@/lib/supabase';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  labels: {
    mainTank: string;
    tapChanger: string;
    differential: string;
  };
}

export default function ExportModal({ isOpen, onClose, deviceId, labels }: ExportModalProps) {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return format(date, "yyyy-MM-dd'T'HH:mm");
  });
  const [endDate, setEndDate] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        setError('Start date must be before end date');
        setIsExporting(false);
        return;
      }

      const readings = await getReadingsByDateRange(deviceId, start, end);

      if (readings.length === 0) {
        setError('No data found for the selected date range');
        setIsExporting(false);
        return;
      }

      // Convert to CSV
      const csv = convertToCSV(readings);

      // Download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${deviceId}_temperatures_${format(start, 'yyyyMMdd_HHmm')}_to_${format(end, 'yyyyMMdd_HHmm')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onClose();
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const convertToCSV = (readings: TemperatureReading[]): string => {
    const headers = [
      'Timestamp',
      labels.mainTank,
      `${labels.mainTank} (Filtered)`,
      'Main Tank Status',
      labels.tapChanger,
      `${labels.tapChanger} (Filtered)`,
      'Tap Changer Status',
      labels.differential,
    ];

    const rows = readings.map((reading) => {
      const mainTemp = reading.main_tank_temp;
      const tapTemp = reading.tap_changer_temp;
      const differential = mainTemp != null && tapTemp != null ? mainTemp - tapTemp : null;

      return [
        format(new Date(reading.recorded_at), 'yyyy-MM-dd HH:mm:ss'),
        mainTemp != null ? mainTemp.toFixed(2) : '',
        reading.main_tank_temp_filtered != null ? reading.main_tank_temp_filtered.toFixed(2) : '',
        reading.main_tank_status,
        tapTemp != null ? tapTemp.toFixed(2) : '',
        reading.tap_changer_temp_filtered != null ? reading.tap_changer_temp_filtered.toFixed(2) : '',
        reading.tap_changer_status,
        differential != null ? differential.toFixed(2) : '',
      ];
    });

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/60" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">Export Data to CSV</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-4 space-y-4">
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Start Date & Time
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                End Date & Time
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <p className="text-xs text-gray-500">
              The exported CSV will include timestamps, temperatures, and status for all readings in the selected range.
            </p>
          </div>

          <div className="flex gap-3 p-4 border-t border-gray-700">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isExporting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Exporting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export CSV
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
