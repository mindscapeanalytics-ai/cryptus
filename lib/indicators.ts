/**
 * Technical indicators library.
 * All functions operate on arrays of numeric values (close prices, volumes, etc.)
 */

// ── EMA (Exponential Moving Average) ────────────────────────────

export function calculateEma(data: number[], period: number): number[] {
  if (data.length < period) return [];

  const k = 2 / (period + 1);
  const ema: number[] = [];

  // Seed with SMA of first `period` values
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  ema.push(sum / period);

  for (let i = period; i < data.length; i++) {
    ema.push(data[i] * k + ema[ema.length - 1] * (1 - k));
  }
  return ema;
}

/** Get latest EMA value, or null if not enough data. */
export function latestEma(data: number[], period: number): number | null {
  const ema = calculateEma(data, period);
  return ema.length > 0 ? round(ema[ema.length - 1]) : null;
}

// ── EMA Cross detection ─────────────────────────────────────────

export function detectEmaCross(
  closes: number[],
  fastPeriod: number,
  slowPeriod: number,
): 'bullish' | 'bearish' | 'none' {
  const fast = calculateEma(closes, fastPeriod);
  const slow = calculateEma(closes, slowPeriod);

  if (slow.length < 2) return 'none';

  // Align: fast EMA is longer than slow, offset to compare at the same data point
  const align = fast.length - slow.length;

  const f1 = fast[align + slow.length - 2]; // previous fast, aligned to previous slow
  const f2 = fast[align + slow.length - 1]; // current fast, aligned to current slow
  const s1 = slow[slow.length - 2];          // previous slow
  const s2 = slow[slow.length - 1];          // current slow

  if (f1 === undefined || f2 === undefined || s1 === undefined || s2 === undefined) return 'none';

  // Crossover detection
  if (f1 <= s1 && f2 > s2) return 'bullish';
  if (f1 >= s1 && f2 < s2) return 'bearish';
  // Current trend (no fresh cross)
  if (f2 > s2) return 'bullish';
  if (f2 < s2) return 'bearish';
  return 'none';
}

// ── MACD ────────────────────────────────────────────────────────

export interface MacdResult {
  macdLine: number;
  signalLine: number;
  histogram: number;
}

