import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CryptoRSI Screener — Multi-Indicator Crypto Market Scanner',
  description: 'Monitor 500+ crypto trading pairs with real-time RSI, MACD, Bollinger Bands, Stochastic RSI, VWAP, and composite strategy scoring.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
