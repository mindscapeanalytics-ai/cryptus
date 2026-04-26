/**
 * Open Interest Change Rate Analyzer
 * 
 * Analyzes Open Interest (OI) trends, divergences, and liquidation risk to predict
 * position buildups, liquidation cascades, and market regime shifts. OI is one of
 * the most reliable indicators of institutional positioning and market health.
 * 
 * Key Concepts:
 * - Rising OI + Rising Price = Strong uptrend (new longs entering)
 * - Rising OI + Falling Price = Strong downtrend (new shorts entering)
 * - Falling OI + Rising Price = Weak rally (longs closing, distribution)
 * - Falling OI + Falling Price = Weak decline (shorts closing, accumulation)
 * - High OI/Volume Ratio = Position holders (not day traders) = Liquidation risk
 * - Accelerating OI Growth = FOMO/Panic = Cascade risk
 * 
 * Example:
 * - OI up 20% in 4h + Price up 5% = Strong bullish trend
 * - OI down 15% in 4h + Price up 8% = Bearish divergence (weak rally)
 * - OI up 30% + Extreme funding + High OI/Vol = Extreme liquidation risk
 */

import type { OpenInterestAnalysis } from './derivatives-types';

interface OISnapshot {
  value: number;
  timestamp: number;
}

// Store OI history for each symbol
const oiHistories = new Map<string, OISnapshot[]>();

/**
 * Update OI history with a new snapshot
 * 
 * @param symbol - Trading pair symbol (e.g., 'BTCUSDT')
 * @param value - Open Interest value in USD
 * @param timestamp - Snapshot timestamp in milliseconds
 */
export function updateOIHistory(
  symbol: string,
  value: number,
  timestamp: number
): void {
  let history = oiHistories.get(symbol);
  if (!history) {
    history = [];
    oiHistories.set(symbol, history);
  }

  history.push({ value, timestamp });

  // Keep last 24 hours of data
  const cutoff = timestamp - 24 * 60 * 60 * 1000;
  oiHistories.set(
    symbol,
    history.filter(s => s.timestamp > cutoff)
  );
}

/**
 * Analyze Open Interest with divergence detection and liquidation risk assessment
 * 
 * @param symbol - Trading pair symbol
 * @param currentOI - Current Open Interest value in USD
 * @param volume24h - 24-hour trading volume in USD
 * @param currentPrice - Current market price
 * @param priceHistory - Array of historical prices with timestamps
 * @param fundingRate - Current funding rate (for liquidation risk calculation)
 * @returns OpenInterestAnalysis object or null if insufficient data
 */
