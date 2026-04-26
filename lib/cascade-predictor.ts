/**
 * Liquidation Cascade Risk Predictor
 * 
 * Predicts liquidation cascades by analyzing liquidation clusters, open interest,
 * funding rates, and volatility. Liquidation cascades are chain reactions where
 * one liquidation triggers another, causing flash crashes or pumps.
 * 
 * Key Concepts:
 * - Liquidation Cluster = Price level with high concentration of liquidations
 * - Cascade Trigger = Price level that initiates a domino effect
 * - Cascade Path = Series of price levels that will liquidate sequentially
 * - Cascade Magnitude = Total USD value of liquidations in the cascade
 * 
 * Example:
 * - $50M in long liquidations at $40,000
 * - $30M in long liquidations at $39,500
 * - $20M in long liquidations at $39,000
 * - If price hits $40,000, cascade risk is HIGH (total $100M cascade)
 * 
 * Risk Factors:
 * 1. Liquidation cluster size (larger = higher risk)
 * 2. Open Interest liquidation risk (higher = more positions at risk)
 * 3. Extreme funding rates (overleveraged = higher risk)
 * 4. Recent liquidation volume (momentum = higher risk)
 * 5. High volatility (faster price moves = higher risk)
 */

import type { 
  LiquidationEvent, 
  OpenInterestAnalysis, 
  FundingRateHistory,
  LiquidationCascadeRisk 
} from './derivatives-types';

/**
 * Predict liquidation cascade risk for a symbol
 * 
 * @param symbol - Trading pair symbol
 * @param currentPrice - Current market price
 * @param liquidations - Array of recent liquidation events
 * @param oiAnalysis - Open Interest analysis data
 * @param fundingHistory - Funding rate historical context
 * @param volatility - Current volatility (ATR or similar)
 * @returns LiquidationCascadeRisk object or null if insufficient data
 */
export function predictCascadeRisk(
  symbol: string,
  currentPrice: number,
  liquidations: LiquidationEvent[],
  oiAnalysis: OpenInterestAnalysis | null,
  fundingHistory: FundingRateHistory | null,
  volatility: number
): LiquidationCascadeRisk | null {
  // Need OI and funding data for accurate cascade prediction
  if (!oiAnalysis || !fundingHistory) return null;

  const now = Date.now();
  
  // Analyze liquidations from the last hour (most relevant for cascade prediction)
  const recentLiqs = liquidations.filter(
    l => l.symbol === symbol && (now - l.timestamp) < 60 * 60 * 1000
  );

  // Need at least 5 liquidations to identify clusters
  if (recentLiqs.length < 5) return null;

  // Group liquidations by price level (±1% buckets)
  // This creates a liquidation heatmap
  const bucketSize = currentPrice * 0.01; // 1% price buckets
  const priceBuckets = new Map<number, { 
    longs: number; 
    shorts: number; 
    total: number;
    count: number;
  }>();
  
  for (const liq of recentLiqs) {
    // Round to nearest bucket
    const bucket = Math.round(liq.price / bucketSize) * bucketSize;
    const existing = priceBuckets.get(bucket) || { 
      longs: 0, 
      shorts: 0, 
      total: 0,
      count: 0
    };
    
    // 'Sell' side = long liquidations, 'Buy' side = short liquidations
    if (liq.side === 'Sell') {
      existing.longs += liq.valueUsd;
    } else {
      existing.shorts += liq.valueUsd;
    }
    existing.total += liq.valueUsd;
    existing.count += 1;
    
    priceBuckets.set(bucket, existing);
  }

  // Find the largest liquidation cluster
  let largestCluster = { 
    price: 0, 
    value: 0, 
    direction: 'long' as 'long' | 'short',
    count: 0
  };
  
  for (const [price, data] of priceBuckets.entries()) {
    if (data.total > largestCluster.value) {
      largestCluster = {
        price,
        value: data.total,
        direction: data.longs > data.shorts ? 'long' : 'short',
        count: data.count
      };
    }
  }

  // Calculate base risk score (0-100)
  let riskScore = 0;

  // Factor 1: OI Liquidation Risk (max 40 points)
  // High OI liquidation risk = more positions at risk of cascade
  riskScore += oiAnalysis.liquidationRisk * 0.4;

  // Factor 2: Extreme Funding (max 30 points)
  // Extreme funding = overleveraged = higher cascade risk
  if (fundingHistory.extremeLevel === 'extreme') {
    riskScore += 30;
  } else if (fundingHistory.extremeLevel === 'elevated') {
    riskScore += 15;
  }

  // Factor 3: Recent Liquidation Volume (max 20 points)
  // High recent liquidation volume = cascade momentum building
  const totalLiqValue = recentLiqs.reduce((sum, l) => sum + l.valueUsd, 0);
  if (totalLiqValue > 10000000) {
    // $10M+ in liquidations in last hour = extreme
    riskScore += 20;
  } else if (totalLiqValue > 5000000) {
    // $5-10M in liquidations = high
    riskScore += 15;
  } else if (totalLiqValue > 1000000) {
    // $1-5M in liquidations = moderate
    riskScore += 10;
  }

  // Factor 4: High Volatility (max 10 points)
  // High volatility = faster price moves = easier to trigger cascades
  if (volatility > 0.05) {
    // >5% volatility = extreme
    riskScore += 10;
  } else if (volatility > 0.03) {
    // 3-5% volatility = high
    riskScore += 7;
  } else if (volatility > 0.02) {
    // 2-3% volatility = moderate
    riskScore += 4;
  }

  // Clamp to 0-100 range
  riskScore = Math.min(100, Math.max(0, riskScore));

  // Determine severity based on risk score
  let severity: 'low' | 'medium' | 'high' | 'extreme';
  if (riskScore >= 80) {
    severity = 'extreme';
  } else if (riskScore >= 60) {
    severity = 'high';
  } else if (riskScore >= 40) {
    severity = 'medium';
  } else {
    severity = 'low';
  }

  // Estimate time to trigger based on volatility and distance
  // This is a rough estimate - actual time depends on market conditions
  const distancePercent = Math.abs(currentPrice - largestCluster.price) / currentPrice;
  const volatilityPerHour = volatility; // Assuming volatility is hourly
  const timeToTrigger = volatilityPerHour > 0
    ? (distancePercent / volatilityPerHour) * 3600 // Convert to seconds
    : Infinity;

  // Find affected levels (within 5% of trigger price)
  const affectedRange = currentPrice * 0.05;
  const affectedLevels = Array.from(priceBuckets.keys())
    .filter(p => Math.abs(p - largestCluster.price) <= affectedRange)
    .sort((a, b) => a - b);

  // Calculate estimated cascade value (sum of all affected levels)
  let estimatedCascadeValue = 0;
  for (const level of affectedLevels) {
    const bucket = priceBuckets.get(level);
    if (bucket) {
      estimatedCascadeValue += bucket.total;
    }
  }

  return {
    symbol,
    riskScore,
    triggerPrice: largestCluster.price,
    estimatedCascadeValue,
    affectedLevels,
    timeToTrigger: Math.round(timeToTrigger),
    severity,
    direction: largestCluster.direction,
    updatedAt: now,
  };
}