export function calculateMacd(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MacdResult | null {
  // Stability check: MACD needs ~3-4x the slow period for a stable signal line.
  // Slow=26, Signal=9 => roughly 35 bars.
  if (closes.length < slowPeriod + signalPeriod) return null;

  const emaFast = calculateEma(closes, fastPeriod);
  const emaSlow = calculateEma(closes, slowPeriod);

  if (emaSlow.length < signalPeriod) return null;

  // MACD line = fast EMA - slow EMA (aligned)
  const offset = emaFast.length - emaSlow.length;
  const macdLine: number[] = [];
  for (let i = 0; i < emaSlow.length; i++) {
    macdLine.push(emaFast[i + offset] - emaSlow[i]);
  }

  // Signal line = EMA of MACD line
  const signal = calculateEma(macdLine, signalPeriod);
  if (signal.length === 0) return null;

  const latestMacd = macdLine[macdLine.length - 1];
  const latestSignal = signal[signal.length - 1];

  return {
    macdLine: round(latestMacd),
    signalLine: round(latestSignal),
    histogram: round(latestMacd - latestSignal),
  };
}

// ── Bollinger Bands ─────────────────────────────────────────────

export interface BollingerResult {
  upper: number;
  middle: number;
  lower: number;
  /** 0 = at lower band, 0.5 = middle, 1 = at upper band */
  position: number;
}

export function calculateBollinger(
  closes: number[],
  period = 20,
  stdDevMultiplier = 2,
): BollingerResult | null {
  if (closes.length < period) return null;

  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;

  let variance = 0;
  for (const v of slice) variance += (v - mean) ** 2;
  const stdDev = Math.sqrt(variance / period);

  const upper = mean + stdDevMultiplier * stdDev;
  const lower = mean - stdDevMultiplier * stdDev;
  const current = closes[closes.length - 1];
  const range = upper - lower;
  // Clamp position to [0, 1] to handle outliers beyond the bands
  const pos = range > 0 ? Math.max(0, Math.min(1, (current - lower) / range)) : 0.5;

  return {
    upper: round(upper),
    middle: round(mean),
    lower: round(lower),
    position: round(pos),
  };
}

// ── Stochastic RSI ──────────────────────────────────────────────

export interface StochRsiResult {
  k: number;
  d: number;
}

export function calculateStochRsi(
  closes: number[],
  rsiPeriod = 14,
  stochPeriod = 14,
  kSmooth = 3,
  dSmooth = 3,
): StochRsiResult | null {
  // First compute RSI series
  if (closes.length < rsiPeriod + stochPeriod + kSmooth + dSmooth) return null;

  const rsiSeries: number[] = [];

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < rsiPeriod; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= rsiPeriod;
  avgLoss /= rsiPeriod;

  const firstRsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  rsiSeries.push(firstRsi);

  for (let i = rsiPeriod; i < changes.length; i++) {
    const c = changes[i];
    if (c > 0) {
      avgGain = (avgGain * (rsiPeriod - 1) + c) / rsiPeriod;
      avgLoss = (avgLoss * (rsiPeriod - 1)) / rsiPeriod;
    } else {
      avgGain = (avgGain * (rsiPeriod - 1)) / rsiPeriod;
      avgLoss = (avgLoss * (rsiPeriod - 1) + Math.abs(c)) / rsiPeriod;
    }
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    rsiSeries.push(rsi);
  }

  if (rsiSeries.length < stochPeriod) return null;

  // Stochastic of RSI
  const stochRaw: number[] = [];
  for (let i = stochPeriod - 1; i < rsiSeries.length; i++) {
    const window = rsiSeries.slice(i - stochPeriod + 1, i + 1);
    const min = Math.min(...window);
    const max = Math.max(...window);
    stochRaw.push(max === min ? 50 : ((rsiSeries[i] - min) / (max - min)) * 100);
  }

  // K = SMA of stochRaw
  if (stochRaw.length < kSmooth) return null;
  const kValues: number[] = [];
  for (let i = kSmooth - 1; i < stochRaw.length; i++) {
    let sum = 0;
    for (let j = 0; j < kSmooth; j++) sum += stochRaw[i - j];
    kValues.push(sum / kSmooth);
  }

  // D = SMA of K
  if (kValues.length < dSmooth) return null;
  let dSum = 0;
  for (let i = kValues.length - dSmooth; i < kValues.length; i++) dSum += kValues[i];

  return {
    k: round(kValues[kValues.length - 1]),
    d: round(dSum / dSmooth),
  };
}

// ── VWAP (Volume-Weighted Average Price) ────────────────────────

export function calculateVwap(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
): number | null {
  if (closes.length === 0 || highs.length === 0 || lows.length === 0 || volumes.length === 0) return null;

  let cumTPV = 0;
  let cumVol = 0;

  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumTPV += tp * volumes[i];
    cumVol += volumes[i];
  }

  return cumVol > 0 ? round(cumTPV / cumVol) : null;
}

// ── Volume Spike Detection ──────────────────────────────────────

export function detectVolumeSpike(
  volumes: number[],
  lookback = 20,
  threshold = 2.0,
): boolean {
  if (volumes.length < lookback + 1) return false;

  const recent = volumes.slice(-lookback - 1, -1);
  if (recent.length === 0) return false;
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const current = volumes[volumes.length - 1];

  return Number.isFinite(avg) && avg > 0 && Number.isFinite(current) && current >= avg * threshold;
}

// ── RSI Divergence ──────────────────────────────────────────────

function computeRsiSeries(closes: number[], period: number): number[] {
  const values: number[] = [];
  if (closes.length < period + 1) return values;

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) changes.push(closes[i] - closes[i - 1]);

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = 0; i < period; i++) values.push(50); // padding for alignment
  values.push(avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss));

  for (let i = period; i < changes.length; i++) {
    const c = changes[i];
    if (c > 0) {
      avgGain = (avgGain * (period - 1) + c) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(c)) / period;
    }
    values.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return values;
}

