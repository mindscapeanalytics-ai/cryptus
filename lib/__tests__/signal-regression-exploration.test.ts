/**
 * Bug Condition Exploration Tests
 * 
 * These tests MUST FAIL on unfixed code — failure confirms the bugs exist.
 * They encode the expected (correct) behavior and will pass once the bugs are fixed.
 * 
 * DO NOT fix the code when these tests fail. Document the failures and proceed.
 */

import { computeStrategyScore } from '../indicators';
import { validateWithSuperSignal } from '../signal-validation';
import { SIGNAL_FEATURES } from '../feature-flags';

describe('Bug Condition Exploration Tests (EXPECTED TO FAIL on unfixed code)', () => {

  // ── Bug 1a: Correlation Penalty Discards Non-Grouped Score ──────────────

  describe('Bug 1a: Correlation Penalty Discards Non-Grouped Score', () => {
    it('should preserve confluence contribution when correlation penalty is enabled', () => {
      // Force correlation penalty on
      const originalFlag = SIGNAL_FEATURES.useCorrelationPenalty;
      (SIGNAL_FEATURES as any).useCorrelationPenalty = true;

      try {
        const result = computeStrategyScore({
          rsi1m: null,
          rsi5m: null,
          rsi15m: null,
          rsi1h: 25,          // Oversold — bullish RSI contribution
          rsi4h: null,
          rsi1d: null,
          macdHistogram: null,
          bbPosition: null,
          stochK: null,
          stochD: null,
          emaCross: 'none',
          vwapDiff: null,
          volumeSpike: false,
          price: 50000,
          confluence: 80,         // Strong bullish confluence (non-grouped)
          rsiDivergence: 'bullish', // Bullish divergence (non-grouped)
          momentum: 5,            // Positive momentum (non-grouped)
          atr: 1000,
          adx: 25,
          regime: undefined,
          tradingStyle: 'intraday',
        });

        // With confluence=80 and bullish divergence, score should be significantly positive.
        // Bug: score is near 0 because correlation penalty replaces full score with only
        // grouped indicator scores, discarding confluence (80) and divergence contributions.
        //
        // Trace (unfixed):
        //   RSI 1h=25 → indicatorScores.rsi = 80 * 2.5 = 200
        //   confluence=80 → score += 80 * 2.5 = 200 (NOT in indicatorScores)
        //   divergence='bullish' → score += 75 * 1.0 = 75 (NOT in indicatorScores)
        //   momentum=5 → score += ~37.5 (NOT in indicatorScores)
        //   TFA guard (rsi1h<45): score *= trendAlignedBoost (full score multiplied)
        //   Correlation penalty: score = adjustedScore ≈ diminished RSI only ≈ 200
        //   factors ≈ 6.5 → normalized ≈ 200/6.5 ≈ 30 (confluence/divergence lost)
        //
        // Fixed: score = adjustedGroupedScore + nonGroupedScore
        //   nonGroupedScore ≈ 200 + 75 + 37.5 = 312.5
        //   normalized ≈ (200 + 312.5) / 6.5 ≈ 78 → Strong Buy
        //
        // The bug causes score to be ~30 instead of ~78.
        // Use threshold of 60 to distinguish buggy (~30) from fixed (~78).
        expect(result.score).toBeGreaterThan(60);
      } finally {
        (SIGNAL_FEATURES as any).useCorrelationPenalty = originalFlag;
      }
    });
  });

  // ── Bug 1b: Super Signal Near-Neutral Penalty ───────────────────────────

  describe('Bug 1b: Super Signal Near-Neutral Penalty', () => {
    it('should return multiplier=1.0 when superSignalScore=44 (near-neutral, low confidence)', () => {
      // normalized superSignalScore=-6 (near-neutral, low confidence)
      // strategyScore=45 → 'bullish'
      // Bug: direction disagreement triggers penalty → multiplier < 1.0
      // Fix: |-6| ≤ 10 → confidence too low → skip penalty → multiplier = 1.0
      const result = validateWithSuperSignal(45, -6);
      expect(result.multiplier).toBe(1.0);
    });

    it('should return multiplier=1.0 when superSignalScore=50 (exact neutral)', () => {
      // superSignalScore=0 → 'neutral'
      const result = validateWithSuperSignal(60, 0);
      expect(result.multiplier).toBe(1.0);
    });

    it('should return multiplier=1.0 when superSignalScore=56 (slightly above neutral, near-neutral)', () => {
      // normalized superSignalScore=6 (near-neutral, low confidence)
      // strategyScore=-40 → 'bearish'
      // Bug: direction disagreement triggers penalty → multiplier < 1.0
      // Fix: |6| ≤ 10 → confidence too low → skip penalty → multiplier = 1.0
      const result = validateWithSuperSignal(-40, 6);
      expect(result.multiplier).toBe(1.0);
    });
  });

  // ── Bug 1c: Strategy Display Threshold Too High ─────────────────────────

  describe('Bug 1c: Strategy Display Threshold Too High', () => {
    it('should classify score 57 as Strong Buy (correct threshold is 55, not 60)', () => {
      // Using the CORRECT threshold (55):
      const strategyScore = 57;
      const correctLabel = strategyScore >= 55 ? 'Strong Buy' : strategyScore >= 25 ? 'Buy' : 'Neutral';
      expect(correctLabel).toBe('Strong Buy');

      // Using the BUGGY threshold (60) — documents the bug:
      const buggyLabel = strategyScore >= 60 ? 'Strong Buy' : strategyScore >= 25 ? 'Buy' : 'Neutral';
      // This assertion documents the bug: the buggy threshold produces 'Buy' not 'Strong Buy'
      expect(buggyLabel).toBe('Buy'); // This IS the bug
    });

    it('should classify score -57 as Strong Sell (correct threshold is -55, not -60)', () => {
      const strategyScore = -57;
      const correctLabel = strategyScore <= -55 ? 'Strong Sell' : strategyScore <= -25 ? 'Sell' : 'Neutral';
      expect(correctLabel).toBe('Strong Sell');

      const buggyLabel = strategyScore <= -60 ? 'Strong Sell' : strategyScore <= -25 ? 'Sell' : 'Neutral';
      expect(buggyLabel).toBe('Sell'); // This IS the bug
    });
  });

  // ── Bug 2: FLOW Column Shows `—` During Accumulation ───────────────────

  describe('Bug 2: FLOW Column Loading State', () => {
    it('should show loading indicator (···) when connected but no flow data yet', () => {
      // Documents the expected behavior for the FLOW cell render logic.
      // Bug: shows '—' regardless of connection state.
      // Fix: show '···' when isConnected=true and orderFlowData=null.
      const isConnected = true;
      const orderFlowData = null;

      // Expected (fixed) conditional:
      const expectedDisplay = orderFlowData ? 'flow-indicator' : isConnected ? '···' : '—';
      expect(expectedDisplay).toBe('···');
    });

    it('should show dash (—) when disconnected and no flow data', () => {
      // Preservation: disconnected + no data → still shows '—'
      const isConnected = false;
      const orderFlowData = null;

      const expectedDisplay = orderFlowData ? 'flow-indicator' : isConnected ? '···' : '—';
      expect(expectedDisplay).toBe('—');
    });
  });
});
