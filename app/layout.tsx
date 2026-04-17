import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'RSIQ Pro | Institutional Crypto Terminal & Real-Time Scanner',
    template: '%s | RSIQ Pro',
  },
  description: 'Enterprise-grade multi-indicator crypto market scanner by Mindscape Analytics. Monitor 500+ pairs with institutional RSI, MACD, Order Flow, and Liquidation Flux analytics.',
  metadataBase: new URL('https://rsiq.mindscapeanalytics.com'),
  alternates: {
    canonical: 'https://rsiq.mindscapeanalytics.com',
  },
  keywords: [
    'Crypto Scanner', 'Institutional RSI Terminal', 'Real-time Crypto Analytics', 'Liquidation Tracker',
    'MACD Strategy', 'Bybit Screener', 'Binance Scanner', 'Mindscape Analytics', 'RSIQ Pro',
    'Order Flow Analysis', 'Smart Money Tracker', 'Crypto Market Intelligence'
  ],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RSIQ Pro',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: '/logo/rsiq-mindscapeanalytics.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'RSIQ Pro | Institutional Crypto Terminal & Market Scanner',
    description: 'Monitor 500+ pairs with real-time institutional analytics, RSI, and Liquidation Flux. Engineered by Mindscape Analytics.',
    url: 'https://rsiq.mindscapeanalytics.com',
    siteName: 'RSIQ Pro',
    images: [
      {
        url: 'https://rsiq.mindscapeanalytics.com/api/og/BTC',
        width: 1200,
        height: 630,
        alt: 'RSIQ Pro Institutional Terminal - Real-Time BTC Alpha',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  verification: {
    google: 'YOUR_GSC_VERIFICATION_TOKEN', // [ACTION REQUIRED] Replace with token from Google Search Console
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RSIQ Pro | Institutional Crypto Terminal',
    description: 'Real-time multi-indicator market scanner with institutional density.',
    images: ['https://rsiq.mindscapeanalytics.com/api/og/BTC'],
    creator: '@MindscapeAL',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0e17',
};

import { Toaster } from 'sonner';
import { PWAInstallPrompt } from '@/components/pwa-install-prompt';
import { PWAServiceWorkerRegistration } from '@/components/pwa-service-worker-registration';
import { JsonLd } from '@/components/seo/json-ld';
import { GrowthTracer } from '@/components/growth-tracer';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased bg-[#0a0e17]" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Enterprise Recovery Script: Detects if the app is stuck in an offline 'cache-trap'
                // and force-clears it if we are actually online.
                const checkStuckState = async () => {
                  const isTerminal = window.location.pathname.startsWith('/terminal');
                  const isHome = window.location.pathname === '/';
                  
                  if ((isTerminal || isHome) && navigator.onLine) {
                    // Check if Service Worker is serving stale fallback content
                    // We check for a marker that is only in the offline page
                    if (document.body.innerText.includes('SYSTEM RESTORED') || document.body.innerText.includes('SIGNAL LOST')) {
                      console.log('[Recovery] Stuck state detected. Force clearing Service Worker...');
                      if ('serviceWorker' in navigator) {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        for (const reg of regs) await reg.unregister();
                      }
                      window.location.reload(true);
                    }
                  }
                };
                
                // Run on load and on visibility change
                window.addEventListener('load', checkStuckState);
                document.addEventListener('visibilitychange', () => {
                  if (document.visibilityState === 'visible') checkStuckState();
                });
                
                // Periodically check every 10s if we are on the landing page/terminal to prevent zombie shells
                setInterval(checkStuckState, 10000);
              })();
            `
          }}
        />
        <JsonLd />
        <GrowthTracer />
        {children}
        <PWAServiceWorkerRegistration />
        <PWAInstallPrompt />
        <Toaster theme="dark" position="top-right" closeButton richColors />
      </body>
    </html>
  );
}
