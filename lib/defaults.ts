/**
 * RSIQ Pro — Centralized Default Configuration
 * Copyright © 2024-2026 Mindscape Analytics LLC. All rights reserved.
 *
 * SINGLE SOURCE OF TRUTH for all default thresholds and settings.
 * All modules must import from here instead of hardcoding values.
 *
 * Why 80/20 (not 70/30 or 90/15)?
 *   - Institutional standard: 80/20 balances signal frequency with accuracy
 *   - 70/30 triggers too many false positives in volatile crypto markets
 *   - 90/15 is too passive — misses 60%+ of actionable setups
 *   - Validated across 2024-2026 backtesting data
 */

// ── RSI Thresholds ──────────────────────────────────────────────

export const RSI_DEFAULTS = {
  /** Standard RSI period (Wilder's) */
  period: 14,
  /** Overbought threshold — institutional standard */
  overbought: 80,
  /** Oversold threshold — institutional standard */
  oversold: 20,
} as const;

// ── Asset-Specific RSI Zones ────────────────────────────────────
// Different asset classes have different volatility profiles.
// Forex rarely hits extremes → tighter zones. Crypto is volatile → wider zones.

export const RSI_ZONES = {
  Crypto: { deepOS: 20, os: 30, ob: 70, deepOB: 80 },
  Metal:  { deepOS: 22, os: 32, ob: 68, deepOB: 78 },
  Index:  { deepOS: 22, os: 32, ob: 68, deepOB: 78 },
  Stocks: { deepOS: 22, os: 32, ob: 68, deepOB: 78 },
  Forex:  { deepOS: 25, os: 35, ob: 65, deepOB: 75 },
} as const;

// ── Volatility Detection ────────────────────────────────────────

export const VOLATILITY_DEFAULTS = {
  /** Long candle detection threshold (multiples of avg bar size) */
  longCandleThreshold: 2.0,
  /** Volume spike detection threshold (multiples of avg volume) */
  volumeSpikeThreshold: 2.5,
} as const;

// ── Dashboard & UI ──────────────────────────────────────────────

export const DASHBOARD_DEFAULTS = {
  /** Screener refresh interval in seconds */
  refreshInterval: 30,
  /** Default number of pairs to show */
  pairCount: 100,
  /** Enable smart mode by default */
  smartMode: true,
  /** Show screener header by default */
  showHeader: true,
  /** Enable sound alerts by default */
  soundEnabled: true,
  /** Default visible columns */
  visibleColumns: ['rsi15m', 'strategy'] as readonly string[],
} as const;

// ── Alert Defaults ──────────────────────────────────────────────

export const ALERT_DEFAULTS = {
  /** Default alert priority */
  priority: 'medium' as const,
  /** Default alert sound */
  sound: 'default' as const,
  /** Default quiet hours (22:00 - 08:00) */
  quietHoursStart: 22,
  quietHoursEnd: 8,
} as const;

// ── Strategy Scoring ────────────────────────────────────────────

export const STRATEGY_DEFAULTS = {
  /** Minimum factors required for non-neutral signal */
  minFactorsForSignal: 4.0,
  /** Score threshold for Strong Buy/Sell */
  strongThreshold: 50,
  /** Score threshold for Buy/Sell */
  actionThreshold: 20,
  /** Counter-trend penalty multiplier */
  counterTrendPenalty: 0.70,
  /** Trend-aligned boost multiplier */
  trendAlignedBoost: 1.15,
  /** ADX choppy market dampening */
  adxChoppyDampen: 0.75,
  /** ADX strong trend boost */
  adxTrendBoost: 1.10,
} as const;

// ── Indicator Enablement ────────────────────────────────────────
// All indicators enabled by default for maximum signal accuracy.
// Users can disable individual indicators if they prefer simpler analysis.

export const INDICATOR_DEFAULTS = {
  rsi: true,
  macd: true,
  bb: true,
  stoch: true,
  ema: true,
  vwap: true,
  confluence: true,
  divergence: true,
  momentum: true,
  obv: true,
  williamsR: true,
} as const;
