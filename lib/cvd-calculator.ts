/**
 * CVD (Cumulative Volume Delta) Calculator
 * 
 * Tracks persistent buying/selling pressure over time by calculating the cumulative
 * difference between buy-side and sell-side volume. This is a critical institutional
 * indicator that reveals hidden accumulation/distribution patterns.
 * 
 * Key Concepts:
 * - Positive CVD = Net buying pressure (accumulation)
 * - Negative CVD = Net selling pressure (distribution)
 * - CVD Divergence = CVD trend differs from price trend (reversal signal)
 * 
 * Example:
 * - Price making lower lows, but CVD making higher lows = Bullish divergence (hidden buying)
 * - Price making higher highs, but CVD making lower highs = Bearish divergence (hidden selling)
 */

import type { CVDData } from './derivatives-types';

interface CVDState {
  symbol: string;
  trades: Array<{
    side: 'buy' | 'sell';
    volume: number;
    timestamp: number;
  }>;
  cvd1h: number;
  cvd4h: number;
  cvd24h: number;
}

// Store CVD state for each symbol
const cvdStates = new Map<string, CVDState>();

/**
 * Update CVD with a new trade
 * 
 * @param symbol - Trading pair symbol (e.g., 'BTCUSDT')
 * @param side - Trade side ('buy' = taker buy, 'sell' = taker sell)
 * @param volume - Trade volume in USD
 * @param timestamp - Trade timestamp in milliseconds
 */
export function updateCVD(
  symbol: string,
  side: 'buy' | 'sell',
  volume: number,
  timestamp: number
): void {
  // Get or create state for this symbol
  let state = cvdStates.get(symbol);
  if (!state) {
    state = {
      symbol,
      trades: [],
      cvd1h: 0,
      cvd4h: 0,
      cvd24h: 0,
    };
    cvdStates.set(symbol, state);
  }

  // Add new trade to history
  const delta = side === 'buy' ? volume : -volume;
  state.trades.push({ side, volume, timestamp });

  // Remove trades older than 24 hours to prevent memory bloat
  const cutoff24h = timestamp - 24 * 60 * 60 * 1000;
  state.trades = state.trades.filter(t => t.timestamp > cutoff24h);

  // Calculate CVD for different timeframes
  const cutoff1h = timestamp - 60 * 60 * 1000;
  const cutoff4h = timestamp - 4 * 60 * 60 * 1000;

  // 1-hour CVD
  state.cvd1h = state.trades
    .filter(t => t.timestamp > cutoff1h)
    .reduce((sum, t) => sum + (t.side === 'buy' ? t.volume : -t.volume), 0);

  // 4-hour CVD
  state.cvd4h = state.trades
    .filter(t => t.timestamp > cutoff4h)
    .reduce((sum, t) => sum + (t.side === 'buy' ? t.volume : -t.volume), 0);

  // 24-hour CVD
  state.cvd24h = state.trades
    .reduce((sum, t) => sum + (t.side === 'buy' ? t.volume : -t.volume), 0);
}

/**
 * Get CVD data for a symbol with divergence detection
 * 
 * @param symbol - Trading pair symbol
 * @param currentPrice - Current market price
 * @param priceHistory - Array of historical prices with timestamps
 * @returns CVDData object or null if insufficient data
 */
export function getCVDData(
  symbol: string,
  currentPrice: number,
  priceHistory: Array<{ price: number; timestamp: number }>
): CVDData | null {
  const state = cvdStates.get(symbol);
  if (!state || state.trades.length < 10) return null;

  // Determine trend based on 4-hour CVD (most reliable timeframe)
  let cvdTrend: 'accumulation' | 'distribution' | 'neutral';
  const cvdThreshold = Math.abs(state.cvd4h) * 0.1; // 10% threshold
  
  if (state.cvd4h > cvdThreshold) {
    cvdTrend = 'accumulation';
  } else if (state.cvd4h < -cvdThreshold) {
    cvdTrend = 'distribution';
  } else {
    cvdTrend = 'neutral';
  }

  // Detect divergence between CVD and price
  let divergence: 'bullish' | 'bearish' | 'none' = 'none';
  
  if (priceHistory.length >= 2) {
    const oldestPrice = priceHistory[0].price;
    const priceChange = currentPrice - oldestPrice;
    const priceChangePercent = (priceChange / oldestPrice) * 100;
    
    // Get CVD from 4 hours ago for comparison
    const cutoff4h = Date.now() - 4 * 60 * 60 * 1000;
    const oldTrades = state.trades.filter(t => t.timestamp <= cutoff4h);
    const cvd4hAgo = oldTrades.reduce(
      (sum, t) => sum + (t.side === 'buy' ? t.volume : -t.volume),
      0
    );
    const cvdChange = state.cvd4h - cvd4hAgo;

    // Bullish divergence: Price down but CVD up (accumulation on dips)
    // Requires significant moves (>3% price drop, positive CVD change)
    if (priceChangePercent < -3 && cvdChange > 0) {
      divergence = 'bullish';
    }
    // Bearish divergence: Price up but CVD down (distribution on rallies)
    // Requires significant moves (>3% price rise, negative CVD change)
    else if (priceChangePercent > 3 && cvdChange < 0) {
      divergence = 'bearish';
    }
  }

  // Calculate strength (0-100)
  // $1M CVD = 100 strength
  // This normalizes CVD to a comparable scale across different assets
  const maxCVD = Math.max(
    Math.abs(state.cvd1h),
    Math.abs(state.cvd4h),
    Math.abs(state.cvd24h)
  );
  const strength = Math.min(100, (maxCVD / 1000000) * 100);

  return {
    symbol,
    cvd1h: state.cvd1h,
    cvd4h: state.cvd4h,
    cvd24h: state.cvd24h,
    cvdTrend,
    divergence,
    strength,
    updatedAt: Date.now(),
  };
}

/**
 * Get CVD data for all tracked symbols
 * 
 * @param symbols - Array of symbols to get CVD for
 * @param prices - Map of current prices by symbol
 * @param priceHistories - Map of price histories by symbol
 * @returns Map of CVD data by symbol
 */
export function getAllCVD(
  symbols: string[],
  prices: Map<string, number>,
  priceHistories: Map<string, Array<{ price: number; timestamp: number }>>
): Map<string, CVDData> {
  const result = new Map<string, CVDData>();

  for (const symbol of symbols) {
    const price = prices.get(symbol);
    const history = priceHistories.get(symbol);
    
    if (!price || !history || history.length === 0) continue;

    const cvd = getCVDData(symbol, price, history);
    if (cvd) {
      result.set(symbol, cvd);
    }
  }

  return result;
}

/**
 * Clear CVD state for a symbol (useful for testing or cleanup)
 * 
 * @param symbol - Symbol to clear, or undefined to clear all
 */
export function clearCVDState(symbol?: string): void {
  if (symbol) {
    cvdStates.delete(symbol);
  } else {
    cvdStates.clear();
  }
}

/**
 * Get CVD state for debugging/monitoring
 * 
 * @param symbol - Symbol to get state for
 * @returns CVD state or undefined
 */
export function getCVDState(symbol: string): CVDState | undefined {
  return cvdStates.get(symbol);
}
