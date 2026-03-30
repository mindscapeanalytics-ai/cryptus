import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from '../metrics-collector';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  // ── recordLatency ──────────────────────────────────────────────────────────

  describe('recordLatency', () => {
    it('stores measurements and returns correct count', () => {
      collector.recordLatency('fetch', 100);
      collector.recordLatency('fetch', 200);
      collector.recordLatency('fetch', 300);

      const metrics = collector.getMetrics();
      expect(metrics.latency['fetch'].count).toBe(3);
    });

    it('calculates correct average', () => {
      collector.recordLatency('op', 100);
      collector.recordLatency('op', 200);
      collector.recordLatency('op', 300);

      const { avg } = collector.getMetrics().latency['op'];
      expect(avg).toBeCloseTo(200, 5);
    });

    it('tracks multiple operations independently', () => {
      collector.recordLatency('fetch', 50);
      collector.recordLatency('calc', 150);

      const metrics = collector.getMetrics();
      expect(metrics.latency['fetch'].count).toBe(1);
      expect(metrics.latency['calc'].count).toBe(1);
    });

    it('enforces rolling window of 1000 measurements', () => {
      for (let i = 0; i < 1100; i++) {
        collector.recordLatency('op', i);
      }
      const metrics = collector.getMetrics();
      expect(metrics.latency['op'].count).toBe(1000);
    });
  });

  // ── getMetrics percentiles ─────────────────────────────────────────────────

  describe('getMetrics percentiles', () => {
    it('returns zero stats when no measurements recorded', () => {
      const metrics = collector.getMetrics();
      expect(metrics.latency).toEqual({});
    });

    it('calculates p95 correctly for a sorted dataset', () => {
      // 20 values: 1..20; p95 index = floor(20 * 0.95) = 19 → value 20
      for (let i = 1; i <= 20; i++) {
        collector.recordLatency('op', i);
      }
      const { p95 } = collector.getMetrics().latency['op'];
      expect(p95).toBe(20);
    });

    it('calculates p99 correctly for a sorted dataset', () => {
      // 100 values: 1..100; p99 index = floor(100 * 0.99) = 99 → value 100
      for (let i = 1; i <= 100; i++) {
        collector.recordLatency('op', i);
      }
      const { p99 } = collector.getMetrics().latency['op'];
      expect(p99).toBe(100);
    });
  });

  // ── recordCacheHit ─────────────────────────────────────────────────────────

  describe('recordCacheHit', () => {
    it('tracks hits and misses separately', () => {
      collector.recordCacheHit(true);
      collector.recordCacheHit(true);
      collector.recordCacheHit(false);

      const { hits, misses } = collector.getMetrics().cache;
      expect(hits).toBe(2);
      expect(misses).toBe(1);
    });

    it('calculates hitRate correctly', () => {
      collector.recordCacheHit(true);
      collector.recordCacheHit(true);
      collector.recordCacheHit(false);

      const { hitRate } = collector.getMetrics().cache;
      expect(hitRate).toBeCloseTo(2 / 3, 5);
    });

    it('returns hitRate of 0 when no cache events recorded', () => {
      const { hitRate } = collector.getMetrics().cache;
      expect(hitRate).toBe(0);
    });

    it('returns hitRate of 1 when all hits', () => {
      collector.recordCacheHit(true);
      collector.recordCacheHit(true);
      const { hitRate } = collector.getMetrics().cache;
      expect(hitRate).toBe(1);
    });
  });

  // ── recordError ────────────────────────────────────────────────────────────

  describe('recordError', () => {
    it('stores errors with message, context, and timestamp', () => {
      const before = Date.now();
      collector.recordError(new Error('test error'), { symbol: 'BTCUSDT' });
      const after = Date.now();

      const { recent } = collector.getMetrics().errors;
      expect(recent).toHaveLength(1);
      expect(recent[0].message).toBe('test error');
      expect(recent[0].context).toEqual({ symbol: 'BTCUSDT' });
      expect(recent[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(recent[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('accepts string errors', () => {
      collector.recordError('something went wrong', {});
      const { recent } = collector.getMetrics().errors;
      expect(recent[0].message).toBe('something went wrong');
    });

    it('stores stack trace for Error instances', () => {
      collector.recordError(new Error('with stack'), {});
      const { recent } = collector.getMetrics().errors;
      expect(recent[0].stack).toBeDefined();
    });

    it('enforces circular buffer of 50 errors', () => {
      for (let i = 0; i < 60; i++) {
        collector.recordError(`error ${i}`, {});
      }
      const { recent, total } = collector.getMetrics().errors;
      expect(recent).toHaveLength(50);
      expect(total).toBe(50);
      // Oldest entries should have been dropped; last entry is error 59
      expect(recent[recent.length - 1].message).toBe('error 59');
    });
  });

  // ── reset ──────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears all metrics', () => {
      collector.recordLatency('op', 100);
      collector.recordCacheHit(true);
      collector.recordAPIWeight('binance', 10);
      collector.recordAlertFired('BTCUSDT', 'rsi_oversold');
      collector.recordError('err', {});

      collector.reset();

      const metrics = collector.getMetrics();
      expect(metrics.latency).toEqual({});
      expect(metrics.cache.hits).toBe(0);
      expect(metrics.cache.misses).toBe(0);
      expect(metrics.api.weights).toEqual({});
      expect(metrics.alerts.total).toBe(0);
      expect(metrics.errors.total).toBe(0);
    });
  });

  // ── uptime ─────────────────────────────────────────────────────────────────

  describe('uptime', () => {
    it('returns a non-negative uptime value', () => {
      const { uptime } = collector.getMetrics();
      expect(uptime).toBeGreaterThanOrEqual(0);
    });
  });
});