/**
 * Predict cascade risk for all tracked symbols
 * 
 * @param symbols - Array of symbols to analyze
 * @param prices - Map of current prices by symbol
 * @param liquidations - Array of all recent liquidation events
 * @param oiAnalyses - Map of OI analyses by symbol
 * @param fundingHistories - Map of funding histories by symbol
 * @param volatilities - Map of volatilities by symbol
 * @returns Map of cascade risks by symbol
 */
export function predictAllCascadeRisks(
  symbols: string[],
  prices: Map<string, number>,
  liquidations: LiquidationEvent[],
  oiAnalyses: Map<string, OpenInterestAnalysis>,
  fundingHistories: Map<string, FundingRateHistory>,
  volatilities: Map<string, number>
): Map<string, LiquidationCascadeRisk> {
  const result = new Map<string, LiquidationCascadeRisk>();

  for (const symbol of symbols) {
    const price = prices.get(symbol);
    const oiAnalysis = oiAnalyses.get(symbol);
    const fundingHistory = fundingHistories.get(symbol);
    const volatility = volatilities.get(symbol);
    
    if (!price || !oiAnalysis || !fundingHistory || volatility === undefined) {
      continue;
    }

    const cascadeRisk = predictCascadeRisk(
      symbol,
      price,
      liquidations,
      oiAnalysis,
      fundingHistory,
      volatility
    );
    
    if (cascadeRisk) {
      result.set(symbol, cascadeRisk);
    }
  }

  return result;
}

/**
 * Calculate liquidation price for a leveraged position
 * Useful for understanding where liquidations will occur
 * 
 * @param entryPrice - Position entry price
 * @param leverage - Position leverage (e.g., 10 for 10x)
 * @param direction - Position direction ('long' or 'short')
 * @param maintenanceMargin - Maintenance margin rate (default 0.5% = 0.005)
 * @returns Liquidation price
 */
export function calculateLiquidationPrice(
  entryPrice: number,
  leverage: number,
  direction: 'long' | 'short',
  maintenanceMargin: number = 0.005
): number {
  if (direction === 'long') {
    // Long liquidation price = Entry * (1 - (1/leverage) + maintenanceMargin)
    return entryPrice * (1 - (1 / leverage) + maintenanceMargin);
  } else {
    // Short liquidation price = Entry * (1 + (1/leverage) - maintenanceMargin)
    return entryPrice * (1 + (1 / leverage) - maintenanceMargin);
  }
}

