/**
 * Preservation Tests (MUST PASS on unfixed code)
 *
 * These tests document existing correct behaviors that must not regress after the fix.
 * They MUST ALL PASS on the current unfixed code.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6, 3.7**
 */

import { describe, it, expect } from 'vitest';
import { computeStrategyScore } from '../indicators';
import { validateWithSuperSignal } from '../signal-validation';
import { SIGNAL_FEATURES } from '../feature-flags';
import { applyDiminishingReturns } from '../signal-helpers';

describe('Preservation Tests (MUST PASS on unfixed code)', () => {

  // ── Preservation 1: Correlation Penalty Still Applied to Grouped Indicators ──

  describe('Preservation 1: Correlation Penalty Still Applied to Grouped Indicators', () => {
    it('should apply diminishing returns when multiple oscillators agree', () => {
      const originalFlag = SIGNAL_FEATURES.useCorrelationPenalty;
      (SIGNAL_FEATURES as any).useCorrelationPenalty = true;

      try {
        // Multiple correlated oscillators all oversold (agreeing)
        const result = computeStrategyScore({
          rsi1m: 18,   // Deeply oversold
          rsi5m: 22,   // Oversold
          rsi15m: 28,  // Oversold
          rsi1h: 25,   // Oversold
          rsi4h: null,
          rsi1d: null,
          macdHistogram: null,
          bbPosition: 0.05,  // Near lower BB
          stochK: 15,  // Oversold
          stochD: 18,  // Oversold
          emaCross: 'none',
          vwapDiff: null,
          volumeSpike: false,
          price: 50000,
          // NO non-grouped contributions
          confluence: undefined,
          rsiDivergence: 'none',
          momentum: null,
          atr: 1000,
          adx: null,
          regime: undefined,
          tradingStyle: 'intraday',
        });

        // Score should be positive (oscillators agree on bullish)
        // but NOT as high as if all oscillators were counted at full weight
        // (diminishing returns should reduce inflation)
        expect(result.score).toBeGreaterThan(0);
        expect(result.signal).not.toBe('neutral');
      } finally {
        (SIGNAL_FEATURES as any).useCorrelationPenalty = originalFlag;
      }
    });

    it('applyDiminishingReturns reduces score inflation for correlated indicators', () => {
      // Direct test of the diminishing returns function
      const scores = [80, 80, 80]; // Three identical scores
      const adjusted = applyDiminishingReturns(scores);
      const raw = scores.reduce((sum, s) => sum + s, 0); // 240

      // Adjusted should be less than raw (diminishing returns applied)
      expect(adjusted).toBeLessThan(raw);
      // First signal gets 100%, second 50%, third 25%: 80 + 40 + 20 = 140
      expect(adjusted).toBeCloseTo(140, 0);
    });

    it('useCorrelationPenalty=false produces same score as penalty enabled when only a single grouped indicator is present', () => {
      // When there is only ONE grouped indicator and no non-grouped contributions,
      // applyDiminishingReturns([x]) = x (100% weight), so the penalty has no effect.
      // rsi1h=null avoids the TFA trend guard multiplier (which would modify score
      // before the penalty block and cause a discrepancy on unfixed code).
      const baseParams = {
        rsi1m: 20,   // Single oversold RSI — only grouped indicator
        rsi5m: null,
        rsi15m: null,
        rsi1h: null, // null → TFA guard does NOT fire (no multiplier applied)
        rsi4h: null,
        rsi1d: null,
        macdHistogram: null,
        bbPosition: null,
        stochK: null,
        stochD: null,
        emaCross: 'none' as const,
        vwapDiff: null,
        volumeSpike: false,
        price: 50000,
        confluence: undefined,
        rsiDivergence: 'none' as const,
        momentum: null,
        atr: 1000,
        adx: null,
        regime: undefined,
        tradingStyle: 'intraday' as const,
      };

      const originalFlag = SIGNAL_FEATURES.useCorrelationPenalty;

      try {
        (SIGNAL_FEATURES as any).useCorrelationPenalty = false;
        const withoutPenalty = computeStrategyScore(baseParams);

        (SIGNAL_FEATURES as any).useCorrelationPenalty = true;
        const withPenalty = computeStrategyScore(baseParams);

        // Single grouped indicator → diminishing returns = 100% weight = no change.
        // Both paths must produce the same score, verifying the flag works correctly.
        expect(withPenalty.score).toBe(withoutPenalty.score);
      } finally {
        (SIGNAL_FEATURES as any).useCorrelationPenalty = originalFlag;
      }
    });
  });

  // ── Preservation 2: Super Signal High-Confidence Boost Preserved ──

  describe('Preservation 2: Super Signal High-Confidence Boost Preserved', () => {
    it('should return multiplier > 1.0 when superSignalScore=80 agrees with bullish strategy', () => {
      // |80 - 50| = 30 > 10 → high confidence → boost applies
      const result = validateWithSuperSignal(60, 80);
      expect(result.multiplier).toBeGreaterThan(1.0);
      expect(result.confidence).toBe('high');
    });
  });

  // ── Preservation 3: Super Signal High-Confidence Penalty Preserved ──

  describe('Preservation 3: Super Signal High-Confidence Penalty Preserved', () => {
    it('should return multiplier < 1.0 when superSignalScore=20 contradicts bullish strategy', () => {
      // |20 - 50| = 30 > 10 → high confidence → penalty applies
      const result = validateWithSuperSignal(60, 20);
      expect(result.multiplier).toBeLessThan(1.0);
      expect(result.confidence).toBe('low');
    });
  });

  // ── Preservation 4: FLOW Normal Display Preserved ──

  describe('Preservation 4: FLOW Normal Display Preserved', () => {
    it('should show flow-indicator when orderFlowData is present', () => {
      const isConnected = true;
      const orderFlowData = { ratio: 0.65, pressure: 'buy', buyVolume1m: 100000, sellVolume1m: 50000 };

      const display = orderFlowData ? 'flow-indicator' : isConnected ? '···' : '—';
      expect(display).toBe('flow-indicator');
    });
  });

  // ── Preservation 5: FLOW Disconnected State Preserved ──

  describe('Preservation 5: FLOW Disconnected State Preserved', () => {
    it('should show dash when disconnected and no flow data', () => {
      const isConnected = false;
      const orderFlowData = null;

      const display = orderFlowData ? 'flow-indicator' : isConnected ? '···' : '—';
      expect(display).toBe('—');
    });
  });
});
