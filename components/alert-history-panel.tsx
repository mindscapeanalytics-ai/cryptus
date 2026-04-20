'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff, TrendingUp, TrendingDown, LogOut, ChevronDown,
  Zap, Filter, Calendar, X, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Enhanced Alert History Panel Component
 * Requirements: Requirement 5
 * Design: AlertHistoryPanel, AlertHistoryRow, AlertFilters, AlertDetailModal, OutcomeBadge components
 * 
 * Features:
 * - Display alerts in reverse chronological order
 * - Show symbol, timeframe, type, value, price, timestamp
 * - Add win/loss outcome badges (5m, 15m, 1h)
 * - Display priority with color coding
 * - Filter by alert type and date range
 * - Show conditional alert conditions
 * - Display signal narration in detail modal
 */

export interface Alert {
  id: string;
  symbol: string;
  timeframe: string;
  type: string;
  value: number;
  price?: number;
  createdAt: number | string;
  exchange?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  conditionalAlert?: {
    logic: 'AND' | 'OR';
    conditions: Array<{
      type: string;
      operator: string;
      value: number;
      met: boolean;
    }>;
  };
  outcome?: {
    '5m'?: 'win' | 'loss' | 'pending';
    '15m'?: 'win' | 'loss' | 'pending';
    '1h'?: 'win' | 'loss' | 'pending';
  };
}

interface AlertHistoryPanelProps {
  alerts: Alert[];
  onClose: () => void;
  onClear: () => void;
  getSymbolAlias?: (symbol: string) => string;
  formatPrice?: (price: number) => string;
  formatTimeAgo?: (timestamp: number) => string;
}

type AlertTypeFilter = 'all' | 'OVERSOLD' | 'OVERBOUGHT' | 'STRATEGY_STRONG_BUY' | 'STRATEGY_STRONG_SELL' | 'LONG_CANDLE' | 'VOLUME_SPIKE';

