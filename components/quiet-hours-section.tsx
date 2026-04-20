'use client';

import { useState } from 'react';
import { Clock, Moon, Sun, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Quiet Hours Section Component
 * Requirements: Requirement 4
 * Design: QuietHoursSection, TimeRangePicker, QuietHoursTimeline components
 * 
 * Features:
 * - Enable/disable toggle for quiet hours
 * - Time pickers for start/end hours (0-23)
 * - Visual 24-hour timeline with shaded active region
 * - Explanation text about high/critical priority bypass
 * - Mobile-responsive and touch-friendly
 */

interface QuietHoursSectionProps {
  enabled: boolean;
  startHour: number; // 0-23
  endHour: number; // 0-23
  onEnabledChange: (enabled: boolean) => void;
  onStartHourChange: (hour: number) => void;
  onEndHourChange: (hour: number) => void;
  disabled?: boolean;
  className?: string;
}

export function QuietHoursSection({
  enabled,
  startHour,
  endHour,
  onEnabledChange,
  onStartHourChange,
  onEndHourChange,
  disabled = false,
  className
}: QuietHoursSectionProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {/* Toggle Header */}
      <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/20 group">
        <div className="flex flex-col">
          <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
            <Clock size={11} />
            Quiet Hours
          </span>
          <span className="text-[7px] text-slate-500 font-bold uppercase mt-0.5 leading-tight pr-4">
            Suppress low/medium priority alerts
          </span>
        </div>
        <button
          onClick={() => onEnabledChange(!enabled)}
          disabled={disabled}
          className={cn(
            "w-9 h-4.5 rounded-full p-0.5 transition-all flex items-center",
            enabled ? "bg-purple-500" : "bg-slate-800",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className={cn(
            "w-3.5 h-3.5 rounded-full bg-white transition-all shadow-sm",
            enabled ? "translate-x-4.5" : "translate-x-0"
          )} />
        </button>
      </div>

      {/* Expanded Configuration */}
      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {/* Time Pickers */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <span className="text-[7px] font-bold text-slate-500 uppercase tracking-wider ml-0.5 flex items-center gap-1">
                  <Moon size={9} className="text-purple-400" />
                  Start (24h)
                </span>
                <select
                  value={startHour}
                  onChange={(e) => onStartHourChange(parseInt(e.target.value))}
                  disabled={disabled}
                  className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500/30 transition-all disabled:opacity-50"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i.toString().padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <span className="text-[7px] font-bold text-slate-500 uppercase tracking-wider ml-0.5 flex items-center gap-1">
                  <Sun size={9} className="text-amber-400" />
                  End (24h)
                </span>
                <select
                  value={endHour}
                  onChange={(e) => onEndHourChange(parseInt(e.target.value))}
                  disabled={disabled}
                  className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500/30 transition-all disabled:opacity-50"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i.toString().padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Visual 24-Hour Timeline */}
            <QuietHoursTimeline startHour={startHour} endHour={endHour} />

            {/* Explanation Text */}
            <div className="p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/20">
              <p className="text-[8px] text-purple-300 font-bold leading-tight flex items-start gap-2">
                <Info size={12} className="shrink-0 mt-0.5" />
                <span>
                  High and critical priority alerts will bypass quiet hours and still notify you.
                  Only low and medium priority alerts are suppressed during this time.
                </span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Visual 24-Hour Timeline Component
 * Shows a visual representation of the 24-hour day with shaded active region
 */
interface QuietHoursTimelineProps {
  startHour: number;
  endHour: number;
}

function QuietHoursTimeline({ startHour, endHour }: QuietHoursTimelineProps) {
  // Generate hour markers (0, 6, 12, 18)
  const majorHours = [0, 6, 12, 18];

  // Calculate if quiet hours span midnight
  const spansMidnight = endHour <= startHour;

  return (
    <div className="space-y-2">
      <span className="text-[7px] font-bold text-slate-500 uppercase tracking-wider ml-0.5 flex items-center gap-1">
        <Clock size={9} className="text-purple-400" />
        Active Period
      </span>

      {/* Timeline Container */}
      <div className="relative h-12 bg-slate-950/50 border border-white/5 rounded-xl overflow-hidden">
        {/* Hour Grid Lines */}
        <div className="absolute inset-0 flex">
          {Array.from({ length: 24 }, (_, i) => (
            <div
              key={i}
              className="flex-1 border-r border-white/5 last:border-r-0"
            />
          ))}
        </div>

        {/* Quiet Hours Shaded Region */}
        {spansMidnight ? (
          <>
            {/* From start to midnight */}
            <div
              className="absolute top-0 bottom-0 bg-purple-500/20 border-l-2 border-r-2 border-purple-500/40"
              style={{
                left: `${(startHour / 24) * 100}%`,
                right: '0%'
              }}
            />
            {/* From midnight to end */}
            <div
              className="absolute top-0 bottom-0 bg-purple-500/20 border-l-2 border-r-2 border-purple-500/40"
              style={{
                left: '0%',
                right: `${((24 - endHour) / 24) * 100}%`
              }}
            />
          </>
        ) : (
          <div
            className="absolute top-0 bottom-0 bg-purple-500/20 border-l-2 border-r-2 border-purple-500/40"
            style={{
              left: `${(startHour / 24) * 100}%`,
              right: `${((24 - endHour) / 24) * 100}%`
            }}
          />
        )}

        {/* Hour Labels */}
        <div className="absolute inset-0 flex items-center justify-between px-2">
          {majorHours.map((hour) => (
            <div
              key={hour}
              className="flex flex-col items-center"
              style={{
                position: 'absolute',
                left: `${(hour / 24) * 100}%`,
                transform: 'translateX(-50%)'
              }}
            >
              <div className="h-2 w-px bg-white/20" />
              <span className="text-[7px] font-bold text-slate-500 mt-1">
                {hour.toString().padStart(2, '0')}
              </span>
            </div>
          ))}
        </div>

        {/* Start/End Markers */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-purple-500"
          style={{ left: `${(startHour / 24) * 100}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-purple-500 border-2 border-slate-950" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-purple-500 border-2 border-slate-950" />
        </div>
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-purple-500"
          style={{ left: `${(endHour / 24) * 100}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-purple-500 border-2 border-slate-950" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-purple-500 border-2 border-slate-950" />
        </div>
      </div>

      {/* Time Range Display */}
      <div className="flex items-center justify-center gap-2 text-[8px] font-bold text-purple-400">
        <span>{startHour.toString().padStart(2, '0')}:00</span>
        <span className="text-slate-600">→</span>
        <span>{endHour.toString().padStart(2, '0')}:00</span>
        {spansMidnight && (
          <span className="text-[7px] text-slate-500 ml-1">(spans midnight)</span>
        )}
      </div>
    </div>
  );
}
