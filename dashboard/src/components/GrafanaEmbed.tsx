'use client';

import React from 'react';

interface GrafanaEmbedProps {
  dashboardId?: string;
  panelId?: number;
  from?: string;
  to?: string;
  theme?: 'light' | 'dark';
  width?: string | number;
  height?: string | number;
}

export default function GrafanaEmbed({
  dashboardId,
  panelId,
  from = 'now-24h',
  to = 'now',
  theme = 'dark',
  width = '100%',
  height = 400,
}: GrafanaEmbedProps) {
  const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_URL;
  const configuredDashboardId = dashboardId || process.env.NEXT_PUBLIC_GRAFANA_DASHBOARD_ID;

  if (!grafanaUrl || !configuredDashboardId) {
    return (
      <div
        className="bg-gray-800/50 border border-gray-700 rounded-lg flex items-center justify-center"
        style={{ width, height }}
      >
        <div className="text-center p-8">
          <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-gray-400 font-medium">Grafana Not Configured</p>
          <p className="text-gray-500 text-sm mt-2">
            Set NEXT_PUBLIC_GRAFANA_URL and NEXT_PUBLIC_GRAFANA_DASHBOARD_ID<br />
            in your environment variables to enable Grafana embedding.
          </p>
          <a
            href="https://grafana.com/docs/grafana-cloud/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-4 text-primary-400 hover:text-primary-300 text-sm"
          >
            Learn more about Grafana Cloud
          </a>
        </div>
      </div>
    );
  }

  // Build Grafana embed URL
  let embedUrl = `${grafanaUrl}/d-solo/${configuredDashboardId}`;
  const params = new URLSearchParams({
    from,
    to,
    theme,
    refresh: '30s',
  });

  if (panelId) {
    params.set('panelId', panelId.toString());
  }

  embedUrl += `?${params.toString()}`;

  return (
    <div className="rounded-lg overflow-hidden border border-gray-700" style={{ width, height }}>
      <iframe
        src={embedUrl}
        width="100%"
        height="100%"
        frameBorder="0"
        allowFullScreen
        title="Grafana Dashboard"
      />
    </div>
  );
}
