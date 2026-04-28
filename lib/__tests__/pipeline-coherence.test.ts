import { describe, it, expect } from 'vitest';
import { __test__ as screenerTest } from '@/lib/screener-service';
import type { BinanceKline } from '@/lib/types';

function kline(openTime: number, open: number, high: number, low: number, close: number, volume: number): BinanceKline {
  // BinanceKline: [openTime, open, high, low, close, volume, closeTime, ...]
  return [
    openTime,
    String(open),
    String(high),
    String(low),
    String(close),
    String(volume),
    openTime + 60_000 - 1,
    '0',
    0,
    '0',
    '0',
    '0',
  ];
}

function makeKlines1m(count: number, startTime: number, startPrice: number, step: number): BinanceKline[] {
  const out: BinanceKline[] = [];
  for (let i = 0; i < count; i++) {
    const t = startTime + i * 60_000;
    const o = startPrice + i * step;
    const c = startPrice + (i + 1) * step;
    const h = Math.max(o, c) * 1.001;
    const l = Math.min(o, c) * 0.999;
    out.push(kline(t, o, h, l, c, 1000 + i));
  }
  return out;
}

describe('Pipeline coherence (buildEntry/applyCurrentCycleCoherence)', () => {
  it('derives Signal coherently from Strategy (no contradictory RSI extremes)', () => {
    const now = Date.now();
    const klines1m = makeKlines1m(200, now - 200 * 60_000, 100, 0.05);
    const ticker = {
      symbol: 'BTCUSDT',
      lastPrice: '110',
      priceChangePercent: '5',
      highPrice: '115',
      lowPrice: '95',
      quoteVolume: '1000000',
    };

    const entry = screenerTest.buildEntry(
      'BTCUSDT',
      klines1m,
      null,
      null,
      null,
      ticker as any,
      now,
      14,
      undefined,
      undefined,
      'intraday'
    );
    expect(entry).not.toBeNull();
    if (!entry) return;

    // Sanity: Strategy is defined.
    expect(entry.strategySignal).toBeDefined();
    // Coherent signal mapper should never show overbought if strategy is buy (and vice versa).
    if (entry.strategySignal === 'buy' || entry.strategySignal === 'strong-buy') {
      expect(entry.signal).not.toBe('overbought');
    }
    if (entry.strategySignal === 'sell' || entry.strategySignal === 'strong-sell') {
      expect(entry.signal).not.toBe('oversold');
    }
  });

  it('recomputes Strategy using same-cycle Super Signal (no lag)', () => {
    const now = Date.now();
    const klines1m = makeKlines1m(220, now - 220 * 60_000, 100, -0.05);
    const ticker = {
      symbol: 'ETHUSDT',
      lastPrice: '90',
      priceChangePercent: '-4',
      highPrice: '110',
      lowPrice: '85',
      quoteVolume: '900000',
    };

    const entry = screenerTest.buildEntry(
      'ETHUSDT',
      klines1m,
      null,
      null,
      null,
      ticker as any,
      now,
      14,
      undefined,
      undefined,
      'intraday'
    );
    expect(entry).not.toBeNull();
    if (!entry) return;

    const prevScore = entry.strategyScore;
    // Inject a strong super signal and force same-cycle coherence recompute.
    entry.superSignal = { value: 90, category: 'Strong Buy', status: 'ok', confidence: 90, diagnostics: [] } as any;
    screenerTest.applyCurrentCycleCoherence(entry, undefined as any, 'intraday', undefined, now);

    // Score should shift (validation is enabled by default) and remain bounded.
    expect(entry.strategyScore).not.toBe(prevScore);
    expect(entry.strategyScore).toBeLessThanOrEqual(100);
    expect(entry.strategyScore).toBeGreaterThanOrEqual(-100);
    // Strategy signal must remain one of the allowed enums.
    expect(['strong-buy', 'buy', 'neutral', 'sell', 'strong-sell']).toContain(entry.strategySignal);
  });

  it('ignores low-confidence Super Signal in strategy validation path', () => {
    const now = Date.now();
    const klines1m = makeKlines1m(210, now - 210 * 60_000, 100, 0.03);
    const ticker = {
      symbol: 'SOLUSDT',
      lastPrice: '125',
      priceChangePercent: '2',
      highPrice: '128',
      lowPrice: '98',
      quoteVolume: '750000',
    };

    const entry = screenerTest.buildEntry(
      'SOLUSDT',
      klines1m,
      null,
      null,
      null,
      ticker as any,
      now,
      14,
      undefined,
      undefined,
      'intraday'
    );
    expect(entry).not.toBeNull();
    if (!entry) return;

    // Baseline coherence run with no Super Signal.
    screenerTest.applyCurrentCycleCoherence(entry, undefined as any, 'intraday', undefined, now);
    const baselineScore = entry.strategyScore;
    const baselineSignal = entry.strategySignal;

    // Low-confidence/non-ok Super Signal should not influence strategy validation.
    entry.superSignal = {
      value: 90,
      category: 'Strong Buy',
      status: 'low-confidence',
      confidence: 35,
      diagnostics: ['insufficient correlated assets'],
    } as any;
    screenerTest.applyCurrentCycleCoherence(entry, undefined as any, 'intraday', undefined, now);

    expect(entry.strategyScore).toBe(baselineScore);
    expect(entry.strategySignal).toBe(baselineSignal);
  });

  it('never leaves opposite Strategy vs high-confidence Super Signal', () => {
    const now = Date.now();
    const klines1m = makeKlines1m(240, now - 240 * 60_000, 100, 0.04);
    const ticker = {
      symbol: 'FETUSDT',
      lastPrice: '110',
      priceChangePercent: '3',
      highPrice: '112',
      lowPrice: '96',
      quoteVolume: '800000',
    };

    const entry = screenerTest.buildEntry(
      'FETUSDT',
      klines1m,
      null,
      null,
      null,
      ticker as any,
      now,
      14,
      undefined,
      undefined,
      'intraday'
    );
    expect(entry).not.toBeNull();
    if (!entry) return;

    // First compute baseline strategy direction.
    screenerTest.applyCurrentCycleCoherence(entry, undefined as any, 'intraday', undefined, now);
    const baseline = entry.strategySignal;
    const isBaselineBuy = baseline === 'buy' || baseline === 'strong-buy';

    // Force an explicit high-confidence opposite Super Signal to baseline.
    entry.superSignal = isBaselineBuy
      ? ({ value: 20, category: 'Strong Sell', status: 'ok', confidence: 90, diagnostics: [] } as any)
      : ({ value: 80, category: 'Strong Buy', status: 'ok', confidence: 90, diagnostics: [] } as any);

    screenerTest.applyCurrentCycleCoherence(entry, undefined as any, 'intraday', undefined, now);
    const strategyDir = entry.strategySignal === 'buy' || entry.strategySignal === 'strong-buy'
      ? 'buy'
      : entry.strategySignal === 'sell' || entry.strategySignal === 'strong-sell'
        ? 'sell'
        : 'neutral';
    const superDir = entry.superSignal?.category?.includes('Buy')
      ? 'buy'
      : entry.superSignal?.category?.includes('Sell')
        ? 'sell'
        : 'neutral';

    // Hard guarantee: with high-confidence Super Signal, Strategy should never remain opposite.
    expect(!(strategyDir !== 'neutral' && superDir !== 'neutral' && strategyDir !== superDir)).toBe(true);
  });
});

