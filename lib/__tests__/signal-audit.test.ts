/**
 * Signal Audit Tests — Phase 6 Dataflow Hardening
 * Copyright © 2024-2026 Mindscape Analytics LLC. All rights reserved.
 *
 * Validates the fixes from the deep signal dataflow audit:
 * 1. Super Signal validation uses normalized scores (BUG 1 fix)
 * 2. Regime-adaptive RSI thresholds shift correctly (Phase 6)
 * 3. RSI crossover and divergence apply regime weighting (Component 5)
 * 4. Smart Money integration in risk engine (Component 3)
 */

import { validateWithSuperSignal } from '../signal-validation';
import { computeStrategyScore } from '../indicators';
import { computeRisk } from '../super-signal/risk-engine';
import { SuperSignalInput } from '../super-signal/types';

// ─── BUG 1 FIX: Super Signal Validation Uses Normalized Scores ───

describe('validateWithSuperSignal (BUG 1 fix)', () => {
  it('should not over-inflate boost when super signal is bullish (raw=80)', () => {
    // Before fix: Math.abs(80)/100 = 0.8 → 12% boost (way too high)
    // After fix: normalizedSuper = (80-50)*2 = 60 → Math.abs(60)/100 = 0.6 → 9% boost
    const result = validateWithSuperSignal(50, 80);
    expect(result.multiplier).toBeLessThanOrEqual(1.10); // Should be ≤10%, not 12%
    expect(result.confidence).toBe('high');
  });

  it('should produce symmetric results for equivalent bullish/bearish scores', () => {
    // Super = 70 (bullish), strategy = 50 (bullish)
    const bullishResult = validateWithSuperSignal(50, 70);
    // Super = 30 (bearish), strategy = -50 (bearish)
    const bearishResult = validateWithSuperSignal(-50, 30);
    // Both should have similar multipliers (symmetric agreement)
    expect(Math.abs(bullishResult.multiplier - bearishResult.multiplier)).toBeLessThan(0.02);
  });

  it('should correctly penalize disagreement between strategy and super signal', () => {
    // Strategy bullish (+60), Super Signal bearish (raw=20 → normalized=-60)
    const result = validateWithSuperSignal(60, 20);
    expect(result.multiplier).toBeLessThan(1.0);
    expect(result.confidence).toBe('low');
    expect(result.reason).toContain('contradicts');
  });

  it('should skip validation when super signal is near neutral (40-60)', () => {
    // Super Signal = 50 (exactly neutral, confidence = 0)
    const result = validateWithSuperSignal(80, 50);
    expect(result.multiplier).toBe(1.0);
    expect(result.confidence).toBe('medium');
  });

  it('should skip validation when super signal is undefined', () => {
    const result = validateWithSuperSignal(80, undefined);
    expect(result.multiplier).toBe(1.0);
    expect(result.reason).toBe('');
  });

  it('should handle edge case: super signal at boundaries', () => {
    // Super = 0 (extreme bearish, normalized = -100)
    const result = validateWithSuperSignal(-80, 0);
    expect(result.multiplier).toBeGreaterThan(1.0);
    expect(result.confidence).toBe('high');

    // Super = 100 (extreme bullish, normalized = +100)
    const result2 = validateWithSuperSignal(80, 100);
    expect(result2.multiplier).toBeGreaterThan(1.0);
    expect(result2.confidence).toBe('high');
  });
});

// ─── PHASE 6: Regime-Adaptive RSI Thresholds ───

describe('computeStrategyScore - Regime Thresholds', () => {
  const baseParams = {
    rsi1m: null,
    rsi5m: null,
    rsi15m: 35, // Near oversold
    rsi1h: null,
    rsi4h: null,
    rsi1d: null,
    macdHistogram: null,
    bbPosition: null,
    stochK: null,
    stochD: null,
    emaCross: 'none' as const,
    vwapDiff: null,
    volumeSpike: false,
    price: 100,
    confluence: 0,
    rsiDivergence: 'none' as const,
    momentum: null,
    adx: null,
    atr: null,
    cci: null,
    obvTrend: 'none' as const,
    williamsR: null,
    market: 'Crypto' as const,
  };

  it('should widen RSI zones in trending regime', () => {
    // In trending regime, RSI 35 should NOT trigger oversold (zone widens to 27)
    const trending = computeStrategyScore({ ...baseParams, regime: 'trending' });
    // Same RSI in ranging regime SHOULD trigger oversold (zone stays at 30)
    const ranging = computeStrategyScore({ ...baseParams, regime: 'ranging' });

    // Trending should produce a weaker bullish score (35 is further from 27 threshold)
    // This tests that the zones actually shifted
    expect(trending.reasons.some(r => r.includes('Regime: Trending'))).toBe(true);
    expect(trending.score).not.toBe(ranging.score);
  });

  it('should tighten RSI zones in volatile regime', () => {
    const volatile = computeStrategyScore({ ...baseParams, regime: 'volatile' });
    expect(volatile.reasons.some(r => r.includes('Regime: Volatile'))).toBe(true);
  });

  it('should expand deep zones in breakout regime', () => {
    const breakout = computeStrategyScore({ ...baseParams, regime: 'breakout' });
    expect(breakout.reasons.some(r => r.includes('Regime: Breakout'))).toBe(true);
  });

  it('should not add regime reason for ranging regime', () => {
    const ranging = computeStrategyScore({ ...baseParams, regime: 'ranging' });
    expect(ranging.reasons.some(r => r.includes('Regime:'))).toBe(false);
  });
});

