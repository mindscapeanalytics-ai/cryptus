# Column Data Root Cause Analysis

## Executive Summary

After deep analysis of the codebase, I've identified the root causes for why columns are showing no data (dashes) despite previous fixes. The issue is multi-layered and requires systematic debugging.

## Current State

### What's Working ✅
- Kline fetching: 1000 1m candles + 200 1h candles
- aggregateKlines function: Correctly creates 5m, 15m, 1h candles
- buildEntry function: Has proper logic for all indicators
- Logging infrastructure: Comprehensive console.log statements added

### What's NOT Working ❌
- Columns still showing dashes (-) for most indicators
- No visible errors in the logs (need to check actual server logs)
- Data is not flowing through to the UI

## Root Cause Hypotheses

### Hypothesis #1: Kline Fetch is Failing Silently (MOST LIKELY)
**Evidence:**
- The code has proper error handling that returns empty arrays on failure
- Geo-blocking or API rate limits could be causing silent failures
- The `fetchWithRetry` function might be exhausting retries

**Verification:**
```bash
# Check server logs for these patterns:
- "[screener] ${sym}: Insufficient klines"
- "[screener] ${sym}: kline fetch returned empty array"
- "[kline] Both 1m and 1h failed for ${sym}"
- "Rate limit critical"
```

**Fix if confirmed:**
- Enable SCREENER_DEBUG=1 in .env to see all debug logs
- Check if Binance API is accessible from your region
- Verify API weight tracking isn't blocking requests
- Consider using VPN if geo-blocked

### Hypothesis #2: aggregateKlines Not Producing Enough Candles
**Evidence:**
- 1000 1m candles should produce:
  - 200 5m candles (1000 / 5)
  - 66 15m candles (1000 / 15)
  - 16 1h candles (1000 / 60)
- RSI needs period + 1 candles minimum
- For RSI(14): need 15 candles minimum

**Current Requirements:**
```typescript
const r1mP = config?.rsi1mPeriod ?? 14;  // needs 15 1m candles
const r5mP = config?.rsi5mPeriod ?? 14;  // needs 15 5m candles
const r15mP = config?.rsi15mPeriod ?? 14; // needs 15 15m candles
const r1hP = config?.rsi1hPeriod ?? 14;  // needs 15 1h candles
```

**Math Check:**
- 1m RSI: ✅ 1000 candles available, need 15
- 5m RSI: ✅ 200 candles available, need 15
- 15m RSI: ✅ 66 candles available, need 15
- 1h RSI: ✅ 16 candles available (from aggregation) OR 200 (from direct fetch), need 15

**Conclusion:** Math checks out - should have enough candles

### Hypothesis #3: Indicator Calculation Functions Have Bugs
**Evidence:**
- calculateRsi uses calculateRsiSeries which has complex Wilder smoothing
- Other indicators (EMA, MACD, BB, Stoch) have similar complexity
- A bug in any of these would cause null returns

**Verification Needed:**
- Test indicator functions with sample data
- Check if calculateRsiSeries is returning empty arrays

### Hypothesis #4: klineCountThreshold is Too High
**Current Value:** 50 candles minimum

**Analysis:**
```typescript
if (validKlines.length < klineCountThreshold) {
  console.warn(`[screener] ${sym}: Insufficient klines...`);
  return buildTickerOnlyEntry(sym, ticker, nowTs);
}
```

If klines < 50, it returns ticker-only entry (all indicators null).

**Possible Issue:**
- If kline fetch is returning < 50 candles, all indicators will be null
- This would explain why ALL columns show dashes

### Hypothesis #5: Cache is Serving Stale Ticker-Only Entries
**Evidence:**
- indicatorCache might have old ticker-only entries
- These get served instead of recalculating with fresh klines
- Cache TTL might be too long

**Verification:**
```bash
# Check logs for:
- "Using cached entry" messages
- "ticker-only entry" messages
```

## Diagnostic Plan

### Step 1: Enable Debug Logging
```bash
# Add to .env or .env.local
SCREENER_DEBUG=1
```

### Step 2: Check Server Logs
Start the dev server and watch for:
```bash
npm run dev

# Look for these patterns:
1. "[screener] ${sym}: Fetched X 1m klines, Y 1h klines"
2. "[screener] ${sym}: Processing X valid klines"
3. "[screener] ${sym}: 5m aggregation: X candles"
4. "[screener] ${sym}: 15m aggregation: X candles"
5. "[screener] ${sym}: Successfully built entry with indicators"
```

