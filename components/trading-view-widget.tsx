'use client';

import React, { useEffect, useRef, memo } from 'react';
import { getSymbolAlias } from '@/lib/symbol-utils';

interface TradingViewWidgetProps {
  symbol: string;
  interval?: string;
  theme?: 'light' | 'dark';
  autosize?: boolean;
  market?: string;
}

/**
 * Institutional TradingView Advanced Chart Widget
 * Requirements: Real-time interactive charting with multi-indicator support.
 */
function TradingViewWidget({
  symbol,
  interval = '15',
  theme = 'dark',
  autosize = true,
  market = 'Crypto'
}: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);

  // Map app symbol to TradingView exchange:symbol format
  const getTvSymbol = (sym: string, marketType: string) => {
    const s = sym.toUpperCase();

    if (marketType === 'Crypto' || s.endsWith('USDT')) {
      return `BINANCE:${s}`;
    }

    if (marketType === 'Metal') {
      if (s.includes('XAU') || s.includes('GC')) return 'OANDA:XAUUSD';
      if (s.includes('XAG') || s.includes('SI')) return 'OANDA:XAGUSD';
      return `OANDA:${s}`;
    }

    if (marketType === 'Forex' || s.endsWith('=X')) {
      const clean = s.replace('=X', '');
      return `OANDA:${clean}`;
    }

    if (marketType === 'Index') {
      if (s === 'SPY' || s === 'SPX') return 'AMEX:SPY';
      if (s === 'QQQ' || s === 'NDAQ') return 'NASDAQ:QQQ';
      if (s === 'DIA' || s === 'DOW') return 'AMEX:DIA';
      return s;
    }

    if (marketType === 'Stocks') {
      return `NASDAQ:${s}`; // Default to NASDAQ for most tech stocks
    }

    return s;
  };

  const tvSymbol = getTvSymbol(symbol, market);
  
  // Normalize interval for TradingView compatibility
  const tvInterval = interval === '14' ? '15' : interval;

  useEffect(() => {
    if (!container.current) return;

    // Clear previous widget
    container.current.innerHTML = '';

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;

    const config = {
      "width": "100%",
      "height": "100%",
      "autosize": true,
      "symbol": tvSymbol,
      "interval": tvInterval,
      "timezone": "Etc/UTC",
      "theme": theme,
      "style": "1",
      "locale": "en",
      "enable_publishing": false,
      "allow_symbol_change": true,
      "calendar": false,
      "details": false,
      "hide_side_toolbar": false,
      "hide_top_toolbar": false,
      "hide_legend": false,
      "hide_volume": false,
      "hotlist": false,
      "save_image": true,
      "backgroundColor": "#0A0D14",
      "gridColor": "rgba(242, 242, 242, 0.06)",
      "container_id": "tradingview_widget_id",
      "withdateranges": true,
      "support_host": "https://www.tradingview.com"
    };

    script.innerHTML = JSON.stringify(config);
    
    const widgetDiv = document.createElement('div');
    widgetDiv.id = "tradingview_widget_id";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";
    
    // Use a small delay to ensure the modal animation has finished and dimensions are stable
    const timer = setTimeout(() => {
      if (container.current) {
        container.current.innerHTML = ''; // Clear loading state
        container.current.appendChild(widgetDiv);
        container.current.appendChild(script);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      if (container.current) {
        container.current.innerHTML = '';
      }
    };
  }, [tvSymbol, tvInterval, theme]);

  return (
    <div 
      className="tradingview-widget-container flex flex-col items-center justify-center bg-[#0A0D14]" 
      ref={container} 
      style={{ height: "100%", width: "100%" }}
    >
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <div className="w-12 h-12 border-4 border-[#39FF14]/20 border-t-[#39FF14] rounded-full animate-spin" />
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
          Initializing Alpha Stream...
        </span>
      </div>
    </div>
  );
}

export default memo(TradingViewWidget);
