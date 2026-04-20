'use client';

import { memo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FundingRateData } from '@/lib/derivatives-types';

/**
 * Funding Rate Cell Component
 * Requirements: Requirement 7 (Task 7.1)
 * Design: FundingRateCell component
 * 
 * Features:
 * - Display funding rate with color coding (green positive, red negative)
 * - Add tooltip with annualized rate
 * - Handle missing data with "-"
 * - Compact design for table cells
 * - Memoized for performance
 */

interface FundingRateCellProps {
  data?: FundingRateData;
  className?: string;
  compact?: boolean;
}

export const FundingRateCell = memo(function FundingRateCell({
  data,
  className,
  compact = false
}: FundingRateCellProps) {
  // Handle missing data
  if (!data) {
    return (
      <div className={cn("flex items-center justify-center text-slate-600", className)}>
        <Minus size={12} />
      </div>
    );
  }

  // Determine color based on rate
  const isPositive = data.rate > 0;
  const isNegative = data.rate < 0;
  const isNeutral = data.rate === 0;

  // Format rate as percentage
  const ratePercent = (data.rate * 100).toFixed(4);
  const annualizedPercent = (data.annualized * 100).toFixed(2);

  // Color classes
  const colorClasses = {
    positive: 'text-[#39FF14] bg-[#39FF14]/10 border-[#39FF14]/30',
    negative: 'text-[#FF4B5C] bg-[#FF4B5C]/10 border-[#FF4B5C]/30',
    neutral: 'text-slate-400 bg-slate-800/30 border-slate-700/30'
  };

  const color = isPositive ? colorClasses.positive : isNegative ? colorClasses.negative : colorClasses.neutral;

  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[9px] font-black tabular-nums",
          color,
          className
        )}
        title={`Funding Rate: ${ratePercent}%\nAnnualized: ${annualizedPercent}%`}
      >
        {isPositive && <TrendingUp size={10} />}
        {isNegative && <TrendingDown size={10} />}
        {isNeutral && <Minus size={10} />}
        <span>{ratePercent}%</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-lg border",
        color
      )}>
        {isPositive && <TrendingUp size={12} />}
        {isNegative && <TrendingDown size={12} />}
        {isNeutral && <Minus size={12} />}
        <span className="text-[10px] font-black tabular-nums">{ratePercent}%</span>
      </div>
      
      {/* Tooltip content - shown on hover */}
      <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
        <div>Annual: {annualizedPercent}%</div>
        <div className="text-[7px] text-slate-600 mt-0.5">
          Next: {formatNextFundingTime(data.nextFundingTime)}
        </div>
      </div>
    </div>
  );
});

/**
 * Tooltip-enhanced version with hover details
 */
interface FundingRateCellWithTooltipProps extends FundingRateCellProps {
  showTooltip?: boolean;
}

export const FundingRateCellWithTooltip = memo(function FundingRateCellWithTooltip({
  data,
  className,
  compact = true,
  showTooltip = true
}: FundingRateCellWithTooltipProps) {
  if (!data) {
    return <FundingRateCell data={data} className={className} compact={compact} />;
  }

  const ratePercent = (data.rate * 100).toFixed(4);
  const annualizedPercent = (data.annualized * 100).toFixed(2);
  const isPositive = data.rate > 0;
  const isNegative = data.rate < 0;

  const tooltipContent = `Funding Rate: ${ratePercent}%
Annualized: ${annualizedPercent}%
Mark Price: $${data.markPrice.toFixed(2)}
Index Price: $${data.indexPrice.toFixed(2)}
Next Funding: ${formatNextFundingTime(data.nextFundingTime)}`;

  return (
    <div className="relative group">
      <FundingRateCell data={data} className={className} compact={compact} />
      
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-900 border border-white/10 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-pre-line text-[9px] font-bold text-white min-w-[200px]">
          {tooltipContent}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
});

/**
 * Utility function to format next funding time
 */
function formatNextFundingTime(timestamp: number): string {
  const now = Date.now();
  const diff = timestamp - now;
  
  if (diff < 0) return 'Now';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Utility function to get funding rate color
 */
export function getFundingRateColor(rate: number): {
  text: string;
  bg: string;
  border: string;
} {
  if (rate > 0) {
    return {
      text: 'text-[#39FF14]',
      bg: 'bg-[#39FF14]/10',
      border: 'border-[#39FF14]/30'
    };
  } else if (rate < 0) {
    return {
      text: 'text-[#FF4B5C]',
      bg: 'bg-[#FF4B5C]/10',
      border: 'border-[#FF4B5C]/30'
    };
  }
  return {
    text: 'text-slate-400',
    bg: 'bg-slate-800/30',
    border: 'border-slate-700/30'
  };
}
