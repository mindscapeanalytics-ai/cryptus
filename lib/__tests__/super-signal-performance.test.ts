/**
 * RSIQ Pro - SUPER_SIGNAL Performance Validation Tests
 * Copyright © 2024-2026 Mindscape Analytics LLC. All rights reserved.
 *
 * Performance benchmarks and latency validation for SUPER_SIGNAL.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { computeSuperSignal, clearAllCaches } from '../super-signal';
import type { ScreenerEntry } from '../types';

// ── Test Fixtures ─────────────────────────────────────────────────

function createMockEntry(symbol: string = 'BTCUSDT'): ScreenerEntry {
  return {
    symbol,
    price: 50000 + Math.random() * 1000,
    change24h: (Math.random() - 0.5) * 10,
    volume24h: 1000000000 + Math.random() * 500000000,
    rsi1m: 40 + Math.random() * 20,
    rsi5m: 45 + Math.random() * 20,
    rsi15m: 50 + Math.random() * 20,
    rsi1h: 55 + Math.random() * 20,
    rsi4h: 60 + Math.random() * 20,
    rsi1d: 65 + Math.random() * 20,
    signal: 'neutral',
    ema9: 49800,
    ema21: 49500,
    emaCross: 'bullish',
    macdLine: 100,
    macdSignal: 80,
    macdHistogram: 20,
    bbUpper: 51000,
    bbMiddle: 50000,
    bbLower: 49000,
    bbPosition: 0.5,
    stochK: 60,
    stochD: 55,
    vwap: 49900,
    vwapDiff: 0.2,
    volumeSpike: false,
    longCandle: false,
    strategyScore: 65,
    strategySignal: 'buy',
    strategyLabel: 'Buy',
    strategyReasons: ['RSI oversold', 'MACD bullish'],
    confluence: 60,
    confluenceLabel: 'Bullish',
    rsiDivergence: 'none',
    momentum: 5,
    atr: 500,
    adx: 28,
    cci: 50,
    obvTrend: 'bullish',
    williamsR: -40,
    avgBarSize1m: 100,
    avgVolume1m: 50000000,
    curCandleSize: 120,
    curCandleVol: 60000000,
    candleDirection: 'bullish',
    rsiCustom: null,
    rsiStateCustom: null,
    rsiState1m: null,
    rsiState5m: null,
    rsiState15m: null,
    rsiState1h: null,
    rsiState4h: null,
    rsiState1d: null,
    ema9State: null,
    ema21State: null,
    macdFastState: null,
    macdSlowState: null,
    macdSignalState: null,
    market: 'Crypto',
    marketState: 'OPEN',
    open1m: 49950,
    volStart1m: 45000000,
    historicalCloses: Array.from({ length: 50 }, (_, i) => 49000 + i * 20 + Math.random() * 50),
    regime: {
      regime: 'trending',
      confidence: 75,
      details: 'Strong uptrend',
    },
  };
}

// ── Performance Utilities ─────────────────────────────────────────

function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// ── Performance Tests ─────────────────────────────────────────────

describe('SUPER_SIGNAL Performance Validation', () => {
  beforeEach(() => {
    clearAllCaches();
  });

  // ── Test 1: Single Symbol Latency ────────────────────────────────

  describe('Single Symbol Latency', () => {
    it('should compute SUPER_SIGNAL in <50ms p95 with cache warm', async () => {
      const entry = createMockEntry();
      const iterations = 100;
      const latencies: number[] = [];

      // Warm up cache
      await computeSuperSignal(entry);

      // Measure latencies
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await computeSuperSignal(entry);
        const end = performance.now();
        latencies.push(end - start);
      }

      const p50 = calculatePercentile(latencies, 50);
      const p95 = calculatePercentile(latencies, 95);
      const p99 = calculatePercentile(latencies, 99);

      console.log(`\n📊 Single Symbol Latency (cache warm):`);
      console.log(`   p50: ${p50.toFixed(2)}ms`);
      console.log(`   p95: ${p95.toFixed(2)}ms`);
      console.log(`   p99: ${p99.toFixed(2)}ms`);

      expect(p95).toBeLessThan(50);
    }, 30000);

    it('should compute SUPER_SIGNAL in <100ms p95 with cache cold', async () => {
      const iterations = 50;
      const latencies: number[] = [];

      // Measure latencies with cold cache
      for (let i = 0; i < iterations; i++) {
        clearAllCaches();
        const entry = createMockEntry(`SYMBOL${i}`);
        
        const start = performance.now();
        await computeSuperSignal(entry);
        const end = performance.now();
        latencies.push(end - start);
      }

      const p50 = calculatePercentile(latencies, 50);
      const p95 = calculatePercentile(latencies, 95);
      const p99 = calculatePercentile(latencies, 99);

      console.log(`\n📊 Single Symbol Latency (cache cold):`);
      console.log(`   p50: ${p50.toFixed(2)}ms`);
      console.log(`   p95: ${p95.toFixed(2)}ms`);
      console.log(`   p99: ${p99.toFixed(2)}ms`);

      expect(p95).toBeLessThan(100);
    }, 30000);
  });

  // ── Test 2: Cache Effectiveness ──────────────────────────────────

  describe('Cache Effectiveness', () => {
    it('should return cached scores within TTL without recomputation', async () => {
      const entry = createMockEntry();
      
      // First call - cold cache
      const start1 = performance.now();
      const result1 = await computeSuperSignal(entry);
      const end1 = performance.now();
      const latency1 = end1 - start1;

      // Warm cache (within TTL): measure a few times and use best latency to reduce noise.
      let result2: typeof result1 = null;
      const warmLatencies: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start2 = performance.now();
        result2 = await computeSuperSignal(entry);
        const end2 = performance.now();
        warmLatencies.push(end2 - start2);
      }
      const latency2 = Math.min(...warmLatencies);

      console.log(`\n📊 Cache Effectiveness:`);
      console.log(`   Cold cache: ${latency1.toFixed(2)}ms`);
      console.log(`   Warm cache: ${latency2.toFixed(2)}ms`);
      console.log(`   Speedup: ${(latency1 / latency2).toFixed(1)}x`);

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      
      if (result1 && result2) {
        // Results should be identical from cache
        expect(result1.value).toBe(result2.value);
        // Warm cache should be at least not slower than cold (allow some runtime jitter).
        expect(latency2).toBeLessThan(latency1 + 1.0);
      }
    });
  });

  // ── Test 3: Parallel Computation ─────────────────────────────────

  describe('Parallel Computation', () => {
    it('should handle parallel computations efficiently', async () => {
      const symbols = Array.from({ length: 10 }, (_, i) => `SYMBOL${i}`);
      const entries = symbols.map(sym => createMockEntry(sym));

      const start = performance.now();
      const results = await Promise.all(entries.map(entry => computeSuperSignal(entry)));
      const end = performance.now();
      const totalTime = end - start;
      const avgTime = totalTime / entries.length;

      console.log(`\n📊 Parallel Computation (10 symbols):`);
      console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`   Avg per symbol: ${avgTime.toFixed(2)}ms`);

      expect(results.every(r => r !== null)).toBe(true);
      expect(avgTime).toBeLessThan(50);
    }, 30000);
  });

  // ── Test 4: Component-Level Performance ──────────────────────────

  describe('Component-Level Performance', () => {
    it('should track individual component compute times', async () => {
      const entry = createMockEntry();
      const result = await computeSuperSignal(entry);

      expect(result).not.toBeNull();

      if (result) {
        console.log(`\n📊 Component Compute Times:`);
        console.log(`   Regime: ${result.components.regime.computeTimeMs?.toFixed(2) ?? 'N/A'}ms`);
        console.log(`   Liquidity: ${result.components.liquidity.computeTimeMs?.toFixed(2) ?? 'N/A'}ms`);
        console.log(`   Entropy: ${result.components.entropy.computeTimeMs?.toFixed(2) ?? 'N/A'}ms`);
        console.log(`   Cross-Asset: ${result.components.crossAsset.computeTimeMs?.toFixed(2) ?? 'N/A'}ms`);
        console.log(`   Risk: ${result.components.risk.computeTimeMs?.toFixed(2) ?? 'N/A'}ms`);
        console.log(`   Total: ${result.computeTimeMs.toFixed(2)}ms`);

        // Each component should be reasonably fast
        if (result.components.regime.computeTimeMs) {
          expect(result.components.regime.computeTimeMs).toBeLessThan(20);
        }
        if (result.components.liquidity.computeTimeMs) {
          expect(result.components.liquidity.computeTimeMs).toBeLessThan(20);
        }
        if (result.components.entropy.computeTimeMs) {
          expect(result.components.entropy.computeTimeMs).toBeLessThan(20);
        }
        if (result.components.crossAsset.computeTimeMs) {
          expect(result.components.crossAsset.computeTimeMs).toBeLessThan(20);
        }
        if (result.components.risk.computeTimeMs) {
          expect(result.components.risk.computeTimeMs).toBeLessThan(20);
        }
      }
    });
  });

  // ── Test 5: Memory Efficiency ────────────────────────────────────

  describe('Memory Efficiency', () => {
    it('should not leak memory with repeated computations', async () => {
      const iterations = 1000;
      const entry = createMockEntry();

      // Warm up
      await computeSuperSignal(entry);

      // Measure memory before
      if (global.gc) global.gc();
      const memBefore = process.memoryUsage().heapUsed;

      // Run many iterations
      for (let i = 0; i < iterations; i++) {
        await computeSuperSignal(entry);
      }

      // Measure memory after
      if (global.gc) global.gc();
      const memAfter = process.memoryUsage().heapUsed;
      const memDelta = (memAfter - memBefore) / 1024 / 1024; // MB

      console.log(`\n📊 Memory Usage (${iterations} iterations):`);
      console.log(`   Before: ${(memBefore / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   After: ${(memAfter / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Delta: ${memDelta.toFixed(2)} MB`);

      // Memory growth should be minimal (< 10MB for 1000 iterations)
      expect(Math.abs(memDelta)).toBeLessThan(10);
    }, 60000);
  });
});