export function analyzeOI(
  symbol: string,
  currentOI: number,
  volume24h: number,
  currentPrice: number,
  priceHistory: Array<{ price: number; timestamp: number }>,
  fundingRate: number
): OpenInterestAnalysis | null {
  const history = oiHistories.get(symbol);
  
  // Need at least 10 snapshots for meaningful analysis
  if (!history || history.length < 10) return null;

  const now = Date.now();
  const cutoff1h = now - 60 * 60 * 1000;
  const cutoff4h = now - 4 * 60 * 60 * 1000;
  const cutoff24h = now - 24 * 60 * 60 * 1000;

  // Find OI values at different times (use closest snapshot)
  const findClosestOI = (targetTime: number): number => {
    const snapshot = history
      .filter(s => s.timestamp <= targetTime)
      .sort((a, b) => Math.abs(a.timestamp - targetTime) - Math.abs(b.timestamp - targetTime))[0];
    return snapshot?.value || currentOI;
  };

  const oi1hAgo = findClosestOI(cutoff1h);
  const oi4hAgo = findClosestOI(cutoff4h);
  const oi24hAgo = findClosestOI(cutoff24h);

  // Calculate percentage changes
  const change1h = oi1hAgo > 0 ? ((currentOI - oi1hAgo) / oi1hAgo) * 100 : 0;
  const change4h = oi4hAgo > 0 ? ((currentOI - oi4hAgo) / oi4hAgo) * 100 : 0;
  const change24h = oi24hAgo > 0 ? ((currentOI - oi24hAgo) / oi24hAgo) * 100 : 0;

  // Determine change rate (acceleration/deceleration)
  let changeRate: 'accelerating' | 'steady' | 'decelerating';
  const absChange1h = Math.abs(change1h);
  const absChange4h = Math.abs(change4h);
  
  // Accelerating: 1h change > 4h change (normalized) by 20%+
  if (absChange1h > absChange4h * 1.2) {
    changeRate = 'accelerating';
  }
  // Decelerating: 1h change < 4h change (normalized) by 20%+
  else if (absChange1h < absChange4h * 0.8) {
    changeRate = 'decelerating';
  }
  // Steady: within 20% range
  else {
    changeRate = 'steady';
  }

  // Calculate OI/Volume ratio
  // High ratio (>2) = Position holders (not day traders) = Higher liquidation risk
  // Low ratio (<1) = Day traders (high turnover) = Lower liquidation risk
  const oiVolumeRatio = volume24h > 0 ? currentOI / volume24h : 0;

  // Detect divergence between OI and price
  let divergence: 'bullish' | 'bearish' | 'none' = 'none';
  
  if (priceHistory.length >= 2) {
    const oldestPrice = priceHistory[0].price;
    const priceChange = currentPrice - oldestPrice;
    const priceChangePercent = (priceChange / oldestPrice) * 100;
    
    // Bearish divergence: Price up significantly but OI down
    // (Weak rally - longs closing positions, not new longs entering)
    if (priceChangePercent > 5 && change4h < -5) {
      divergence = 'bearish';
    }
    // Bullish divergence: Price down significantly but OI up
    // (Accumulation - new positions opening despite price drop)
    else if (priceChangePercent < -5 && change4h > 5) {
      divergence = 'bullish';
    }
  }

  // Calculate liquidation risk score (0-100)
  let liquidationRisk = 0;
  
  // Factor 1: High OI growth = FOMO/Panic = Risk (max 30 points)
  if (currentOI > oi24hAgo * 1.5) {
    // OI grew 50%+ in 24h = extreme FOMO
    liquidationRisk += 30;
  } else if (currentOI > oi24hAgo * 1.3) {
    // OI grew 30-50% in 24h = high FOMO
    liquidationRisk += 20;
  } else if (currentOI > oi24hAgo * 1.15) {
    // OI grew 15-30% in 24h = moderate FOMO
    liquidationRisk += 10;
  }
  
  // Factor 2: Extreme funding = Overleveraged = Risk (max 30 points)
  const absFunding = Math.abs(fundingRate);
  if (absFunding >= 0.01) {
    // ≥1% funding = extreme leverage
    liquidationRisk += 30;
  } else if (absFunding >= 0.005) {
    // 0.5-1% funding = high leverage
    liquidationRisk += 20;
  } else if (absFunding >= 0.001) {
    // 0.1-0.5% funding = moderate leverage
    liquidationRisk += 10;
  }
  
  // Factor 3: Accelerating OI growth = Panic/FOMO = Risk (max 20 points)
  if (changeRate === 'accelerating' && change1h > 10) {
    // OI accelerating + growing 10%+ in 1h = extreme panic/FOMO
    liquidationRisk += 20;
  } else if (changeRate === 'accelerating' && change1h > 5) {
    // OI accelerating + growing 5-10% in 1h = high panic/FOMO
    liquidationRisk += 10;
  }
  
  // Factor 4: High OI/Volume ratio = Position holders = Risk (max 20 points)
  if (oiVolumeRatio > 3) {
    // OI/Vol > 3 = very sticky positions
    liquidationRisk += 20;
  } else if (oiVolumeRatio > 2) {
    // OI/Vol 2-3 = sticky positions
    liquidationRisk += 15;
  } else if (oiVolumeRatio > 1.5) {
    // OI/Vol 1.5-2 = moderate stickiness
    liquidationRisk += 10;
  }

  // Clamp to 0-100 range
  liquidationRisk = Math.min(100, Math.max(0, liquidationRisk));

  // Determine risk level based on liquidation risk score
  let riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  if (liquidationRisk >= 80) {
    riskLevel = 'extreme';
  } else if (liquidationRisk >= 60) {
    riskLevel = 'high';
  } else if (liquidationRisk >= 40) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  return {
    symbol,
    value: currentOI,
    change1h,
    change4h,
    change24h,
    changeRate,
    oiVolumeRatio,
    riskLevel,
    divergence,
    liquidationRisk,
    updatedAt: now,
  };
}