function findSwingLows(data: number[], tolerance = 3): number[] {
  const lows: number[] = [];
  for (let i = tolerance; i < data.length - tolerance; i++) {
    let isLow = true;
    for (let j = 1; j <= tolerance; j++) {
      if (data[i] > data[i - j] || data[i] > data[i + j]) { isLow = false; break; }
    }
    if (isLow) lows.push(i);
  }
  return lows;
}

function findSwingHighs(data: number[], tolerance = 3): number[] {
  const highs: number[] = [];
  for (let i = tolerance; i < data.length - tolerance; i++) {
    let isHigh = true;
    for (let j = 1; j <= tolerance; j++) {
      if (data[i] < data[i - j] || data[i] < data[i + j]) { isHigh = false; break; }
    }
    if (isHigh) highs.push(i);
  }
  return highs;
}

/**
 * Detect bullish or bearish RSI divergence.
 * Bullish: price makes lower lows while RSI makes higher lows (potential reversal up).
 * Bearish: price makes higher highs while RSI makes lower highs (potential reversal down).
 */
export function detectRsiDivergence(
  closes: number[],
  rsiPeriod = 14,
  lookback = 40,
): 'bullish' | 'bearish' | 'none' {
  if (closes.length < rsiPeriod + lookback) return 'none';

  const priceWindow = closes.slice(-lookback);
  const fullRsi = computeRsiSeries(closes.slice(-(rsiPeriod + lookback)), rsiPeriod);
  const rsiWindow = fullRsi.slice(-lookback);
  if (rsiWindow.length < lookback) return 'none';

  // Bullish divergence: lower price lows + higher RSI lows
  const priceLows = findSwingLows(priceWindow, 3);
  if (priceLows.length >= 2) {
    const prev = priceLows[priceLows.length - 2];
    const curr = priceLows[priceLows.length - 1];
    if (priceWindow[curr] < priceWindow[prev] && rsiWindow[curr] > rsiWindow[prev] + 1) {
      return 'bullish';
    }
  }

  // Bearish divergence: higher price highs + lower RSI highs
  const priceHighs = findSwingHighs(priceWindow, 3);
  if (priceHighs.length >= 2) {
    const prev = priceHighs[priceHighs.length - 2];
    const curr = priceHighs[priceHighs.length - 1];
    if (priceWindow[curr] > priceWindow[prev] && rsiWindow[curr] < rsiWindow[prev] - 1) {
      return 'bearish';
    }
  }

  return 'none';
}

// ── Rate of Change (Momentum) ───────────────────────────────────

/** Price rate of change over N periods, expressed as percentage. */
export function calculateROC(closes: number[], period = 10): number | null {
  if (closes.length < period + 1) return null;
  const current = closes[closes.length - 1];
  const previous = closes[closes.length - 1 - period];
  if (!Number.isFinite(previous) || previous === 0) return null;
  return round(((current - previous) / previous) * 100);
}

// ── Multi-Timeframe Confluence ──────────────────────────────────

export interface ConfluenceResult {
  score: number;   // -100 to +100
  label: string;
}

