import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Café Mehfile — Order Online',
  description:
    'Order food at Café Mehfile. Scan your table QR, pick from the menu, and place the order directly to the kitchen on WhatsApp.',
  applicationName: 'Café Mehfile',
  icons: { icon: '/assets/mehfile-logo.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#2A1F26',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="marigold">
      <body>{children}</body>
    </html>
  );
}