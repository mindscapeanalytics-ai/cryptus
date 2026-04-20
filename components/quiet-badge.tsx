'use client';

import { Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Quiet Badge Component
 * Requirements: Requirement 4 (Acceptance Criteria 6)
 * Design: QuietBadge component
 * 
 * Features:
 * - Display "Quiet" badge on symbols with active quiet hours
 * - Check current time against quiet hours range
 * - Handle midnight-spanning periods
 * - Purple-themed styling matching QuietHoursSection
 */

interface QuietBadgeProps {
  quietHoursEnabled: boolean;
  quietHoursStart: number; // 0-23
  quietHoursEnd: number; // 0-23
  className?: string;
}

export function QuietBadge({
  quietHoursEnabled,
  quietHoursStart,
  quietHoursEnd,
  className
}: QuietBadgeProps) {
  // Don't show badge if quiet hours are not enabled
  if (!quietHoursEnabled) {
    return null;
  }

  // Check if current time is within quiet hours
  const isCurrentlyQuiet = isInQuietHours(quietHoursStart, quietHoursEnd);

  // Only show badge if currently in quiet hours
  if (!isCurrentlyQuiet) {
    return null;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md",
        "bg-purple-500/10 border border-purple-500/30",
        "text-[7px] font-black uppercase tracking-wider text-purple-400",
        className
      )}
      title="Quiet hours active - low/medium priority alerts suppressed"
    >
      <Moon size={8} className="shrink-0" />
      <span>Quiet</span>
    </div>
  );
}

/**
 * Check if current time is within quiet hours range
 * Handles midnight-spanning periods correctly
 */
function isInQuietHours(startHour: number, endHour: number): boolean {
  const now = new Date();
  const currentHour = now.getHours();

  // Check if quiet hours span midnight (e.g., 22:00 to 08:00)
  const spansMidnight = endHour <= startHour;

  if (spansMidnight) {
    // If spans midnight, we're in quiet hours if:
    // - current hour >= start (e.g., 22, 23)
    // - OR current hour < end (e.g., 0, 1, 2, ..., 7)
    return currentHour >= startHour || currentHour < endHour;
  } else {
    // Normal range (e.g., 08:00 to 17:00)
    // We're in quiet hours if current hour is between start and end
    return currentHour >= startHour && currentHour < endHour;
  }
}

/**
 * Hook to check if quiet hours are currently active
 * Can be used in other components that need to react to quiet hours status
 */
export function useIsQuietHours(
  quietHoursEnabled: boolean,
  quietHoursStart: number,
  quietHoursEnd: number
): boolean {
  if (!quietHoursEnabled) {
    return false;
  }

  return isInQuietHours(quietHoursStart, quietHoursEnd);
}
