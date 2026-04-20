'use client';

import { memo } from 'react';
import { Flame, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Priority Selector Component
 * Requirements: Requirement 8 (Task 6.1)
 * Design: PrioritySelector component
 * 
 * Features:
 * - Dropdown with options: low, medium, high, critical
 * - Display behavior explanation for each level
 * - Show current selection
 * - Reusable across different contexts
 */

export type AlertPriority = 'low' | 'medium' | 'high' | 'critical';

interface PrioritySelectorProps {
  value: AlertPriority;
  onChange: (priority: AlertPriority) => void;
  disabled?: boolean;
  className?: string;
  showLabel?: boolean;
  showInfo?: boolean;
}

export const PrioritySelector = memo(function PrioritySelector({
  value,
  onChange,
  disabled = false,
  className,
  showLabel = true,
  showInfo = true
}: PrioritySelectorProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {showLabel && (
        <label className="text-[7px] font-bold text-slate-500 uppercase tracking-wider ml-0.5 flex items-center gap-1">
          <Flame size={10} className="text-orange-400" />
          Priority
        </label>
      )}
      
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AlertPriority)}
        disabled={disabled}
        className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#39FF14]/30 transition-all disabled:opacity-50 cursor-pointer"
      >
        <option value="low">🔵 Low</option>
        <option value="medium">🟢 Medium</option>
        <option value="high">🟠 High</option>
        <option value="critical">🔴 Critical</option>
      </select>

      {showInfo && (
        <div className="p-2 rounded-xl bg-slate-950/30 border border-white/5">
          <div className="flex items-start gap-1.5">
            <Info size={10} className="text-slate-500 shrink-0 mt-0.5" />
            <p className="text-[8px] text-slate-500 font-bold leading-tight">
              {getPriorityInfo(value)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * Priority Badge Component
 * Requirements: Requirement 8 (Task 6.3)
 * Design: PriorityBadge component
 * 
 * Features:
 * - Display color-coded badge for non-default priorities
 * - Compact design for inline display
 * - Only shows for non-medium priorities
 */

interface PriorityBadgeProps {
  priority: AlertPriority;
  className?: string;
  showLabel?: boolean;
}

export const PriorityBadge = memo(function PriorityBadge({
  priority,
  className,
  showLabel = true
}: PriorityBadgeProps) {
  // Don't show badge for default (medium) priority
  if (priority === 'medium') {
    return null;
  }

  const config = getPriorityConfig(priority);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-wider",
        config.bg,
        config.text,
        config.border,
        className
      )}
      title={getPriorityInfo(priority)}
    >
      <Flame size={8} />
      {showLabel && <span>{config.label}</span>}
    </div>
  );
});

/**
 * Utility Functions
 */

function getPriorityInfo(priority: AlertPriority): string {
  switch (priority) {
    case 'low':
      return 'Low: Soft sound, 5s toast notification';
    case 'medium':
      return 'Medium: Default sound, 8s toast notification';
    case 'high':
      return 'High: Bell sound, 12s persistent notification';
    case 'critical':
      return 'Critical: Urgent sound, requires user interaction';
  }
}

function getPriorityConfig(priority: AlertPriority) {
  switch (priority) {
    case 'low':
      return {
        label: 'Low',
        emoji: '🔵',
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30'
      };
    case 'medium':
      return {
        label: 'Medium',
        emoji: '🟢',
        bg: 'bg-[#39FF14]/10',
        text: 'text-[#39FF14]',
        border: 'border-[#39FF14]/30'
      };
    case 'high':
      return {
        label: 'High',
        emoji: '🟠',
        bg: 'bg-orange-500/10',
        text: 'text-orange-400',
        border: 'border-orange-500/30'
      };
    case 'critical':
      return {
        label: 'Critical',
        emoji: '🔴',
        bg: 'bg-[#FF4B5C]/10',
        text: 'text-[#FF4B5C]',
        border: 'border-[#FF4B5C]/30'
      };
  }
}

/**
 * Export utility for getting priority color
 */
export function getPriorityColor(priority: AlertPriority): {
  bg: string;
  text: string;
  border: string;
} {
  return getPriorityConfig(priority);
}

/**
 * Export utility for priority comparison
 */
export function isPriorityHigherThan(
  priority1: AlertPriority,
  priority2: AlertPriority
): boolean {
  const levels = { low: 0, medium: 1, high: 2, critical: 3 };
  return levels[priority1] > levels[priority2];
}
