'use client';

import { memo, useEffect, useState } from 'react';
import { Flame, TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { LiquidationEvent } from '@/lib/derivatives-types';

/**
 * Liquidation Badge Component
 * Requirements: Requirement 7 (Task 7.3)
 * Design: LiquidationBadge component
 * 
 * Features:
 * - Display badge for large liquidations
 * - Show size and direction (long/short)
 * - Add animation for new liquidations
 * - Threshold-based display (only show significant liquidations)
 * - Memoized for performance
 */

interface LiquidationBadgeProps {
  liquidations: LiquidationEvent[];
  symbol: string;
  className?: string;
  minValueUsd?: number; // Minimum USD value to display
  showAnimation?: boolean;
}

export const LiquidationBadge = memo(function LiquidationBadge({
  liquidations,
  symbol,
  className,
  minValueUsd = 100_000, // Default: only show liquidations >= $100k
  showAnimation = true
}: LiquidationBadgeProps) {
  // Filter liquidations for this symbol and above threshold
  const relevantLiquidations = liquidations.filter(
    liq => liq.symbol === symbol && liq.valueUsd >= minValueUsd
  );

  // Get most recent liquidation
  const latestLiquidation = relevantLiquidations[0];

  // Track if liquidation is new (within last 10 seconds)
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (!latestLiquidation) return;

    const age = Date.now() - latestLiquidation.timestamp;
    if (age < 10_000) {
      setIsNew(true);
      const timer = setTimeout(() => setIsNew(false), 10_000);
      return () => clearTimeout(timer);
    }
  }, [latestLiquidation]);

  // Don't render if no relevant liquidations
  if (!latestLiquidation) {
    return null;
  }

  // Determine if long or short was liquidated
  // Buy side = short position liquidated (bullish)
  // Sell side = long position liquidated (bearish)
  const isShortLiquidated = latestLiquidation.side === 'Buy';
  const direction = isShortLiquidated ? 'Short' : 'Long';
  
  // Format value
  const valueFormatted = formatLiquidationValue(latestLiquidation.valueUsd);

  // Color scheme
  const colorClasses = isShortLiquidated
    ? 'bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/30'
    : 'bg-[#FF4B5C]/10 text-[#FF4B5C] border-[#FF4B5C]/30';

  const Icon = isShortLiquidated ? TrendingUp : TrendingDown;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={latestLiquidation.id}
        initial={showAnimation && isNew ? { scale: 0.8, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[9px] font-black uppercase tracking-wider relative overflow-hidden",
          colorClasses,
          className
        )}
        title={`${direction} Liquidated: $${valueFormatted}\nPrice: $${latestLiquidation.price.toFixed(2)}\nExchange: ${latestLiquidation.exchange}`}
      >
        {/* Flame icon for large liquidations */}
        <Flame size={10} className={isNew && showAnimation ? "animate-pulse" : ""} />
        
        {/* Direction icon */}
        <Icon size={10} />
        
        {/* Value */}
        <span className="tabular-nums">${valueFormatted}</span>

        {/* Pulsing background for new liquidations */}
        {isNew && showAnimation && (
          <motion.div
            className="absolute inset-0 bg-current opacity-20"
            animate={{
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
});

/**
 * Liquidation Badge with Multiple Events
 * Shows count if multiple liquidations occurred recently
 */
interface LiquidationBadgeWithCountProps extends LiquidationBadgeProps {
  timeWindowMs?: number; // Time window to count liquidations
}

export const LiquidationBadgeWithCount = memo(function LiquidationBadgeWithCount({
  liquidations,
  symbol,
  className,
  minValueUsd = 100_000,
  showAnimation = true,
  timeWindowMs = 60_000 // Default: last 1 minute
}: LiquidationBadgeWithCountProps) {
  // Filter liquidations for this symbol, above threshold, and within time window
  const now = Date.now();
  const relevantLiquidations = liquidations.filter(
    liq => 
      liq.symbol === symbol && 
      liq.valueUsd >= minValueUsd &&
      (now - liq.timestamp) < timeWindowMs
  );

  const count = relevantLiquidations.length;

  if (count === 0) {
    return null;
  }

  // Calculate total liquidated value
  const totalValue = relevantLiquidations.reduce((sum, liq) => sum + liq.valueUsd, 0);
  const totalFormatted = formatLiquidationValue(totalValue);

  // Determine dominant direction
  const shortLiqCount = relevantLiquidations.filter(l => l.side === 'Buy').length;
  const longLiqCount = count - shortLiqCount;
  const isShortDominant = shortLiqCount > longLiqCount;

  const colorClasses = isShortDominant
    ? 'bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/30'
    : 'bg-[#FF4B5C]/10 text-[#FF4B5C] border-[#FF4B5C]/30';

  const Icon = isShortDominant ? TrendingUp : TrendingDown;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[9px] font-black uppercase tracking-wider",
        colorClasses,
        className
      )}
      title={`${count} Liquidations (1m)\nTotal: $${totalFormatted}\nShorts: ${shortLiqCount} | Longs: ${longLiqCount}`}
    >
      <Flame size={10} className={showAnimation ? "animate-pulse" : ""} />
      <Icon size={10} />
      <span className="tabular-nums">{count}×</span>
      <span className="tabular-nums">${totalFormatted}</span>
    </div>
  );
});

/**
 * Liquidation Heatmap Indicator
 * Shows liquidation intensity as a colored bar
 */
interface LiquidationHeatmapProps {
  liquidations: LiquidationEvent[];
  symbol: string;
  className?: string;
  timeWindowMs?: number;
}

export const LiquidationHeatmap = memo(function LiquidationHeatmap({
  liquidations,
  symbol,
  className,
  timeWindowMs = 300_000 // Default: last 5 minutes
}: LiquidationHeatmapProps) {
  const now = Date.now();
  const relevantLiquidations = liquidations.filter(
    liq => liq.symbol === symbol && (now - liq.timestamp) < timeWindowMs
  );

  if (relevantLiquidations.length === 0) {
    return null;
  }

  // Calculate intensity (0-100)
  const totalValue = relevantLiquidations.reduce((sum, liq) => sum + liq.valueUsd, 0);
  const intensity = Math.min(100, (totalValue / 1_000_000) * 100); // Scale: $1M = 100%

  // Determine color based on intensity
  const getColor = (intensity: number) => {
    if (intensity >= 75) return '#FF4B5C';
    if (intensity >= 50) return '#f97316';
    if (intensity >= 25) return '#fbbf24';
    return '#84cc16';
  };

  const color = getColor(intensity);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 h-1.5 rounded-full bg-slate-900 overflow-hidden border border-white/5">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${intensity}%`,
            backgroundColor: color,
            boxShadow: `0 0 4px ${color}80`
          }}
        />
      </div>
      <span className="text-[8px] font-black text-slate-500 tabular-nums min-w-[24px]">
        {relevantLiquidations.length}
      </span>
    </div>
  );
});

/**
 * Utility Functions
 */

function formatLiquidationValue(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  return value.toFixed(0);
}

/**
 * Export utility for determining if liquidation is significant
 */
export function isSignificantLiquidation(
  liquidation: LiquidationEvent,
  thresholdUsd: number = 100_000
): boolean {
  return liquidation.valueUsd >= thresholdUsd;
}

/**
 * Export utility for getting liquidation direction
 */
export function getLiquidationDirection(liquidation: LiquidationEvent): {
  direction: 'long' | 'short';
  isBullish: boolean;
} {
  const isShortLiquidated = liquidation.side === 'Buy';
  return {
    direction: isShortLiquidated ? 'short' : 'long',
    isBullish: isShortLiquidated
  };
}
