'use client';

/**
 * Generates and downloads a CSV template for bulk uploading temperature readings.
 * The template matches the temperature_readings table schema.
 */
export function downloadBulkUploadTemplate(labels: {
  mainTank: string;
  tapChanger: string;
  sensor3: string;
  sensor4: string;
}) {
  const headers = [
    'Timestamp',
    'Device ID',
    `${labels.mainTank} Temp (°C)`,
    `${labels.tapChanger} Temp (°C)`,
    `${labels.sensor3} Temp (°C)`,
    `${labels.sensor4} Temp (°C)`,
    'Ambient Temp (°C)',
    `${labels.mainTank} Status`,
    `${labels.tapChanger} Status`,
    `${labels.sensor3} Status`,
    `${labels.sensor4} Status`,
  ];

  // Example rows to show the expected format
  const exampleRows = [
    [
      '2025-01-15 10:00:00',
      'DEVICE01',
      '72.50',
      '65.30',
      '',
      '',
      '25.10',
      'normal',
      'normal',
      '',
      '',
    ],
    [
      '2025-01-15 10:00:30',
      'DEVICE01',
      '73.10',
      '65.80',
      '',
      '',
      '25.20',
      'normal',
      'normal',
      '',
      '',
    ],
    [
      '2025-01-15 10:01:00',
      'DEVICE01',
      '86.40',
      '66.20',
      '',
      '',
      '25.30',
      'warning',
      'normal',
      '',
      '',
    ],
  ];

  const csv = [
    headers.join(','),
    ...exampleRows.map((row) => row.join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bulk_upload_template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
