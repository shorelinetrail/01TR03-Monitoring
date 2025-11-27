'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface CameraFeedProps {
  name: string;
  description?: string;
  snapshotUrl: string;
  streamUrl?: string;
  refreshInterval?: number; // in milliseconds
}

export default function CameraFeed({
  name,
  description,
  snapshotUrl,
  streamUrl,
  refreshInterval = 1000,
}: CameraFeedProps) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    try {
      // Add timestamp to prevent caching
      const url = `${snapshotUrl}${snapshotUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch snapshot');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      // Revoke previous URL to prevent memory leaks
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }

      setImageUrl(objectUrl);
      setLastUpdate(new Date());
      setIsOnline(true);
      setError(null);
    } catch (err) {
      console.error('Camera fetch error:', err);
      setIsOnline(false);
      setError('Camera offline');
    }
  }, [snapshotUrl, imageUrl]);

  useEffect(() => {
    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, refreshInterval);

    return () => {
      clearInterval(interval);
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [refreshInterval]);

  // Fetch on mount and snapshotUrl change
  useEffect(() => {
    fetchSnapshot();
  }, [snapshotUrl]);

  return (
    <>
      {/* Thumbnail view */}
      <div
        className="cursor-pointer group"
        onClick={() => setIsExpanded(true)}
      >
        <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {error ? (
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto text-gray-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-500 text-sm">{error}</p>
                </div>
              ) : (
                <div className="animate-pulse flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          )}

          {/* Status overlay */}
          <div className="absolute top-2 right-2">
            <span className={`badge ${isOnline ? 'badge-normal' : 'badge-offline'}`}>
              {isOnline ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>

          {/* Expand indicator */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <svg
              className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </div>
        </div>

        {/* Camera info */}
        <div className="mt-2">
          <h4 className="font-medium text-white">{name}</h4>
          {description && <p className="text-sm text-gray-400">{description}</p>}
          {lastUpdate && (
            <p className="text-xs text-gray-500 mt-1">
              Updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Expanded modal - rendered via portal to avoid z-index issues */}
      {isExpanded && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/95 flex flex-col p-4"
          onClick={() => setIsExpanded(false)}
        >
          {/* Header bar */}
          <div className="flex justify-between items-center mb-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-2xl font-bold text-white">{name}</h2>
              {description && <p className="text-gray-400">{description}</p>}
            </div>
            <div className="flex items-center gap-4">
              <span className={`badge ${isOnline ? 'badge-normal' : 'badge-offline'}`}>
                {isOnline ? 'LIVE' : 'OFFLINE'}
              </span>
              <button
                className="text-white hover:text-gray-300 transition-colors"
                onClick={() => setIsExpanded(false)}
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Full-screen image container */}
          <div
            className="flex-1 flex items-center justify-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-gray-500">No image available</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="mt-4 flex justify-between items-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-gray-400">
              Auto-refresh: {refreshInterval / 1000}s
              {lastUpdate && ` | Last update: ${lastUpdate.toLocaleTimeString()}`}
            </p>
            <button
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              onClick={fetchSnapshot}
            >
              Refresh Now
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