/**
 * Estimate cascade impact (how far price will move)
 * Based on liquidation value and market depth
 * 
 * @param cascadeValue - Total USD value of cascade
 * @param dailyVolume - 24h trading volume in USD
 * @returns Estimated price impact percentage
 */
export function estimateCascadeImpact(
  cascadeValue: number,
  dailyVolume: number
): number {
  if (dailyVolume === 0) return 0;
  
  // Rule of thumb: Cascade impact = (Cascade Value / Daily Volume) * 100
  // This is a simplified model - actual impact depends on order book depth
  const impactPercent = (cascadeValue / dailyVolume) * 100;
  
  // Cap at 20% (extreme cascades rarely move price more than 20%)
  return Math.min(20, impactPercent);
}

/**
 * Detect cascade patterns in liquidation history
 * Identifies if cascades have occurred recently
 * 
 * @param liquidations - Array of liquidation events
 * @param symbol - Symbol to analyze
 * @param timeWindowMs - Time window to analyze (default 1 hour)
 * @returns True if cascade pattern detected
 */
export function detectCascadePattern(
  liquidations: LiquidationEvent[],
  symbol: string,
  timeWindowMs: number = 60 * 60 * 1000
): boolean {
  const now = Date.now();
  const recentLiqs = liquidations.filter(
    l => l.symbol === symbol && (now - l.timestamp) < timeWindowMs
  );

  if (recentLiqs.length < 10) return false;

  // Sort by timestamp
  const sorted = recentLiqs.sort((a, b) => a.timestamp - b.timestamp);

  // Detect cascade pattern: rapid succession of large liquidations
  // Pattern: 3+ liquidations >$100K within 5 minutes
  let cascadeCount = 0;
  let windowStart = 0;

  for (let i = 0; i < sorted.length; i++) {
    const liq = sorted[i];
    
    // Reset window if more than 5 minutes passed
    if (i > 0 && liq.timestamp - sorted[windowStart].timestamp > 5 * 60 * 1000) {
      windowStart = i;
      cascadeCount = 0;
    }

    // Count large liquidations
    if (liq.valueUsd >= 100000) {
      cascadeCount++;
      
      // Cascade detected: 3+ large liquidations in 5 minutes
      if (cascadeCount >= 3) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculate cascade risk score based on multiple factors
 * More sophisticated than predictCascadeRisk, uses additional heuristics
 * 
 * @param symbol - Symbol to analyze
 * @param currentPrice - Current market price
 * @param liquidations - Recent liquidation events
 * @param oiAnalysis - OI analysis
 * @param fundingHistory - Funding history
 * @param volatility - Current volatility
 * @param volume24h - 24h trading volume
 * @returns Risk score (0-100) and confidence (0-100)
 */
export function calculateAdvancedCascadeRisk(
  symbol: string,
  currentPrice: number,
  liquidations: LiquidationEvent[],
  oiAnalysis: OpenInterestAnalysis,
  fundingHistory: FundingRateHistory,
  volatility: number,
  volume24h: number
): { riskScore: number; confidence: number } {
  let riskScore = 0;
  let confidence = 0;

  // Factor 1: Recent cascade pattern (30 points, high confidence)
  if (detectCascadePattern(liquidations, symbol)) {
    riskScore += 30;
    confidence += 25;
  }

  // Factor 2: OI liquidation risk (25 points, high confidence)
  riskScore += oiAnalysis.liquidationRisk * 0.25;
  confidence += 20;

  // Factor 3: Extreme funding (20 points, medium confidence)
  if (fundingHistory.extremeLevel === 'extreme') {
    riskScore += 20;
    confidence += 15;
  } else if (fundingHistory.extremeLevel === 'elevated') {
    riskScore += 10;
    confidence += 10;
  }

  // Factor 4: High volatility (15 points, medium confidence)
  if (volatility > 0.05) {
    riskScore += 15;
    confidence += 10;
  } else if (volatility > 0.03) {
    riskScore += 10;
    confidence += 7;
  }

  // Factor 5: Low liquidity (10 points, low confidence)
  // Low volume = easier to move price = higher cascade risk
  const avgVolume = 1000000000; // $1B average (adjust based on asset class)
  if (volume24h < avgVolume * 0.3) {
    riskScore += 10;
    confidence += 5;
  }

  // Normalize confidence to 0-100
  confidence = Math.min(100, confidence);

  return { riskScore: Math.min(100, riskScore), confidence };
}