export function AlertHistoryPanel({
  alerts,
  onClose,
  onClear,
  getSymbolAlias = (s) => s,
  formatPrice = (p) => p.toFixed(2),
  formatTimeAgo = (t) => new Date(t).toLocaleString()
}: AlertHistoryPanelProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<AlertTypeFilter>('all');
  const [dateRange, setDateRange] = useState<'all' | '1h' | '24h' | '7d'>('all');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    let filtered = [...alerts];

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(a => a.type === typeFilter);
    }

    // Filter by date range
    if (dateRange !== 'all') {
      const now = Date.now();
      const ranges = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000
      };
      const cutoff = now - ranges[dateRange];
      filtered = filtered.filter(a => {
        const timestamp = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : a.createdAt;
        return timestamp >= cutoff;
      });
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => {
      const aTime = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : a.createdAt;
      const bTime = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : b.createdAt;
      return bTime - aTime;
    });

    return filtered;
  }, [alerts, typeFilter, dateRange]);

  return (
    <>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          "fixed inset-y-0 right-0 z-[200] bg-slate-900/90 backdrop-blur-2xl border-l border-white/10 shadow-2xl overflow-hidden flex flex-col",
          "w-[85vw] sm:w-[24rem]"
        )}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02] sticky top-0 z-10">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
              <Bell size={16} className="text-[#39FF14]" />
              Alert History
            </h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {filteredAlerts.length} of {alerts.length} signals
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
                showFilters
                  ? "bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/20"
                  : "bg-white/5 text-slate-500 border-white/10 hover:text-white"
              )}
            >
              <Filter size={12} />
            </button>
            {alerts.length > 0 && (
              <button
                onClick={onClear}
                className="px-3 py-1.5 rounded-xl bg-[#FF4B5C]/10 text-[#FF4B5C] text-[9px] font-black uppercase tracking-widest hover:bg-[#FF4B5C]/20 transition-all border border-[#FF4B5C]/20"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all hover:bg-white/10"
            >
              {isMobile ? <ChevronDown size={20} /> : <LogOut size={16} className="rotate-180" />}
            </button>
          </div>
        </div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-white/5 bg-slate-950/30 overflow-hidden"
            >
              <div className="p-4 space-y-3">
                {/* Type Filter */}
                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Alert Type</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as AlertTypeFilter)}
                    className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#39FF14]/30 transition-all"
                  >
                    <option value="all">All Types</option>
                    <option value="OVERSOLD">Oversold</option>
                    <option value="OVERBOUGHT">Overbought</option>
                    <option value="STRATEGY_STRONG_BUY">Strong Buy</option>
                    <option value="STRATEGY_STRONG_SELL">Strong Sell</option>
                    <option value="LONG_CANDLE">Long Candle</option>
                    <option value="VOLUME_SPIKE">Volume Spike</option>
                  </select>
                </div>

                {/* Date Range Filter */}
                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Time Range</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['all', '1h', '24h', '7d'] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setDateRange(range)}
                        className={cn(
                          "px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border",
                          dateRange === range
                            ? "bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/20"
                            : "bg-white/5 text-slate-500 border-white/10 hover:text-white"
                        )}
                      >
                        {range === 'all' ? 'All' : range}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Alert List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-gradient-to-b from-transparent to-slate-950/20">
          <AnimatePresence initial={false} mode="popLayout">
            {filteredAlerts.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-24 text-center space-y-4"
              >
                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center border border-white/5">
                  <BellOff size={24} className="text-slate-600" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    {alerts.length === 0 ? 'No signals detected' : 'No matching alerts'}
                  </p>
                  <p className="text-[10px] font-bold text-slate-700 uppercase mt-1">
                    {alerts.length === 0 ? 'Watching markets real-time...' : 'Try adjusting filters'}
                  </p>
                </div>
              </motion.div>
            ) : (
              filteredAlerts.map((alert, idx) => (
                <AlertHistoryRow
                  key={alert.id || idx}
                  alert={alert}
                  getSymbolAlias={getSymbolAlias}
                  formatPrice={formatPrice}
                  formatTimeAgo={formatTimeAgo}
                  onClick={() => setSelectedAlert(alert)}
                />
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-slate-900/50">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#39FF14]/10 flex items-center justify-center shrink-0 border border-[#39FF14]/20">
              <Zap size={20} className="text-[#39FF14]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Real-time Stream</span>
              <span className="text-[8px] font-bold text-slate-500 uppercase mt-0.5 leading-tight">
                Monitoring all configured exchanges
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Alert Detail Modal */}
      <AnimatePresence>
        {selectedAlert && (
          <AlertDetailModal
            alert={selectedAlert}
            onClose={() => setSelectedAlert(null)}
            getSymbolAlias={getSymbolAlias}
            formatPrice={formatPrice}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// Alert History Row Component
interface AlertHistoryRowProps {
  alert: Alert;
  getSymbolAlias: (symbol: string) => string;
  formatPrice: (price: number) => string;
  formatTimeAgo: (timestamp: number) => string;
  onClick: () => void;
}

function AlertHistoryRow({
  alert,
  getSymbolAlias,
  formatPrice,
  formatTimeAgo,
  onClick
}: AlertHistoryRowProps) {
  const { label, isBullish } = formatAlertType(alert.type);
  const createdAt = typeof alert.createdAt === 'string' ? new Date(alert.createdAt).getTime() : alert.createdAt;
  const isNew = Date.now() - createdAt < 30000;
  const priorityColor = getPriorityColor(alert.priority);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 30, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onClick={onClick}
      className={cn(
        "p-5 rounded-2xl border transition-all relative overflow-hidden group min-h-[5.5rem] flex flex-col justify-center cursor-pointer",
        "bg-slate-800/30 backdrop-blur-sm border-white/5",
        isBullish ? "hover:border-[#39FF14]/30 hover:bg-[#39FF14]/5" : "hover:border-[#FF4B5C]/30 hover:bg-[#FF4B5C]/5"
      )}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-white tracking-widest">{getSymbolAlias(alert.symbol)}</span>
            {alert.exchange && (
              <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-slate-500 text-[8px] font-black uppercase tracking-tighter">
                {alert.exchange}
              </span>
            )}
            {alert.priority && alert.priority !== 'medium' && (
              <span className={cn(
                "px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter",
                priorityColor.bg, priorityColor.text
              )}>
                {alert.priority}
              </span>
            )}
            {isNew && (
              <span className="flex h-1.5 w-1.5 rounded-full bg-[#39FF14] animate-ping" />
            )}
          </div>
          <span className="text-[10px] font-black uppercase opacity-60 mt-1">{alert.timeframe} Signal</span>
        </div>
        <span suppressHydrationWarning className="text-[8px] font-bold text-slate-500 uppercase tabular-nums">
          {formatTimeAgo(createdAt)}
        </span>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className={cn(
          "flex items-center gap-2 px-2.5 py-1 rounded-lg border",
          isBullish
            ? "bg-[#39FF14]/10 border-[#39FF14]/30 text-[#39FF14]"
            : "bg-[#FF4B5C]/10 border-[#FF4B5C]/30 text-[#FF4B5C]"
        )}>
          {isBullish ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          <span className="text-[9px] font-black uppercase tracking-[0.1em]">{label}</span>
        </div>
        <div className="text-right flex items-center gap-4">
          {alert.price && (
            <div className="text-right border-r border-white/10 pr-4">
              <div className="text-[10px] font-black text-white tabular-nums tracking-wider">
                ${formatPrice(alert.price)}
              </div>
              <div className="text-[7px] font-bold text-slate-600 uppercase tracking-widest">Price</div>
            </div>
          )}
          <div>
            <div className="text-[10px] font-black text-white/90 tabular-nums">
              {alert.value.toFixed(2)}
            </div>
            <div className="text-[7px] font-bold text-slate-600 uppercase tracking-widest">Reading</div>
          </div>
        </div>
      </div>

      {/* Outcome Badges */}
      {alert.outcome && (
        <div className="flex items-center gap-2 mt-2">
          {(['5m', '15m', '1h'] as const).map((tf) => {
            const outcome = alert.outcome?.[tf];
            if (!outcome) return null;
            return (
              <OutcomeBadge key={tf} timeframe={tf} outcome={outcome} />
            );
          })}
        </div>
      )}

      {/* Conditional Alert Indicator */}
      {alert.conditionalAlert && (
        <div className="mt-2 flex items-center gap-1 text-[8px] text-purple-400">
          <Info size={10} />
          <span className="font-bold uppercase tracking-wider">Conditional</span>
        </div>
      )}

      {/* Priority Edge */}
      <div className={cn(
        "absolute top-0 right-0 bottom-0 w-[3px]",
        isBullish ? "bg-[#39FF14]/40 shadow-[0_0_10px_rgba(57,255,20,0.3)]" : "bg-[#FF4B5C]/40 shadow-[0_0_10px_rgba(255,75,92,0.3)]"
      )} />
    </motion.div>
  );
}

// Outcome Badge Component
interface OutcomeBadgeProps {
  timeframe: '5m' | '15m' | '1h';
  outcome: 'win' | 'loss' | 'pending';
}

function OutcomeBadge({ timeframe, outcome }: OutcomeBadgeProps) {
  const colors = {
    win: 'bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/30',
    loss: 'bg-[#FF4B5C]/10 text-[#FF4B5C] border-[#FF4B5C]/30',
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
  };

  const labels = {
    win: '✓',
    loss: '✗',
    pending: '⋯'
  };

  return (
    <div className={cn(
      "px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-wider",
      colors[outcome]
    )}>
      {labels[outcome]} {timeframe}
    </div>
  );
}

// Alert Detail Modal Component
interface AlertDetailModalProps {
  alert: Alert;
  onClose: () => void;
  getSymbolAlias: (symbol: string) => string;
  formatPrice: (price: number) => string;
}

function AlertDetailModal({
  alert,
  onClose,
  getSymbolAlias,
  formatPrice
}: AlertDetailModalProps) {
  const { label, isBullish } = formatAlertType(alert.type);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-white">{getSymbolAlias(alert.symbol)}</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                {alert.timeframe} {label}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Alert Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Value</div>
              <div className="text-lg font-black text-white">{alert.value.toFixed(2)}</div>
            </div>
            {alert.price && (
              <div>
                <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Price</div>
                <div className="text-lg font-black text-white">${formatPrice(alert.price)}</div>
              </div>
            )}
          </div>

          {/* Conditional Alert Conditions */}
          {alert.conditionalAlert && (
            <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
              <div className="text-[8px] font-black uppercase tracking-widest text-purple-400 mb-2">
                Conditional Alert ({alert.conditionalAlert.logic})
              </div>
              <div className="space-y-2">
                {alert.conditionalAlert.conditions.map((cond, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[9px]">
                    <span className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center text-[8px]",
                      cond.met ? "bg-[#39FF14]/20 text-[#39FF14]" : "bg-slate-700 text-slate-500"
                    )}>
                      {cond.met ? '✓' : '○'}
                    </span>
                    <span className="text-white font-bold">
                      {cond.type} {cond.operator} {cond.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outcome */}
          {alert.outcome && (
            <div className="p-4 rounded-xl bg-slate-950/30 border border-white/5">
              <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">Outcome</div>
              <div className="flex items-center gap-2">
                {(['5m', '15m', '1h'] as const).map((tf) => {
                  const outcome = alert.outcome?.[tf];
                  if (!outcome) return null;
                  return <OutcomeBadge key={tf} timeframe={tf} outcome={outcome} />;
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// Utility Functions
function formatAlertType(type: string): { label: string; isBullish: boolean } {
  switch (type) {
    case 'OVERSOLD': return { label: 'Oversold', isBullish: true };
    case 'OVERBOUGHT': return { label: 'Overbought', isBullish: false };
    case 'STRATEGY_STRONG_BUY': return { label: 'Strong Buy', isBullish: true };
    case 'STRATEGY_STRONG_SELL': return { label: 'Strong Sell', isBullish: false };
    case 'LONG_CANDLE': return { label: 'Long Candle', isBullish: true };
    case 'VOLUME_SPIKE': return { label: 'Volume Spike', isBullish: true };
    default: return { label: type, isBullish: true };
  }
}

function getPriorityColor(priority?: string) {
  switch (priority) {
    case 'low':
      return { bg: 'bg-blue-500/10', text: 'text-blue-400' };
    case 'high':
      return { bg: 'bg-orange-500/10', text: 'text-orange-400' };
    case 'critical':
      return { bg: 'bg-red-500/10', text: 'text-red-400' };
    default:
      return { bg: 'bg-white/5', text: 'text-slate-400' };
  }
}
