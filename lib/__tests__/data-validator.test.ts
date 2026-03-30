import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateKline,
  detectOutliers,
  interpolateMissingCandles,
  isYahooDataStale,
} from '../data-validator';
import type { BinanceKline } from '../types';

// Helper to build a valid BinanceKline
function makeKline(
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
  openTime = 1000000,
): BinanceKline {
  return [
    openTime,
    open.toString(),
    high.toString(),
    low.toString(),
    close.toString(),
    volume.toString(),
    openTime + 59999,
    '0',
    0,
    '0',
    '0',
    '0',
  ];
}

// ── validateKline ──────────────────────────────────────────────────────────────

describe('validateKline', () => {
  it('passes a valid kline', () => {
    const kline = makeKline(100, 110, 90, 105, 1000);
    const result = validateKline(kline);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('rejects kline with NaN in close', () => {
    const kline = makeKline(100, 110, 90, NaN, 1000);
    const result = validateKline(kline);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('NaN or Infinity'))).toBe(true);
  });

  it('rejects kline with Infinity in open', () => {
    const kline = makeKline(Infinity, 110, 90, 105, 1000);
    const result = validateKline(kline);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('NaN or Infinity'))).toBe(true);
  });

  it('rejects kline where low > open (OHLC violation)', () => {
    const kline = makeKline(80, 110, 95, 105, 1000); // low=95 > open=80 is fine; let's make low > open
    const badKline = makeKline(80, 110, 85, 105, 1000);
    // low=85 > open=80 → violation
    const klineLowGtOpen = makeKline(80, 110, 85, 105, 1000);
    // Actually low=85 > open=80 is a violation
    const result = validateKline(klineLowGtOpen);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Low') && e.includes('Open'))).toBe(true);
  });

  it('rejects kline where close > high (OHLC violation)', () => {
    const kline = makeKline(100, 110, 90, 120, 1000); // close=120 > high=110
    const result = validateKline(kline);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Close') && e.includes('High'))).toBe(true);
  });

  it('rejects kline where low > high', () => {
    const kline = makeKline(100, 90, 95, 92, 1000); // low=95 > high=90
    const result = validateKline(kline);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Low') && e.includes('High'))).toBe(true);
  });

  it('warns but passes for zero volume', () => {
    const kline = makeKline(100, 110, 90, 105, 0);
    const result = validateKline(kline);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes('zero'))).toBe(true);
  });

  it('passes kline where open equals high equals low equals close (doji)', () => {
    const kline = makeKline(100, 100, 100, 100, 500);
    const result = validateKline(kline);
    expect(result.isValid).toBe(true);
  });
});

// ── detectOutliers ─────────────────────────────────────────────────────────────

describe('detectOutliers', () => {
  it('returns no outliers for stable prices', () => {
    const klines = [
      makeKline(100, 105, 95, 100, 1000, 0),
      makeKline(100, 106, 96, 101, 1000, 60000),
      makeKline(101, 107, 97, 102, 1000, 120000),
    ];
    const report = detectOutliers(klines);
    expect(report.hasOutliers).toBe(false);
    expect(report.outlierIndices).toHaveLength(0);
  });

  it('detects outlier when close changes by exactly 50% (threshold is exclusive)', () => {
    // 50% change: 100 → 150 = 50% change, which is NOT > 0.5, so no outlier
    const klines = [
      makeKline(100, 105, 95, 100, 1000, 0),
      makeKline(150, 155, 145, 150, 1000, 60000),
    ];
    const report = detectOutliers(klines);
    expect(report.hasOutliers).toBe(false);
  });

  it('detects outlier when close changes by more than 50%', () => {
    // 100 → 151 = 51% change
    const klines = [
      makeKline(100, 105, 95, 100, 1000, 0),
      makeKline(151, 160, 148, 151, 1000, 60000),
    ];
    const report = detectOutliers(klines);
    expect(report.hasOutliers).toBe(true);
    expect(report.outlierIndices).toContain(1);
  });

  it('tracks maxPriceChange correctly', () => {
    const klines = [
      makeKline(100, 105, 95, 100, 1000, 0),
      makeKline(110, 115, 105, 110, 1000, 60000), // 10% change
      makeKline(110, 115, 105, 130, 1000, 120000), // ~18% change
    ];
    const report = detectOutliers(klines);
    expect(report.maxPriceChange).toBeCloseTo(0.1818, 3);
  });

  it('returns empty report for single kline', () => {
    const klines = [makeKline(100, 105, 95, 100, 1000, 0)];
    const report = detectOutliers(klines);
    expect(report.hasOutliers).toBe(false);
    expect(report.maxPriceChange).toBe(0);
  });
});

