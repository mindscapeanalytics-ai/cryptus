/**
 * Funding Rate Historical Context Tracker
 * 
 * Tracks funding rate trends, extremes, and reversals to detect overleveraged
 * positions and predict sentiment shifts. Funding rates are one of the most
 * predictive signals in crypto derivatives markets.
 * 
 * Key Concepts:
 * - Positive funding = Longs pay shorts = Bullish sentiment (potential reversal down)
 * - Negative funding = Shorts pay longs = Bearish sentiment (potential reversal up)
 * - Extreme funding = Overleveraged positions = High reversal probability
 * - Funding reversal = Sentiment shift = Strong directional signal
 * 
 * Example:
 * - Funding at +0.5% (extreme positive) then reverses = Bearish signal (longs unwinding)
 * - Funding at -0.3% (extreme negative) then reverses = Bullish signal (shorts covering)
 */

import type { FundingRateHistory } from './derivatives-types';

interface FundingSnapshot {
  rate: number;
  timestamp: number;
}

// Store funding rate history for each symbol
const fundingHistories = new Map<string, FundingSnapshot[]>();

/**
 * Update funding rate history with a new snapshot
 * 
 * @param symbol - Trading pair symbol (e.g., 'BTCUSDT')
 * @param rate - Funding rate (e.g., 0.0001 = 0.01%)
 * @param timestamp - Snapshot timestamp in milliseconds
 */
export function updateFundingHistory(
  symbol: string,
  rate: number,
  timestamp: number
): void {
  let history = fundingHistories.get(symbol);
  if (!history) {
    history = [];
    fundingHistories.set(symbol, history);
  }

  history.push({ rate, timestamp });

  // Keep last 24 hours of data (funding updates every 8 hours, so ~3 snapshots)
  // But we sample more frequently (every minute) for better trend detection
  const cutoff = timestamp - 24 * 60 * 60 * 1000;
  fundingHistories.set(
    symbol,
    history.filter(s => s.timestamp > cutoff)
  );
}

/**
 * Get funding rate historical context with trend and divergence analysis
 * 
 * @param symbol - Trading pair symbol
 * @param currentRate - Current funding rate
 * @param currentPrice - Current market price
 * @param priceHistory - Array of historical prices with timestamps
 * @returns FundingRateHistory object or null if insufficient data
 */
