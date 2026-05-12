'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { getDeviceLogs, subscribeToDeviceLogs, DeviceLog, getDevice } from '@/lib/supabase';

const DEVICE_ID = process.env.NEXT_PUBLIC_DEVICE_ID || 'DEVICE01';

const LOG_LEVELS = ['ALL', 'DEBUG', 'INFO', 'WARN', 'ERROR'] as const;

const getLevelColor = (level: string) => {
  switch (level) {
    case 'DEBUG':
      return 'text-gray-400';
    case 'INFO':
      return 'text-blue-400';
    case 'WARN':
      return 'text-yellow-400';
    case 'ERROR':
      return 'text-red-400';
    default:
      return 'text-gray-300';
  }
};

const getLevelBadgeClass = (level: string) => {
  switch (level) {
    case 'DEBUG':
      return 'bg-gray-700 text-gray-300';
    case 'INFO':
      return 'bg-blue-900/50 text-blue-400';
    case 'WARN':
      return 'bg-yellow-900/50 text-yellow-400';
    case 'ERROR':
      return 'bg-red-900/50 text-red-400';
    default:
      return 'bg-gray-700 text-gray-300';
  }
};

export default function LogsPage() {
  const [logs, setLogs] = useState<DeviceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const isScrollingProgrammatically = useRef(false);

  const runDiagnostics = async () => {
    setRunningDiagnostics(true);
    try {
      // Get device IP
      const device = await getDevice(DEVICE_ID);
      if (device?.ip_address) {
        // Trigger diagnostics on device
        await fetch(`http://${device.ip_address}/diagnostics`, {
          mode: 'no-cors',
        });
      }
    } catch (error) {
      console.error('Failed to trigger diagnostics:', error);
    }
    // Wait a bit for results to come in
    setTimeout(() => setRunningDiagnostics(false), 3000);
  };

  // Load initial logs
  useEffect(() => {
    async function loadLogs() {
      const data = await getDeviceLogs(DEVICE_ID, 1000, filter === 'ALL' ? undefined : filter);
      // Reverse to show oldest first (natural log order)
      setLogs(data.reverse());
      setLoading(false);
      // Scroll to bottom after initial load
      isScrollingProgrammatically.current = true;
      setTimeout(() => {
        if (logsContainerRef.current) {
          logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
        setTimeout(() => {
          isScrollingProgrammatically.current = false;
        }, 100);
      }, 100);
    }
    loadLogs();
  }, [filter]);

  // Subscribe to new logs
  useEffect(() => {
    if (paused) return;

    const channel = subscribeToDeviceLogs(DEVICE_ID, (newLog) => {
      if (filter === 'ALL' || newLog.level === filter) {
        setLogs((prev) => {
          // Keep max 1000 logs in memory
          const updated = [...prev, newLog];
          if (updated.length > 1000) {
            return updated.slice(-1000);
          }
          return updated;
        });
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [filter, paused]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      isScrollingProgrammatically.current = true;
      requestAnimationFrame(() => {
        if (logsContainerRef.current) {
          logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
        // Reset flag after a short delay to allow scroll event to pass
        setTimeout(() => {
          isScrollingProgrammatically.current = false;
        }, 100);
      });
    }
  }, [logs, autoScroll]);

  // Detect manual scroll - only disable autoscroll on user scroll
  const handleScroll = () => {
    if (isScrollingProgrammatically.current) return;
    if (!logsContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    if (!isAtBottom) {
      setAutoScroll(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900/50 border-b border-gray-800 sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link href="/" className="flex items-center gap-1 text-gray-400 hover:text-white text-sm sm:text-base py-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Back</span>
              </Link>
              <h1 className="text-base sm:text-xl font-bold text-white">Device Logs</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Filter dropdown */}
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-primary-500"
              >
                {LOG_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              {/* Run Diagnostics button */}
              <button
                onClick={runDiagnostics}
                disabled={runningDiagnostics}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-wait rounded text-sm text-white transition-colors"
              >
                {runningDiagnostics ? 'Running...' : 'Diagnostics'}
              </button>
              {/* Pause/Resume button */}
              <button
                onClick={() => setPaused(!paused)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  paused
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                }`}
              >
                {paused ? 'Resume' : 'Pause'}
              </button>
              {/* Clear button */}
              <button
                onClick={clearLogs}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Log count and auto-scroll toggle */}
      <div className="bg-gray-900/30 border-b border-gray-800 px-3 sm:px-6 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-gray-500">
          <span>{logs.length} log entries (24h retention)</span>
          <div className="flex items-center gap-3">
            {paused && (
              <span className="text-yellow-500 flex items-center gap-1">
                <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                Paused
              </span>
            )}
            <button
              onClick={() => {
                setAutoScroll(!autoScroll);
                if (!autoScroll && logsContainerRef.current) {
                  logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
                }
              }}
              className={`px-2 py-1 rounded transition-colors ${
                autoScroll
                  ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              Auto-scroll: {autoScroll ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      </div>

      {/* Logs container */}
      <main
        ref={logsContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto font-mono text-sm"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No logs available</p>
              <p className="text-xs mt-1">Logs will appear here when the device sends them</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {logs.map((log, index) => (
                <div
                  key={log.id || index}
                  className={`flex items-start gap-2 py-1 px-2 rounded hover:bg-gray-800/50 ${
                    log.level === 'ERROR' ? 'bg-red-950/20' : ''
                  }`}
                >
                  <span className="text-gray-600 whitespace-nowrap text-xs">
                    {formatDate(log.created_at)} {formatTimestamp(log.created_at)}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${getLevelBadgeClass(
                      log.level
                    )}`}
                  >
                    {log.level.padEnd(5)}
                  </span>
                  <span className={`flex-1 break-all ${getLevelColor(log.level)}`}>
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Scroll to bottom button */}
      {!autoScroll && (
        <button
          onClick={() => {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setAutoScroll(true);
          }}
          className="fixed bottom-6 right-6 p-3 bg-primary-600 hover:bg-primary-700 rounded-full shadow-lg transition-colors"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  );
}