/**
 * Analyze OI for all tracked symbols
 * 
 * @param symbols - Array of symbols to analyze
 * @param currentOI - Map of current OI values by symbol
 * @param volumes24h - Map of 24h volumes by symbol
 * @param prices - Map of current prices by symbol
 * @param priceHistories - Map of price histories by symbol
 * @param fundingRates - Map of funding rates by symbol
 * @returns Map of OI analysis by symbol
 */
export function analyzeAllOI(
  symbols: string[],
  currentOI: Map<string, number>,
  volumes24h: Map<string, number>,
  prices: Map<string, number>,
  priceHistories: Map<string, Array<{ price: number; timestamp: number }>>,
  fundingRates: Map<string, number>
): Map<string, OpenInterestAnalysis> {
  const result = new Map<string, OpenInterestAnalysis>();

  for (const symbol of symbols) {
    const oi = currentOI.get(symbol);
    const volume = volumes24h.get(symbol);
    const price = prices.get(symbol);
    const history = priceHistories.get(symbol);
    const funding = fundingRates.get(symbol);
    
    if (!oi || !volume || !price || !history || history.length === 0 || funding === undefined) {
      continue;
    }

    const analysis = analyzeOI(symbol, oi, volume, price, history, funding);
    if (analysis) {
      result.set(symbol, analysis);
    }
  }

  return result;
}

/**
 * Clear OI history for a symbol (useful for testing or cleanup)
 * 
 * @param symbol - Symbol to clear, or undefined to clear all
 */
export function clearOIHistory(symbol?: string): void {
  if (symbol) {
    oiHistories.delete(symbol);
  } else {
    oiHistories.clear();
  }
}

/**
 * Get OI history state for debugging/monitoring
 * 
 * @param symbol - Symbol to get state for
 * @returns OI history array or undefined
 */
export function getOIHistoryState(symbol: string): OISnapshot[] | undefined {
  return oiHistories.get(symbol);
}

/**
 * Calculate OI momentum (rate of change acceleration)
 * Useful for detecting sudden position buildups
 * 
 * @param symbol - Symbol to calculate momentum for
 * @returns Momentum value or null if insufficient data
 */
export function calculateOIMomentum(symbol: string): number | null {
  const history = oiHistories.get(symbol);
  if (!history || history.length < 20) return null;

  const now = Date.now();
  const cutoff1h = now - 60 * 60 * 1000;
  const cutoff2h = now - 2 * 60 * 60 * 1000;

  // Get OI values at different times
  const findClosestOI = (targetTime: number): number | null => {
    const snapshot = history
      .filter(s => s.timestamp <= targetTime)
      .sort((a, b) => Math.abs(a.timestamp - targetTime) - Math.abs(b.timestamp - targetTime))[0];
    return snapshot?.value || null;
  };

  const currentOI = history[history.length - 1].value;
  const oi1hAgo = findClosestOI(cutoff1h);
  const oi2hAgo = findClosestOI(cutoff2h);

  if (!oi1hAgo || !oi2hAgo) return null;

  // Calculate velocity (change rate)
  const velocity1h = ((currentOI - oi1hAgo) / oi1hAgo) * 100;
  const velocity2h = ((oi1hAgo - oi2hAgo) / oi2hAgo) * 100;

  // Momentum = acceleration (change in velocity)
  const momentum = velocity1h - velocity2h;

  return momentum;
}
