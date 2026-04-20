'use client';

import { memo } from 'react';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrderFlowData } from '@/lib/derivatives-types';

/**
 * Order Flow Indicator Component
 * Requirements: Requirement 7 (Task 7.2)
 * Design: OrderFlowIndicator component
 * 
 * Features:
 * - Display bullish/bearish/neutral indicator
 * - Add tooltip with buy/sell volume breakdown
 * - Use existing useDerivativesIntel() hook data
 * - Color-coded pressure levels
 * - Memoized for performance
 */

interface OrderFlowIndicatorProps {
  data?: OrderFlowData;
  className?: string;
  compact?: boolean;
  showTooltip?: boolean;
}

export const OrderFlowIndicator = memo(function OrderFlowIndicator({
  data,
  className,
  compact = true,
  showTooltip = true
}: OrderFlowIndicatorProps) {
  // Handle missing data
  if (!data) {
    return (
      <div className={cn("flex items-center justify-center text-slate-600", className)}>
        <Minus size={12} />
      </div>
    );
  }

  const { pressure, ratio, buyVolume1m, sellVolume1m, tradeCount1m } = data;

  // Get pressure styling
  const pressureStyle = getPressureStyle(pressure);
  
  // Format volumes
  const buyVolumeFormatted = formatVolume(buyVolume1m);
  const sellVolumeFormatted = formatVolume(sellVolume1m);
  const ratioPercent = (ratio * 100).toFixed(1);

  // Determine icon
  const Icon = getIcon(pressure);

  if (compact) {
    return (
      <div className="relative group">
        <div
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[9px] font-black uppercase tracking-wider",
            pressureStyle.bg,
            pressureStyle.text,
            pressureStyle.border,
            className
          )}
        >
          <Icon size={10} />
          <span>{getPressureLabel(pressure)}</span>
        </div>

        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-900 border border-white/10 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 min-w-[180px]">
            <div className="text-[9px] font-bold text-white space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Buy Volume:</span>
                <span className="text-[#39FF14]">${buyVolumeFormatted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Sell Volume:</span>
                <span className="text-[#FF4B5C]">${sellVolumeFormatted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Buy Ratio:</span>
                <span>{ratioPercent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Trades (1m):</span>
                <span>{tradeCount1m}</span>
              </div>
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
          </div>
        )}
      </div>
    );
  }

  // Full version with volume bar
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className={cn(
        "flex items-center gap-2 px-2 py-1 rounded-lg border",
        pressureStyle.bg,
        pressureStyle.text,
        pressureStyle.border
      )}>
        <Icon size={12} />
        <span className="text-[10px] font-black uppercase tracking-wider">
          {getPressureLabel(pressure)}
        </span>
      </div>

      {/* Volume Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-slate-900 overflow-hidden border border-white/5">
          <div
            className="h-full bg-gradient-to-r from-[#39FF14] to-[#39FF14]/50 transition-all duration-500"
            style={{ width: `${ratioPercent}%` }}
          />
        </div>
        <span className="text-[8px] font-black text-slate-500 tabular-nums min-w-[32px]">
          {ratioPercent}%
        </span>
      </div>

      {/* Volume Details */}
      <div className="flex items-center justify-between text-[8px] font-bold">
        <div className="flex items-center gap-1">
          <TrendingUp size={8} className="text-[#39FF14]" />
          <span className="text-slate-500">${buyVolumeFormatted}</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingDown size={8} className="text-[#FF4B5C]" />
          <span className="text-slate-500">${sellVolumeFormatted}</span>
        </div>
      </div>
    </div>
  );
});

/**
 * Utility Functions
 */

function getPressureStyle(pressure: OrderFlowData['pressure']) {
  switch (pressure) {
    case 'strong-buy':
      return {
        bg: 'bg-[#39FF14]/20',
        text: 'text-[#39FF14]',
        border: 'border-[#39FF14]/40'
      };
    case 'buy':
      return {
        bg: 'bg-[#39FF14]/10',
        text: 'text-[#39FF14]',
        border: 'border-[#39FF14]/30'
      };
    case 'neutral':
      return {
        bg: 'bg-slate-800/30',
        text: 'text-slate-400',
        border: 'border-slate-700/30'
      };
    case 'sell':
      return {
        bg: 'bg-[#FF4B5C]/10',
        text: 'text-[#FF4B5C]',
        border: 'border-[#FF4B5C]/30'
      };
    case 'strong-sell':
      return {
        bg: 'bg-[#FF4B5C]/20',
        text: 'text-[#FF4B5C]',
        border: 'border-[#FF4B5C]/40'
      };
  }
}

function getPressureLabel(pressure: OrderFlowData['pressure']): string {
  switch (pressure) {
    case 'strong-buy': return 'Strong Buy';
    case 'buy': return 'Buy';
    case 'neutral': return 'Neutral';
    case 'sell': return 'Sell';
    case 'strong-sell': return 'Strong Sell';
  }
}

function getIcon(pressure: OrderFlowData['pressure']) {
  switch (pressure) {
    case 'strong-buy':
    case 'buy':
      return TrendingUp;
    case 'strong-sell':
    case 'sell':
      return TrendingDown;
    case 'neutral':
      return Activity;
  }
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`;
  } else if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(1)}K`;
  }
  return volume.toFixed(0);
}

/**
 * Export utility for external use
 */
export function getOrderFlowPressure(ratio: number): OrderFlowData['pressure'] {
  if (ratio >= 0.7) return 'strong-buy';
  if (ratio >= 0.55) return 'buy';
  if (ratio >= 0.45) return 'neutral';
  if (ratio >= 0.3) return 'sell';
  return 'strong-sell';
}