// ── interpolateMissingCandles ──────────────────────────────────────────────────

describe('interpolateMissingCandles', () => {
  it('returns same klines when no gaps exist', () => {
    const klines = [
      makeKline(100, 105, 95, 100, 1000, 0),
      makeKline(100, 106, 96, 101, 1000, 60000),
      makeKline(101, 107, 97, 102, 1000, 120000),
    ];
    const result = interpolateMissingCandles(klines, 1);
    expect(result).toHaveLength(3);
  });

  it('fills a single missing 1m candle', () => {
    // Gap: 0 → 120000 (2 minutes apart, expected 1 minute → 1 missing candle)
    const klines = [
      makeKline(100, 105, 95, 100, 1000, 0),
      makeKline(102, 108, 98, 102, 1000, 120000),
    ];
    const result = interpolateMissingCandles(klines, 1);
    expect(result).toHaveLength(3);

    // Synthetic candle at 60000
    const synthetic = result[1];
    expect(synthetic[0]).toBe(60000); // openTime
    expect(synthetic[1]).toBe('100'); // open = prevClose
    expect(synthetic[2]).toBe('100'); // high = prevClose
    expect(synthetic[3]).toBe('100'); // low = prevClose
    expect(synthetic[4]).toBe('100'); // close = prevClose
    expect(synthetic[5]).toBe('0');   // volume = 0
  });

  it('fills multiple missing candles', () => {
    // Gap: 0 → 300000 (5 minutes apart, expected 1 minute → 4 missing candles)
    const klines = [
      makeKline(100, 105, 95, 100, 1000, 0),
      makeKline(105, 110, 100, 105, 1000, 300000),
    ];
    const result = interpolateMissingCandles(klines, 1);
    expect(result).toHaveLength(6); // 1 original + 4 synthetic + 1 original

    // All synthetic candles should have OHLC = 100 (prevClose)
    for (let i = 1; i <= 4; i++) {
      expect(result[i][4]).toBe('100');
      expect(result[i][5]).toBe('0');
    }
  });

  it('returns same array for single kline', () => {
    const klines = [makeKline(100, 105, 95, 100, 1000, 0)];
    const result = interpolateMissingCandles(klines, 1);
    expect(result).toHaveLength(1);
  });

  it('does not fill when gap is within 1.5x threshold', () => {
    // Gap of 1.4x expected interval should not trigger interpolation
    const expectedMs = 60000;
    const klines = [
      makeKline(100, 105, 95, 100, 1000, 0),
      makeKline(101, 106, 96, 101, 1000, Math.floor(expectedMs * 1.4)),
    ];
    const result = interpolateMissingCandles(klines, 1);
    expect(result).toHaveLength(2);
  });
});

// ── isYahooDataStale ───────────────────────────────────────────────────────────

describe('isYahooDataStale', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false for a fresh timestamp (30 minutes ago)', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const thirtyMinutesAgo = now - 30 * 60 * 1000;
    expect(isYahooDataStale(thirtyMinutesAgo)).toBe(false);
  });

  it('returns true for a stale timestamp (more than 1 hour ago)', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const twoHoursAgo = now - 2 * 60 * 60 * 1000;
    expect(isYahooDataStale(twoHoursAgo)).toBe(true);
  });

  it('returns false for a timestamp exactly 1 hour ago (boundary)', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const exactlyOneHourAgo = now - 60 * 60 * 1000;
    // Exactly 1 hour is NOT stale (> 1 hour required)
    expect(isYahooDataStale(exactlyOneHourAgo)).toBe(false);
  });

  it('returns true for a timestamp 1 hour + 1ms ago', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const justOverOneHour = now - (60 * 60 * 1000 + 1);
    expect(isYahooDataStale(justOverOneHour)).toBe(true);
  });
});