### Step 3: Test Direct API Access
```bash
# Test if Binance API is accessible
curl "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=1000"

# Should return 1000 candles
# If it returns empty array or error, you're geo-blocked
```

### Step 4: Test Screener API
```bash
# Test the screener endpoint
curl "http://localhost:3000/api/screener?exchange=binance&limit=10"

# Check the response:
# - Are there entries?
# - Do entries have rsi1m, rsi5m, rsi15m values?
# - Or are they all null?
```

### Step 5: Clear All Caches
```typescript
// Add this to force fresh data:
// In lib/screener-service.ts, temporarily add at the top of runRefresh:
indicatorCache.clear();
resultCache.clear();
```

## Recommended Fixes

### Fix #1: Lower klineCountThreshold (Quick Win)
```typescript
// In buildEntry function, change:
const klineCountThreshold = 50;
// To:
const klineCountThreshold = 20; // Allow partial indicators to show
```

**Rationale:**
- 20 candles is enough for RSI(14) on 1m timeframe
- Will allow progressive indicator display
- Better UX than showing all dashes

### Fix #2: Add Detailed Logging at Critical Points
```typescript
// In buildEntry, after aggregation:
console.log(`[screener] ${sym}: Aggregation results:`, {
  klines1m: validKlines.length,
  candles5m: agg5m.length,
  candles15m: agg15m.length,
  candles1h: closes1h.length,
  rsi1m,
  rsi5m,
  rsi15m,
  rsi1h,
});
```

### Fix #3: Add Fallback for Partial Data
```typescript
// Instead of returning null for all indicators, return partial data:
// If we have 1m data but not 15m, show 1m indicators
// This provides better UX than all dashes
```

### Fix #4: Add UI Indicator for Data Quality
```typescript
// Add to ScreenerEntry type:
interface ScreenerEntry {
  // ... existing fields
  dataQuality: 'full' | 'partial' | 'ticker-only';
  availableTimeframes: string[]; // ['1m', '5m'] etc
}
```

## Testing Strategy

### Test 1: Verify Kline Fetch
```typescript
// Create test-kline-fetch.ts
import { fetchKlines } from './lib/screener-service';

async function test() {
  const klines = await fetchKlines('BTCUSDT', 'binance');
  console.log(`Fetched ${klines.length} klines`);
  console.log('First:', klines[0]);
  console.log('Last:', klines[klines.length - 1]);
}

test();
```

### Test 2: Verify Aggregation
```typescript
// Test aggregateKlines with sample data
const sample1m = [...]; // 1000 sample klines
const agg5m = aggregateKlines(sample1m, 5);
const agg15m = aggregateKlines(sample1m, 15);
console.log(`5m: ${agg5m.length}, 15m: ${agg15m.length}`);
```

### Test 3: Verify Indicator Calculation
```typescript
// Test calculateRsi with sample closes
const closes = [100, 102, 101, 103, 105, 104, 106, 108, 107, 109, 111, 110, 112, 114, 113];
const rsi = calculateRsi(closes, 14);
console.log(`RSI: ${rsi}`); // Should be a number, not null
```

## Next Steps

1. **IMMEDIATE**: Enable SCREENER_DEBUG=1 and check server logs
2. **IMMEDIATE**: Test Binance API accessibility from your location
3. **SHORT-TERM**: Lower klineCountThreshold to 20
4. **SHORT-TERM**: Add detailed logging at aggregation points
5. **MEDIUM-TERM**: Implement progressive indicator display
6. **LONG-TERM**: Add data quality indicators to UI

## Expected Outcomes

After implementing these fixes:
- ✅ Columns should show data even with partial kline availability
- ✅ Clear logging will identify exact failure points
- ✅ Better UX with progressive data display
- ✅ Institutional-grade robustness with graceful degradation

## Risk Assessment

**Low Risk Fixes:**
- Lowering klineCountThreshold ✅
- Adding more logging ✅
- Enabling SCREENER_DEBUG ✅

**Medium Risk Fixes:**
- Changing aggregation logic ⚠️
- Modifying indicator calculations ⚠️

**High Risk Fixes:**
- Changing cache TTL logic ⚠️⚠️
- Modifying API retry logic ⚠️⚠️

## Conclusion

The most likely root cause is that kline fetches are failing silently due to:
1. Geo-blocking
2. Rate limiting
3. Network issues
4. API unavailability

The fix is to:
1. Enable debug logging to confirm
2. Lower klineCountThreshold to show partial data
3. Add better error visibility
4. Implement graceful degradation

This will transform the system from "all or nothing" to "progressive enhancement" - a much better UX for a SaaS product.
