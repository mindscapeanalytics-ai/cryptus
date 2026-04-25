/**
 * Centralized metrics collection for the RSI screener system.
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */

export interface MetricsSnapshot {
  latency: Record<string, { avg: number; p95: number; p99: number; count: number }>;
  cache: { hits: number; misses: number; hitRate: number };
  api: { weights: Record<string, number> };
  alerts: { total: number; byType: Record<string, number> };
  errors: { total: number; recent: Array<{ message: string; context: any; timestamp: number; stack?: string }> };
  uptime: number; // ms since collector was created
}

const MAX_LATENCY_WINDOW = 1000;
const MAX_ERROR_BUFFER = 50;

export class MetricsCollector {
  private latencies: Map<string, number[]> = new Map();
  private cacheHits = 0;
  private cacheMisses = 0;
  private apiWeights: Map<string, number> = new Map();
  private alertsByType: Map<string, number> = new Map();
  private errors: Array<{ message: string; context: any; timestamp: number; stack?: string }> = [];
  private readonly startTime = Date.now();

  // ── Latency ────────────────────────────────────────────────────────────────

  recordLatency(operation: string, durationMs: number): void {
    if (!this.latencies.has(operation)) {
      this.latencies.set(operation, []);
    }
    const measurements = this.latencies.get(operation)!;
    measurements.push(durationMs);
    // Rolling window: keep last 1000
    if (measurements.length > MAX_LATENCY_WINDOW) {
      measurements.shift();
    }
  }

  // ── Cache ──────────────────────────────────────────────────────────────────

  recordCacheHit(hit: boolean): void {
    if (hit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
  }

  // ── API weight ─────────────────────────────────────────────────────────────

  recordAPIWeight(exchange: string, weight: number): void {
    const current = this.apiWeights.get(exchange) ?? 0;
    this.apiWeights.set(exchange, current + weight);
  }

  // ── Alerts ─────────────────────────────────────────────────────────────────

  recordAlertFired(symbol: string, type: string): void {
    const key = type;
    this.alertsByType.set(key, (this.alertsByType.get(key) ?? 0) + 1);
  }

  // ── Errors (Task 12.4) ─────────────────────────────────────────────────────

  recordError(error: Error | string, context: Record<string, any> = {}): void {
    const message = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? error.stack : undefined;
    const entry = { message, context, timestamp: Date.now(), stack };

    console.error('[metrics] Error recorded:', message, context);

    // Circular buffer: keep last 50
    this.errors.push(entry);
    if (this.errors.length > MAX_ERROR_BUFFER) {
      this.errors.shift();
    }
  }

  // ── Snapshot ───────────────────────────────────────────────────────────────

  getMetrics(): MetricsSnapshot {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total === 0 ? 0 : this.cacheHits / total;

    const latencySnapshot: MetricsSnapshot['latency'] = {};
    for (const [op, measurements] of this.latencies) {
      latencySnapshot[op] = this.calculatePercentiles(measurements);
    }

    return {
      latency: latencySnapshot,
      cache: { hits: this.cacheHits, misses: this.cacheMisses, hitRate },
      api: { weights: Object.fromEntries(this.apiWeights) },
      alerts: {
        total: Array.from(this.alertsByType.values()).reduce((a, b) => a + b, 0),
        byType: Object.fromEntries(this.alertsByType),
      },
      errors: {
        total: this.errors.length,
        recent: [...this.errors],
      },
      uptime: Date.now() - this.startTime,
    };
  }

  // ── Signal Quality Tracking (2026 Intelligence) ─────────────────────────────

  private signalsFired = 0;
  private signalOutcomes: { win5m: number; win15m: number; win1h: number; total: number } = {
    win5m: 0, win15m: 0, win1h: 0, total: 0,
  };

  recordSignalFired(symbol: string, signal: string, score: number): void {
    this.signalsFired++;
    // Also track by alert type for breakdown
    const key = `signal:${signal}`;
    this.alertsByType.set(key, (this.alertsByType.get(key) ?? 0) + 1);
  }

  recordSignalOutcome(
    symbol: string,
    signal: string,
    winAt5m: boolean,
    winAt15m: boolean,
    winAt1h: boolean,
  ): void {
    this.signalOutcomes.total++;
    if (winAt5m) this.signalOutcomes.win5m++;
    if (winAt15m) this.signalOutcomes.win15m++;
    if (winAt1h) this.signalOutcomes.win1h++;
  }

  getSignalQuality(): {
    totalFired: number;
    totalOutcomes: number;
    winRate5m: number;
    winRate15m: number;
    winRate1h: number;
  } {
    const t = this.signalOutcomes.total || 1; // Prevent division by zero
    return {
      totalFired: this.signalsFired,
      totalOutcomes: this.signalOutcomes.total,
      winRate5m: Math.round((this.signalOutcomes.win5m / t) * 100),
      winRate15m: Math.round((this.signalOutcomes.win15m / t) * 100),
      winRate1h: Math.round((this.signalOutcomes.win1h / t) * 100),
    };
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  reset(): void {
    this.latencies.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.apiWeights.clear();
    this.alertsByType.clear();
    this.errors = [];
    this.signalsFired = 0;
    this.signalOutcomes = { win5m: 0, win15m: 0, win1h: 0, total: 0 };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private calculatePercentiles(
    measurements: number[],
  ): { avg: number; p95: number; p99: number; count: number } {
    if (measurements.length === 0) {
      return { avg: 0, p95: 0, p99: 0, count: 0 };
    }
    const sorted = [...measurements].sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
    const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? sorted[sorted.length - 1];
    return { avg, p95, p99, count: measurements.length };
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();