/** Measures how many indicators and timeframes agree on direction. */
export function calculateConfluence(params: {
  rsi1m: number | null;
  rsi5m: number | null;
  rsi15m: number | null;
  rsi1h: number | null;
  macdHistogram: number | null;
  emaCross: 'bullish' | 'bearish' | 'none';
  stochK: number | null;
  bbPosition: number | null;
}): ConfluenceResult {
  let bullish = 0;
  let bearish = 0;
  let total = 0;

  const checkRsi = (rsi: number | null, w: number) => {
    if (rsi === null) return;
    total += w;
    if (rsi < 30) bullish += w;
    else if (rsi < 40) bullish += w * 0.4;
    else if (rsi > 70) bearish += w;
    else if (rsi > 60) bearish += w * 0.4;
  };

  checkRsi(params.rsi1m, 0.5);
  checkRsi(params.rsi5m, 1);
  checkRsi(params.rsi15m, 1.5);
  checkRsi(params.rsi1h, 2);

  if (params.macdHistogram !== null) {
    total += 1;
    if (params.macdHistogram > 0) bullish += 1;
    else bearish += 1;
  }
  if (params.emaCross !== 'none') {
    total += 1;
    if (params.emaCross === 'bullish') bullish += 1;
    else bearish += 1;
  }
  if (params.stochK !== null) {
    total += 1;
    if (params.stochK < 20) bullish += 1;
    else if (params.stochK < 30) bullish += 0.5;
    else if (params.stochK > 80) bearish += 1;
    else if (params.stochK > 70) bearish += 0.5;
  }
  if (params.bbPosition !== null) {
    total += 1;
    if (params.bbPosition < 0.2) bullish += 1;
    else if (params.bbPosition < 0.3) bullish += 0.5;
    else if (params.bbPosition > 0.8) bearish += 1;
    else if (params.bbPosition > 0.7) bearish += 0.5;
  }

  if (total === 0) return { score: 0, label: 'No Data' };

  const raw = ((bullish - bearish) / total) * 100;
  const score = Math.round(Math.max(-100, Math.min(100, raw)));

  let label: string;
  if (score >= 60) label = 'Strong Bullish';
  else if (score >= 25) label = 'Bullish';
  else if (score <= -60) label = 'Strong Bearish';
  else if (score <= -25) label = 'Bearish';
  else label = 'Mixed';

  return { score, label };
}

// ── Strategy Scoring ────────────────────────────────────────────

export type StrategySignal = 'strong-buy' | 'buy' | 'neutral' | 'sell' | 'strong-sell';

export interface StrategyResult {
  score: number;        // -100 to +100
  signal: StrategySignal;
  label: string;
  reasons: string[];    // key factors driving the score
}

/**
 * Composite strategy scoring.
 * Weighs multiple indicators to produce a single buy/sell score.
 */