export function getFundingHistory(
  symbol: string,
  currentRate: number,
  currentPrice: number,
  priceHistory: Array<{ price: number; timestamp: number }>
): FundingRateHistory | null {
  const history = fundingHistories.get(symbol);
  
  // Need at least 10 snapshots for meaningful analysis
  if (!history || history.length < 10) return null;

  const now = Date.now();
  const cutoff1h = now - 60 * 60 * 1000;
  const cutoff4h = now - 4 * 60 * 60 * 1000;
  const cutoff24h = now - 24 * 60 * 60 * 1000;

  // Calculate averages for different timeframes
  const rates1h = history.filter(s => s.timestamp > cutoff1h).map(s => s.rate);
  const rates4h = history.filter(s => s.timestamp > cutoff4h).map(s => s.rate);
  const rates24h = history.filter(s => s.timestamp > cutoff24h).map(s => s.rate);

  const avg1h = rates1h.length > 0
    ? rates1h.reduce((sum, r) => sum + r, 0) / rates1h.length
    : currentRate;
  const avg4h = rates4h.length > 0
    ? rates4h.reduce((sum, r) => sum + r, 0) / rates4h.length
    : currentRate;
  const avg24h = rates24h.length > 0
    ? rates24h.reduce((sum, r) => sum + r, 0) / rates24h.length
    : currentRate;

  // Calculate percentile (where current rate sits in 24h distribution)
  const sortedRates = [...rates24h].sort((a, b) => a - b);
  const percentileIndex = sortedRates.findIndex(r => r >= currentRate);
  const percentile = percentileIndex >= 0
    ? (percentileIndex / sortedRates.length) * 100
    : 50; // Default to 50th percentile if not found

  // Determine trend based on moving averages
  let trend: 'increasing' | 'decreasing' | 'stable';
  const trendThreshold = 0.1; // 10% change threshold
  
  if (avg1h > avg4h * (1 + trendThreshold)) {
    trend = 'increasing';
  } else if (avg1h < avg4h * (1 - trendThreshold)) {
    trend = 'decreasing';
  } else {
    trend = 'stable';
  }

  // Determine extreme level based on absolute rate
  // These thresholds are calibrated for crypto perpetual swaps
  let extremeLevel: 'normal' | 'elevated' | 'extreme';
  const absRate = Math.abs(currentRate);
  
  if (absRate >= 0.01) {
    // ≥1% funding rate = extreme (very rare, high reversal probability)
    extremeLevel = 'extreme';
  } else if (absRate >= 0.001) {
    // 0.1-1% funding rate = elevated (significant, watch for reversal)
    extremeLevel = 'elevated';
  } else {
    // <0.1% funding rate = normal
    extremeLevel = 'normal';
  }

  // Detect divergence between funding rate and price
  let divergence: 'bullish' | 'bearish' | 'none' = 'none';
  
  if (priceHistory.length >= 2) {
    const oldestPrice = priceHistory[0].price;
    const priceChange = currentPrice - oldestPrice;
    const priceChangePercent = (priceChange / oldestPrice) * 100;
    
    const oldestFunding = history[0].rate;
    const fundingChange = currentRate - oldestFunding;
    const fundingChangePercent = Math.abs(oldestFunding) > 0
      ? (fundingChange / Math.abs(oldestFunding)) * 100
      : 0;

    // Bullish divergence: Price down, funding becoming more negative
    // (Shorts paying more, but price still falling = shorts will cover soon)
    if (priceChangePercent < -3 && fundingChange < -0.0001) {
      divergence = 'bullish';
    }
    // Bearish divergence: Price up, funding becoming more positive
    // (Longs paying more, but price still rising = longs will close soon)
    else if (priceChangePercent > 3 && fundingChange > 0.0001) {
      divergence = 'bearish';
    }
  }

  // Calculate momentum (rate of change)
  const momentum = avg1h - avg4h;

  // Detect reversal (trend change)
  // A reversal is when the short-term trend opposes the medium-term trend
  const reversal = (
    (trend === 'increasing' && momentum < 0) ||
    (trend === 'decreasing' && momentum > 0)
  );

  return {
    symbol,
    current: currentRate,
    avg1h,
    avg4h,
    avg24h,
    percentile,
    trend,
    extremeLevel,
    divergence,
    momentum,
    reversal,
    updatedAt: now,
  };
}

/**
 * Get funding rate history for all tracked symbols
 * 
 * @param symbols - Array of symbols to get funding history for
 * @param currentRates - Map of current funding rates by symbol
 * @param prices - Map of current prices by symbol
 * @param priceHistories - Map of price histories by symbol
 * @returns Map of funding rate history by symbol
 */
export function getAllFundingHistory(
  symbols: string[],
  currentRates: Map<string, number>,
  prices: Map<string, number>,
  priceHistories: Map<string, Array<{ price: number; timestamp: number }>>
): Map<string, FundingRateHistory> {
  const result = new Map<string, FundingRateHistory>();

  for (const symbol of symbols) {
    const rate = currentRates.get(symbol);
    const price = prices.get(symbol);
    const history = priceHistories.get(symbol);
    
    if (rate === undefined || !price || !history || history.length === 0) continue;

    const fundingHistory = getFundingHistory(symbol, rate, price, history);
    if (fundingHistory) {
      result.set(symbol, fundingHistory);
    }
  }

  return result;
}

/**
 * Clear funding history for a symbol (useful for testing or cleanup)
 * 
 * @param symbol - Symbol to clear, or undefined to clear all
 */
export function clearFundingHistory(symbol?: string): void {
  if (symbol) {
    fundingHistories.delete(symbol);
  } else {
    fundingHistories.clear();
  }
}

/**
 * Get funding history state for debugging/monitoring
 * 
 * @param symbol - Symbol to get state for
 * @returns Funding history array or undefined
 */
export function getFundingHistoryState(symbol: string): FundingSnapshot[] | undefined {
  return fundingHistories.get(symbol);
}
