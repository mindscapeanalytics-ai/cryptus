import type { BinanceKline } from './types';

// Kline indices
// [openTime, open, high, low, close, volume, closeTime, ...]
const IDX_OPEN = 1;
const IDX_HIGH = 2;
const IDX_LOW = 3;
const IDX_CLOSE = 4;
const IDX_VOLUME = 5;
const IDX_OPEN_TIME = 0;

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface OutlierReport {
  hasOutliers: boolean;
  outlierIndices: number[];
  maxPriceChange: number;
}

/**
 * Validates a single kline for data integrity.
 * Checks NaN/Infinity, OHLC relationships, and zero volume.
 */
export function validateKline(kline: BinanceKline): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const open = parseFloat(kline[IDX_OPEN] as string);
  const high = parseFloat(kline[IDX_HIGH] as string);
  const low = parseFloat(kline[IDX_LOW] as string);
  const close = parseFloat(kline[IDX_CLOSE] as string);
  const volume = parseFloat(kline[IDX_VOLUME] as string);

  // Check for NaN or Infinity in all OHLCV values
  const values = [open, high, low, close, volume];
  if (values.some((v) => !isFinite(v) || isNaN(v))) {
    errors.push('Kline contains NaN or Infinity values');
    return { isValid: false, errors, warnings };
  }

  // Validate OHLC relationships: Low ≤ Open ≤ High
  if (low > open) {
    errors.push(`Low (${low}) exceeds Open (${open})`);
  }
  if (open > high) {
    errors.push(`Open (${open}) exceeds High (${high})`);
  }

  // Validate OHLC relationships: Low ≤ Close ≤ High
  if (low > close) {
    errors.push(`Low (${low}) exceeds Close (${close})`);
  }
  if (close > high) {
    errors.push(`Close (${close}) exceeds High (${high})`);
  }

  // Validate Low ≤ High
  if (low > high) {
    errors.push(`Low (${low}) exceeds High (${high})`);
  }

  // Warn on zero volume (valid but unreliable for volume indicators)
  if (volume === 0) {
    warnings.push('Volume is zero - volume-based indicators may be unreliable');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Detects outlier candles where consecutive close price change exceeds 50%.
 */
export function detectOutliers(klines: BinanceKline[]): OutlierReport {
  const outlierIndices: number[] = [];
  let maxPriceChange = 0;
  const threshold = 0.5; // 50%

  for (let i = 1; i < klines.length; i++) {
    const prevClose = parseFloat(klines[i - 1][IDX_CLOSE] as string);
    const currentClose = parseFloat(klines[i][IDX_CLOSE] as string);

    if (!isFinite(prevClose) || prevClose === 0 || !isFinite(currentClose)) continue;

    const priceChange = Math.abs(currentClose - prevClose) / prevClose;
    if (priceChange > maxPriceChange) {
      maxPriceChange = priceChange;
    }

    if (priceChange > threshold) {
      outlierIndices.push(i);
    }
  }

  return {
    hasOutliers: outlierIndices.length > 0,
    outlierIndices,
    maxPriceChange,
  };
}

/**
 * Interpolates missing candles in a kline series by filling gaps with synthetic candles.
 * Gaps are detected where timeDiff > expectedDiff * 1.5.
 * Synthetic candles use OHLC = prevClose, volume = 0.
 *
 * @param klines - Array of klines sorted oldest-first
 * @param expectedIntervalMinutes - Expected interval between candles in minutes
 */
export function interpolateMissingCandles(
  klines: BinanceKline[],
  expectedIntervalMinutes: number,
): BinanceKline[] {
  if (klines.length < 2) return [...klines];

  const expectedDiffMs = expectedIntervalMinutes * 60 * 1000;
  const result: BinanceKline[] = [klines[0]];

  for (let i = 1; i < klines.length; i++) {
    const prev = klines[i - 1];
    const current = klines[i];
    const prevTime = prev[IDX_OPEN_TIME] as number;
    const currentTime = current[IDX_OPEN_TIME] as number;
    const timeDiff = currentTime - prevTime;

    // Detect gap: timeDiff > expectedDiff * 1.5
    if (timeDiff > expectedDiffMs * 1.5) {
      const missingCount = Math.floor(timeDiff / expectedDiffMs) - 1;
      const prevClose = prev[IDX_CLOSE] as string;

      for (let j = 1; j <= missingCount; j++) {
        const interpolatedTime = prevTime + j * expectedDiffMs;
        const synthetic: BinanceKline = [
          interpolatedTime,
          prevClose, // open = prevClose
          prevClose, // high = prevClose
          prevClose, // low = prevClose
          prevClose, // close = prevClose
          '0',       // volume = 0
          interpolatedTime + expectedDiffMs - 1,
          '0',
          0,
          '0',
          '0',
          '0',
        ];
        result.push(synthetic);
      }
    }

    result.push(current);
  }

  return result;
}

/**
 * Returns true if the given timestamp is stale (older than 1 hour).
 */
export function isYahooDataStale(timestampMs: number): boolean {
  const ONE_HOUR_MS = 60 * 60 * 1000;
  return Date.now() - timestampMs > ONE_HOUR_MS;
}