export function computeStrategyScore(params: {
  rsi1m: number | null;
  rsi5m: number | null;
  rsi15m: number | null;
  rsi1h: number | null;
  macdHistogram: number | null;
  bbPosition: number | null;
  stochK: number | null;
  stochD: number | null;
  emaCross: 'bullish' | 'bearish' | 'none';
  vwapDiff: number | null;
  volumeSpike: boolean;
  price: number;
  confluence?: number;
  rsiDivergence?: 'bullish' | 'bearish' | 'none';
  momentum?: number | null;
}): StrategyResult {
  let score = 0;
  let factors = 0;
  const reasons: string[] = [];

  // RSI scoring (higher weight for longer timeframes)
  const rsiScore = (rsi: number | null, weight: number, tf: string) => {
    if (rsi === null) return;
    factors += weight;
    if (rsi <= 20) { score += 100 * weight; reasons.push(`RSI ${tf} deep oversold`); }
    else if (rsi <= 30) { score += 70 * weight; if (weight >= 1) reasons.push(`RSI ${tf} oversold`); }
    else if (rsi <= 40) score += 30 * weight;
    else if (rsi <= 60) score += 0;
    else if (rsi <= 70) score -= 30 * weight;
    else if (rsi <= 80) { score -= 70 * weight; if (weight >= 1) reasons.push(`RSI ${tf} overbought`); }
    else { score -= 100 * weight; reasons.push(`RSI ${tf} deep overbought`); }
  };

  rsiScore(params.rsi1m, 0.5, '1m');
  rsiScore(params.rsi5m, 1, '5m');
  rsiScore(params.rsi15m, 1.5, '15m');
  rsiScore(params.rsi1h, 2, '1h');

  // MACD histogram (normalized as % of price for fair cross-asset comparison)
  if (params.macdHistogram !== null && params.price > 0) {
    factors += 1.5;
    const hPct = (params.macdHistogram / params.price) * 100;
    if (hPct > 0) {
      score += Math.min(hPct * 200, 100) * 1.5;
      if (hPct * 200 > 40) reasons.push('MACD bullish');
    } else {
      score += Math.max(hPct * 200, -100) * 1.5;
      if (hPct * 200 < -40) reasons.push('MACD bearish');
    }
  }

  // Bollinger position
  if (params.bbPosition !== null) {
    factors += 1;
    const bp = params.bbPosition;
    if (bp <= 0.1) { score += 80 * 1; reasons.push('Near lower BB'); }
    else if (bp <= 0.25) score += 40 * 1;
    else if (bp >= 0.9) { score -= 80 * 1; reasons.push('Near upper BB'); }
    else if (bp >= 0.75) score -= 40 * 1;
  }

  // Stochastic RSI
  if (params.stochK !== null && params.stochD !== null) {
    factors += 1;
    if (params.stochK < 20 && params.stochD < 20) { score += 80 * 1; reasons.push('StochRSI oversold'); }
    else if (params.stochK < 30) score += 40 * 1;
    else if (params.stochK > 80 && params.stochD > 80) { score -= 80 * 1; reasons.push('StochRSI overbought'); }
    else if (params.stochK > 70) score -= 40 * 1;
    // K crossing above D = bullish
    if (params.stochK > params.stochD && params.stochK < 50) score += 20;
    else if (params.stochK < params.stochD && params.stochK > 50) score -= 20;
  }

  // EMA cross
  if (params.emaCross !== 'none') {
    factors += 1.5;
    score += (params.emaCross === 'bullish' ? 60 : -60) * 1.5;
    reasons.push(params.emaCross === 'bullish' ? 'Bullish EMA cross' : 'Bearish EMA cross');
  }

  // VWAP
  if (params.vwapDiff !== null) {
    factors += 0.5;
    if (params.vwapDiff < -2) { score += 40 * 0.5; if (params.vwapDiff < -3) reasons.push('Below VWAP'); }
    else if (params.vwapDiff > 2) { score -= 40 * 0.5; if (params.vwapDiff > 3) reasons.push('Above VWAP'); }
  }

  // Volume spike amplifies the signal
  if (params.volumeSpike && factors > 0) {
    score *= 1.15;
    reasons.push('Volume spike');
  }

  // ── Intelligence signals ──

  // Multi-TF confluence (strong when indicators and timeframes agree)
  if (params.confluence !== undefined && Math.abs(params.confluence) >= 20) {
    factors += 2;
    score += params.confluence * 2;
    if (params.confluence >= 50) reasons.push('Strong multi-TF bullish');
    else if (params.confluence >= 20) reasons.push('Multi-TF bullish');
    else if (params.confluence <= -50) reasons.push('Strong multi-TF bearish');
    else if (params.confluence <= -20) reasons.push('Multi-TF bearish');
  }

  // RSI divergence (powerful reversal signal)
  if (params.rsiDivergence && params.rsiDivergence !== 'none') {
    factors += 1.5;
    if (params.rsiDivergence === 'bullish') {
      score += 70 * 1.5;
      reasons.push('Bullish divergence');
    } else {
      score -= 70 * 1.5;
      reasons.push('Bearish divergence');
    }
  }

  // Momentum (ROC)
  if (params.momentum !== undefined && params.momentum !== null && Math.abs(params.momentum) > 0.5) {
    factors += 0.5;
    const mScore = Math.max(-60, Math.min(60, params.momentum * 15));
    score += mScore * 0.5;
    if (params.momentum > 2) reasons.push('Strong upward momentum');
    else if (params.momentum < -2) reasons.push('Strong downward momentum');
  }

  // Final validation guard: if we have fewer than 3 significant factors, 
  // do not issue a Strong signal. This prevents "lucky" single-indicator signals.
  let normalized = factors > 0 ? score / factors : 0;
  if (factors < 3 && Math.abs(normalized) > 50) {
    normalized = normalized * 0.7; // Dampen low-confidence signals
  }
  normalized = Number.isFinite(normalized) ? Math.round(Math.max(-100, Math.min(100, normalized))) : 0;

  let signal: StrategySignal;
  let label: string;
  if (normalized >= 50) { signal = 'strong-buy'; label = 'Strong Buy'; }
  else if (normalized >= 20) { signal = 'buy'; label = 'Buy'; }
  else if (normalized <= -50) { signal = 'strong-sell'; label = 'Strong Sell'; }
  else if (normalized <= -20) { signal = 'sell'; label = 'Sell'; }
  else { signal = 'neutral'; label = 'Neutral'; }

  return { score: normalized, signal, label, reasons };
}

// ── Utility ─────────────────────────────────────────────────────

function round(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}
