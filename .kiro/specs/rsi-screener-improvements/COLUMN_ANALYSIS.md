# Screener Column Analysis - Missing Data Root Cause

## Screenshot Analysis

From the provided screenshot, I can identify the following columns and their data status:

### Columns Showing Data ✅
1. **Rank (#)** - Working (shows 75.7, 29.5, 16.5, etc.)
2. **Symbol** - Working (BTC, ETH, SOL, NDAQ, XRP, TBSE, DOGE, ZEC, AAVE, HBAR, TRX)
3. **Price** - Working (shows prices like $94,788.30, $2,298.38, etc.)
4. **24h Change** - Working (shows percentages like +0.28%, +1.17%, etc.)
5. **Volume** - Working (shows volumes)
6. **RSI 15m** - Working (shows values like 48.3, 19.3, 48.2, etc.)
7. **Strategy** - Working (shows "NEUTRAL" badges)

### Columns Showing Dashes (-) ❌
1. **RSI 1m** - Shows dashes for all rows
2. **RSI 5m** - Shows dashes for all rows  
3. **RSI 1h** - Shows dashes for all rows
4. **EMA 9** - Shows dashes for all rows
5. **EMA 21** - Shows dashes for all rows
6. **Trend (EMA Cross)** - Shows "NONE" for all rows
7. **MACD** - Shows dashes for all rows
8. **BB Upper** - Shows dashes for all rows
9. **BB Lower** - Shows dashes for all rows
10. **BB Position** - Shows dashes for all rows
11. **Stoch RSI** - Shows dashes for all rows
12. **Confluence** - Shows dashes for all rows
13. **Divergence** - Shows dashes for all rows
14. **VWAP %** - Shows dashes for all rows
15. **Long Candle** - Shows dashes for all rows
16. **Volume Spike** - Shows dashes for all rows
17. **Momentum** - Shows dashes for all rows
18. **ATR** - Shows dashes for all rows
19. **ADX** - Shows dashes for all rows
20. **Funding Rate** - Shows dashes for all rows
21. **Order Flow** - Shows dashes for all rows
22. **Smart Money** - Shows dashes for all rows

## Root Cause Analysis

### Issue 1: Insufficient Kline Data (CRITICAL)
**Location**: `lib/screener-service.ts` line 1057-1063

```typescript
const klineCountThreshold = 50; 
if (validKlines.length < klineCountThreshold) {
  if (validKlines.length > 0 && ticker) {
    return buildTickerOnlyEntry(sym, ticker, nowTs);
  }
  return null;
}
```

**Problem**: When kline count is below 50, the system returns a "ticker-only" entry which has ALL indicators set to `null`. This is why we see dashes everywhere.

**Why This Happens**:
1. Cold start - cache is empty
2. API rate limiting - not enough klines fetched
3. Geo-blocking - API returns empty arrays
4. Network timeouts - kline fetches fail

### Issue 2: Aggregation Insufficient Data
**Location**: `lib/screener-service.ts` line 1080-1082

```typescript
const agg5m = aggregateKlines(validKlines, 5, aggCache);
const closes5m = agg5m.map((c) => c.close);
const rsi5m = closes5m.length >= r5mP + 1 ? calculateRsi(closes5m, r5mP) : null;
```

**Problem**: Even with 50 klines (50 minutes of 1m data), we only get:
- **5m aggregation**: 50 / 5 = 10 candles (need 15 for RSI 14)
- **15m aggregation**: 50 / 15 = 3 candles (need 15 for RSI 14)
- **1h aggregation**: 50 / 60 = 0 candles (need 15 for RSI 14)

**This explains why**:
- RSI 1m works (50 candles available)
- RSI 5m shows dashes (only 10 candles, need 15)
- RSI 15m works sometimes (3 candles, but threshold is low)
- RSI 1h shows dashes (0 candles)

### Issue 3: EMA/MACD/BB Calculations Require 15m Data
**Location**: `lib/screener-service.ts` line 1113-1115

```typescript
const ema9Val = latestEma(closes15m, 9);
const ema21Val = latestEma(closes15m, 21);
const emaCross = detectEmaCross(closes15m, 9, 21);
```

**Problem**: All these indicators use `closes15m` which only has 3 candles with 50 minutes of data. They need at least 21+ candles for accurate EMA 21.

### Issue 4: Volatility Indicators Missing Real-Time Data
**Location**: `components/screener-dashboard.tsx` line 883-897

```typescript
const hasData = globalVolatilityEnabled && display.curCandleSize != null && display.avgBarSize1m && display.avgBarSize1m > 0;
```

**Problem**: `curCandleSize` and `curCandleVol` are set to `null` in buildEntry (line 1280), so volatility indicators never show data.

### Issue 5: Derivatives Data Not Integrated
**Location**: `components/screener-dashboard.tsx` line 947-987

The Funding Rate, Order Flow, and Smart Money columns expect data from the derivatives API, but this data is fetched separately and may not be available for all symbols.

## Minimum Data Requirements

To show ALL indicators, we need:

| Indicator | Timeframe | Min Candles | Min 1m Klines |
|-----------|-----------|-------------|---------------|
| RSI 1m | 1m | 15 | 15 |
| RSI 5m | 5m | 15 | 75 |
| RSI 15m | 15m | 15 | 225 |
| RSI 1h | 1h | 15 | 900 |
| EMA 9 | 15m | 10 | 150 |
| EMA 21 | 15m | 22 | 330 |
| MACD | 15m | 35 | 525 |
| Bollinger | 15m | 20 | 300 |
| Stoch RSI | 15m | 14 | 210 |
| ATR | 15m | 14 | 210 |
| ADX | 15m | 14 | 210 |

**Current Threshold**: 50 klines
**Recommended Threshold**: 
- **Minimum**: 225 klines (for RSI 15m + basic indicators)
- **Optimal**: 525 klines (for all indicators including MACD)
- **Full Coverage**: 900 klines (for 1h RSI)

## Current Kline Fetch Limits

```typescript
const KLINE_LIMIT = 1000; // 1000 candles for 1m
const KLINE_LIMIT_1H = 200; // 200 candles for 1h
```

**Good News**: The system is configured to fetch 1000 1m candles, which is MORE than enough for all indicators!

## Why Are We Still Seeing Dashes?

### Hypothesis 1: Kline Fetch Failures
The kline fetches are failing due to:
1. **Geo-blocking** - Binance API returns 451 errors
2. **Rate limiting** - Too many concurrent requests
3. **Network timeouts** - 8s timeout is too short for 100+ symbols
4. **Invalid symbols** - Some symbols don't have kline data

### Hypothesis 2: Cache Warming Issue
The system is returning cached "ticker-only" entries before klines are fetched:

```typescript
const cached = indicatorCache.get(getCacheKey(sym));
if (cached) {
  entries.push(withTickerOverlay(cached.entry, ticker, nowTs));
  continue;
}
```

If the cache contains ticker-only entries (with null indicators), they will be served immediately.

### Hypothesis 3: Insufficient Kline Data in Response
Even though we request 1000 klines, the API might be returning fewer:
- Yahoo Finance symbols might have limited data
- New/delisted symbols might have gaps
- API might be throttling response size

## Verification Steps

To diagnose the exact issue, we need to:

1. **Check actual kline counts** - Add logging to see how many klines are actually returned
2. **Check aggregation results** - Log the length of agg5m, agg15m, agg1h arrays
3. **Check indicator calculation** - Log which indicators are null and why
4. **Check cache state** - Verify if cached entries have indicators or are ticker-only

## Recommended Fixes

### Fix 1: Lower Kline Threshold for Partial Indicators
```typescript
// Instead of all-or-nothing, show what we can
const klineCountThreshold = 15; // Show RSI 1m immediately
```

### Fix 2: Progressive Indicator Display
```typescript
// Calculate indicators based on available data
if (closes1m.length >= 15) rsi1m = calculateRsi(closes1m, r1mP);
if (closes5m.length >= 15) rsi5m = calculateRsi(closes5m, r5mP);
if (closes15m.length >= 15) rsi15m = calculateRsi(closes15m, r15mP);
// Don't wait for all indicators to be ready
```

### Fix 3: Add Real-Time Candle Data
```typescript
// In buildEntry, calculate current candle metrics
const lastKline1m = validKlines[validKlines.length - 1];
const open1m = lastKline1m ? parseFloat(lastKline1m[1]) : null;
const close1m = lastKline1m ? parseFloat(lastKline1m[4]) : null;
const high1m = lastKline1m ? parseFloat(lastKline1m[2]) : null;
const low1m = lastKline1m ? parseFloat(lastKline1m[3]) : null;
const volStart1m = lastKline1m ? parseFloat(lastKline1m[5]) : null;

// Calculate current candle size
const curCandleSize = (high1m && low1m) ? Math.abs(high1m - low1m) : null;
const curCandleVol = volStart1m;
```

### Fix 4: Better Error Logging
```typescript
if (validKlines.length < klineCountThreshold) {
  console.warn(`[screener] ${sym}: Insufficient klines (${validKlines.length}/${klineCountThreshold}), returning ticker-only`);
  // ... rest of code
}
```

### Fix 5: Separate 1h Kline Fetch
The system already fetches 1h klines separately, but we need to ensure they're being used:

```typescript
// In fetchAllKlinesBatched, ensure both 1m and 1h are fetched
const [res1m, res1h] = await Promise.allSettled([
  fetchKlines(sym, exchange, signal),
  fetchKlines1h(sym, exchange, signal)
]);
```

## Next Steps

1. Add comprehensive logging to identify exact failure points
2. Implement progressive indicator display
3. Fix current candle calculations
4. Verify kline fetch success rates
5. Test with different symbol counts (100, 200, 500)