// ─── Regime Weighting: RSI Crossover & Divergence ───

describe('computeStrategyScore - Regime Weighting Coverage', () => {
  const baseParams = {
    rsi1m: null,
    rsi5m: null,
    rsi15m: 50,
    rsi1h: null,
    rsi4h: null,
    rsi1d: null,
    macdHistogram: null,
    bbPosition: null,
    stochK: null,
    stochD: null,
    emaCross: 'none' as const,
    vwapDiff: null,
    volumeSpike: false,
    price: 100,
    confluence: 0,
    rsiDivergence: 'none' as const,
    momentum: null,
    adx: null,
    atr: null,
    cci: null,
    obvTrend: 'none' as const,
    williamsR: null,
    market: 'Crypto' as const,
  };

  it('should apply regime weighting to RSI crossover', () => {
    const withCrossover = computeStrategyScore({
      ...baseParams,
      rsiCrossover: 'bullish_reversal',
      regime: 'trending',
    });
    expect(withCrossover.reasons).toContain('Bullish RSI reversal trend');
    // Score should be positive (bullish signal)
    expect(withCrossover.score).toBeGreaterThan(0);
  });

  it('should apply regime weighting to RSI divergence', () => {
    const withDivergence = computeStrategyScore({
      ...baseParams,
      rsiDivergence: 'bullish',
      regime: 'trending',
    });
    expect(withDivergence.reasons).toContain('Bullish RSI Divergence');
    expect(withDivergence.score).toBeGreaterThan(0);
  });
});

// ─── Signal/Strategy Consistency ───

describe('Signal-Strategy Consistency', () => {
  it('should not produce contradictions between signal and strategy', () => {
    // When strategy says "strong-buy", signal should not say "overbought"
    // (unless RSI is at deep extremes >=80)
    const result = computeStrategyScore({
      rsi1m: 40,  // Bullish (below 45)
      rsi5m: 35,  // Bullish (below 45)
      rsi15m: 30, // Bullish (oversold)
      rsi1h: 40,  // Bullish trend
      rsi4h: null,
      rsi1d: null,
      macdHistogram: 0.5,
      bbPosition: 0.3,
      stochK: 30,
      stochD: 35,
      emaCross: 'bullish',
      vwapDiff: 0.6, // Now positive/bullish
      volumeSpike: true,
      price: 100,
      confluence: 40,
      rsiDivergence: 'bullish',
      momentum: 5,
      adx: 35,
      atr: 2,
      cci: -150, // Oversold bullish
      obvTrend: 'bullish',
      williamsR: -80, // Oversold bullish
      market: 'Crypto',
    });

    // With all these bullish signals, strategy should be buy or strong-buy
    expect(result.signal).toMatch(/buy/);
  });
});

// ─── Component 3: Smart Money Risk Integration ───

describe('Super Signal Risk Engine - Smart Money Integration', () => {
  const baseInput: SuperSignalInput = {
    symbol: 'BTCUSDT',
    price: 50000,
    atr: 100, // Lower ATR to get a non-zero base score
    assetClass: 'Crypto',
    strategySignal: 'buy',
    historicalCloses: [50000, 50100, 50200, 50150, 50300, 50400, 50350, 50500, 50600, 50550, 50700, 50800, 50750, 50900, 51000, 50950, 51100, 51200, 51150, 51300, 51400, 51350, 51500, 51600, 51550, 51700, 51800, 51750, 51900, 52000],
    regime: 'ranging',
    change24h: 0,
    bbUpper: 51000,
    bbLower: 49000,
  };

  it('should boost risk score when Smart Money confirms Strategy (Bullish)', async () => {
    // No Smart Money
    const baseRisk = await computeRisk({ ...baseInput, symbol: 'BTC_R1', smartMoneyScore: null });
    // Bullish Smart Money (+80) confirming Bullish Strategy
    const boostedRisk = await computeRisk({ ...baseInput, symbol: 'BTC_R2', smartMoneyScore: 80 });

    expect(boostedRisk.score).toBeGreaterThan(baseRisk.score);
  });

  it('should penalize risk score when Smart Money contradicts Strategy', async () => {
    // No Smart Money
    const baseRisk = await computeRisk({ ...baseInput, symbol: 'BTC_R3', smartMoneyScore: null });
    // Bearish Smart Money (-80) contradicting Bullish Strategy
    const penalizedRisk = await computeRisk({ ...baseInput, symbol: 'BTC_R4', smartMoneyScore: -80 });

    expect(penalizedRisk.score).toBeLessThan(baseRisk.score);
  });
});
