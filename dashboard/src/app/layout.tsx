import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '01TR03 Transformer Monitor',
  description: '66/11kV 50MVA Power Transformer Temperature Monitoring Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
