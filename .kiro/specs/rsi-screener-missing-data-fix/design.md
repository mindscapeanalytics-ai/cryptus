# RSI Screener Missing Data Fix - Technical Design

## Overview

This design addresses the screener data flow issue where many indicator columns display "-" (NO DATA) in the UI despite logs showing kline data is being fetched successfully. The bug has a **critical primary root cause** and several secondary issues:

**PRIMARY ROOT CAUSE (CRITICAL)**: Variable scope error in MACD calculation where `ema12` and `ema26` are declared with `const` inside if/else blocks (lines 1199, 1224, 1249) but accessed in the return statement outside those blocks (lines 1485-1486). This causes a `ReferenceError` that triggers the catch block and returns null, explaining why buildEntry logs "✅ Entry built successfully" but then "buildEntry returned null".

**SECONDARY ISSUES**: Insufficient fallback mechanisms for VWAP (UTC day anchor brittleness), ADX/MACD/Stochastic RSI (rigid 15m timeframe without cascading to 5m/1m), and lack of diagnostic logging.

The fix implements:
1. **Critical Scope Fix**: Declare `ema12` and `ema26` at function scope (not block scope) so they're accessible in the return statement
2. **Multi-tier Fallback Strategy**: Each indicator attempts calculation on progressively lower timeframes (15m → 5m → 1m) until sufficient data is available
3. **Enhanced Diagnostic Logging**: Log fallback attempts, timeframes used, and indicator coverage percentages

**Impact**: The scope fix alone will likely resolve 80%+ of "buildEntry returned null" errors. Combined with fallback improvements, indicator coverage should reach 90%+ with graceful degradation.

## Glossary

- **Bug_Condition (C)**: The condition that triggers missing data - when indicator calculations return null due to insufficient candles after timeframe aggregation
- **Property (P)**: The desired behavior - indicators should calculate successfully using multi-tier fallback mechanisms whenever sufficient raw kline data exists
- **Preservation**: Existing indicator calculation logic, caching behavior, and UI display that must remain unchanged by the fix
- **buildEntry**: The function in `lib/screener-service.ts` (lines 1050-1450) that processes klines and calculates all indicators for a single symbol
- **aggregateKlines**: Helper function that converts 1m klines into higher timeframe candles (5m, 15m, 60m)
- **Timeframe Fallback**: Strategy of attempting indicator calculation on progressively lower timeframes (15m → 5m → 1m) until sufficient data exists
- **Indicator Cache**: LRU cache storing calculated indicators with 15s TTL (10s for alert-active symbols)
- **Ticker-Only Entry**: Fallback entry containing only price/volume data when indicator calculation fails completely
- **Syncing State**: UI state ("...") indicating indicators are being calculated but not yet available

## Bug Details

### Bug Condition

The bug manifests when indicator calculations return null despite having adequate raw kline data. This occurs because:

1. **VWAP** anchors to UTC day start, which may have <10 minutes of data early in the day
2. **ADX/MACD/Stochastic RSI** require 14/35/50 candles respectively, but 15m aggregation from 1000 1m klines produces only ~66 candles
3. **Forex/low-volatility assets** produce fewer aggregated candles due to market hours and data gaps
4. **buildEntry** has no fallback logic - if 15m aggregation fails, the indicator returns null instead of trying 5m or 1m data

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { symbol: string, klines1m: BinanceKline[], indicator: string }
  OUTPUT: boolean
  
  RETURN (input.klines1m.length >= 20)  // Sufficient raw data exists
         AND (
           // VWAP: UTC day anchor has <10 minutes AND 4h fallback also insufficient
           (input.indicator == 'VWAP' AND utcDayCandles(input.klines1m) < 10 AND fourHourCandles(input.klines1m) < 10)
           
           // ADX: 15m aggregation produces <14 candles
           OR (input.indicator == 'ADX' AND aggregate15m(input.klines1m).length < 14)
           
           // MACD: 15m aggregation produces <35 candles (26 slow + 9 signal)
           OR (input.indicator == 'MACD' AND aggregate15m(input.klines1m).length < 35)
           
           // Stochastic RSI: 15m aggregation produces <50 candles
           OR (input.indicator == 'StochRSI' AND aggregate15m(input.klines1m).length < 50)
           
           // buildEntry: Some indicators null despite adequate klines
           OR (input.indicator == 'buildEntry' AND hasNullIndicators(buildEntry(input)) AND input.klines1m.length >= 100)
           
           // Forex/Low-volatility: Multiple indicators null due to aggregation gaps
           OR (isForexOrLowVolatility(input.symbol) AND multipleIndicatorsNull(buildEntry(input)))
           
           // UI State: No distinction between "syncing" and "no data"
           OR (indicatorCalculating(input) AND uiDisplays(input) == "-")
         )
         AND NOT indicatorDisplaysValue(input)  // Indicator shows "-" instead of value
END FUNCTION
```

### Examples

**Example 1: VWAP Early UTC Day**
- **Input**: BTCUSDT at 00:05 UTC with 1000 1m klines
- **Current Behavior**: VWAP returns null because UTC day start (00:00) has only 5 candles
- **Expected Behavior**: VWAP falls back to 4-hour rolling window (240 candles), calculates successfully
- **UI Impact**: Column shows "-" → shows "$67,234.56"

**Example 2: ADX on Forex Symbol**
- **Input**: EURUSDT with 1000 1m klines, 15m aggregation produces 12 candles (market hours gaps)
- **Current Behavior**: ADX returns null (needs 14 candles)
- **Expected Behavior**: ADX falls back to 5m aggregation (40 candles), calculates successfully
- **UI Impact**: Column shows "-" → shows "23.4"

**Example 3: MACD on Low-Volatility Asset**
- **Input**: PAXGUSDT (gold) with 1000 1m klines, 15m aggregation produces 30 candles
- **Current Behavior**: MACD returns null (needs 35 candles for signal line)
- **Expected Behavior**: MACD falls back to 5m aggregation (100 candles), calculates successfully
- **UI Impact**: Histogram column shows "-" → shows "+0.0023"

**Example 4: Stochastic RSI on New Symbol**
- **Input**: Newly listed token with 1000 1m klines, 15m aggregation produces 45 candles
- **Current Behavior**: Stochastic RSI returns null (needs 50 candles)
- **Expected Behavior**: Falls back to 5m (150 candles) or 1m (1000 candles), calculates successfully
- **UI Impact**: Stoch K/D columns show "-" → show "45.2 / 38.7"

**Example 5: buildEntry Partial Failure**
- **Input**: Symbol with 1000 klines where VWAP/ADX/MACD all return null
- **Current Behavior**: buildEntry logs "returned null despite having 1000 klines", may return null or ticker-only entry
- **Expected Behavior**: buildEntry returns entry with successfully calculated indicators (RSI, EMA, BB) and null for failed ones
- **UI Impact**: Entire row shows ticker-only → shows partial indicators with some "-" for unavailable ones

**Example 6: Syncing State Ambiguity**
- **Input**: Symbol being calculated for first time, indicators not yet available
- **Current Behavior**: UI shows "-" (same as permanent "no data")
- **Expected Behavior**: UI shows "..." (syncing state) to indicate calculation in progress
- **UI Impact**: User sees "-" → sees "..." → sees calculated value

**Example 7: Multi-Indicator Failure on Forex**
- **Input**: GBPUSDT with 1000 1m klines during London session
- **Current Behavior**: VWAP, ADX, MACD, Stoch RSI all return null due to 15m aggregation gaps
- **Expected Behavior**: All indicators fall back to 5m or 1m, calculate successfully
- **UI Impact**: 4+ columns show "-" → all show calculated values

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Indicator calculation algorithms (RSI, EMA, MACD, Bollinger Bands, etc.) must produce identical results when given the same input data
- Indicator cache TTL settings (15s standard, 10s alert-active) must remain unchanged
- Symbol prioritization logic (viewport, search, top 100) must remain unchanged
- Ticker overlay behavior (price, change24h, volume24h updates) must remain unchanged
- buildEntry data sufficiency guard (minimum 20 klines) must remain unchanged
- Kline validation and filtering logic must remain unchanged
- Strategy score computation must remain unchanged
- Signal derivation (oversold/overbought/neutral) must remain unchanged
- Real-time price shadowing and approximation logic must remain unchanged
- Baseline cache (avgBarSize1m, avgVolume1m) must remain unchanged

**Scope:**
All inputs that do NOT involve insufficient aggregated candles should be completely unaffected by this fix. This includes:
- Symbols with sufficient 15m aggregated data (no fallback needed)
- Indicators that already have adequate data on preferred timeframe
- Ticker-only entries when klines are genuinely insufficient (<20 candles)
- Cache hit scenarios where indicators are already calculated
- UI rendering of successfully calculated indicators

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

### PRIMARY ROOT CAUSE (CRITICAL BUG)

**1. Variable Scope Error in MACD Calculation (Lines 1199, 1224, 1249, 1485-1486)**

The `ema12` and `ema26` variables are declared with `const` inside if/else blocks for MACD calculation:
- Line 1199: `const ema12 = ...` (inside `if (closes15m.length >= 35)` block)
- Line 1224: `const ema12 = ...` (inside `else if (closes5m.length >= 35)` block)  
- Line 1249: `const ema12 = ...` (inside `else if (closes1m.length >= 35)` block)

These variables are then accessed in the return statement (lines 1485-1486):
```typescript
macdFastState: ema12 !== null ? { ema: ema12 } : null,
macdSlowState: ema26 !== null ? { ema: ema26 } : null,
```

**Impact**: Since `ema12` and `ema26` are block-scoped, they are **undefined** outside the if/else blocks. When the return statement tries to access them, it throws a `ReferenceError`, which triggers the catch block (line 1500) and returns null. This explains why:
- The entry logs "✅ Entry built successfully" (the console.log at line 1470 executes before the return)
- But then "buildEntry returned null" (the return statement throws ReferenceError → catch → return null)

**This is the PRIMARY bug causing buildEntry to return null despite having adequate kline data.**

### SECONDARY ROOT CAUSES

2. **VWAP UTC Day Anchor Brittleness**: VWAP anchors to UTC day start (00:00), which has minimal data early in the day. The existing 4-hour fallback (lines 1340-1345) is insufficient because it only triggers when UTC day has <10 minutes, but doesn't cascade to 2h/1h/all-data fallbacks.

3. **Insufficient Candle Thresholds**: Indicators require specific minimum candles (ADX: 14, MACD: 35, Stoch RSI: 50), but the code doesn't verify aggregated candle counts before attempting calculation. When aggregation produces fewer candles than required, calculations fail silently.

4. **No Diagnostic Logging**: When indicators return null, there's no logging of the attempted timeframe, candles available, or candles required. This makes debugging and monitoring difficult.

5. **UI State Ambiguity**: The UI displays "-" for both "syncing" (calculation in progress) and "no data available" (permanent failure), causing user confusion about whether data will appear.

6. **Forex/Low-Volatility Asset Gaps**: Forex and metal symbols have market hours gaps and lower volatility, producing fewer aggregated candles. The code doesn't account for these asset-specific characteristics.

## Correctness Properties

Property 1: Bug Condition - Multi-Tier Fallback Ensures Indicator Calculation

_For any_ symbol where raw kline data is sufficient (≥20 candles) but indicator calculation fails on the preferred timeframe (15m), the fixed buildEntry function SHALL attempt calculation on progressively lower timeframes (5m, then 1m) until sufficient aggregated candles exist, ensuring indicators display calculated values instead of "-" whenever mathematically possible.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation - Existing Calculation Logic Unchanged

_For any_ symbol where the preferred timeframe (15m) produces sufficient aggregated candles for indicator calculation, the fixed buildEntry function SHALL produce exactly the same indicator values as the original function, preserving calculation accuracy and algorithm behavior.

**Validates: Requirements 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, the fix requires modifications to `lib/screener-service.ts`:

**File**: `lib/screener-service.ts`

**Function**: `buildEntry` (lines 1050-1450)

**Specific Changes**:

**CRITICAL FIX #1: Fix Variable Scope Error in MACD Calculation (Lines 1190-1270)**

This is the PRIMARY bug causing buildEntry to return null. The `ema12` and `ema26` variables must be declared at function scope, not block scope.

```typescript
// Current (BROKEN - lines 1190-1270)
let macdLineVal: number | null = null;
let macdSignalVal: number | null = null;
let macdHistogramVal: number | null = null;
let macdSignalState: { ema: number } | null = null;

// Try 15m first (preferred for accuracy)
if (closes15m.length >= 35) {
  const ema12Arr = calculateEma(closes15m, 12);
  const ema26Arr = calculateEma(closes15m, 26);
  const ema12 = ema12Arr.length > 0 ? ema12Arr[ema12Arr.length - 1] : null;  // ❌ Block-scoped
  const ema26 = ema26Arr.length > 0 ? ema26Arr[ema26Arr.length - 1] : null;  // ❌ Block-scoped
  // ... calculation logic
}
// ... similar blocks for 5m and 1m

// Later in return statement (lines 1485-1486)
macdFastState: ema12 !== null ? { ema: ema12 } : null,  // ❌ ReferenceError: ema12 is not defined
macdSlowState: ema26 !== null ? { ema: ema26 } : null,  // ❌ ReferenceError: ema26 is not defined

// FIXED (declare at function scope)
let macdLineVal: number | null = null;
let macdSignalVal: number | null = null;
let macdHistogramVal: number | null = null;
let macdSignalState: { ema: number } | null = null;
let ema12: number | null = null;  // ✅ Function-scoped
let ema26: number | null = null;  // ✅ Function-scoped

// Try 15m first (preferred for accuracy)
if (closes15m.length >= 35) {
  const ema12Arr = calculateEma(closes15m, 12);
  const ema26Arr = calculateEma(closes15m, 26);
  ema12 = ema12Arr.length > 0 ? ema12Arr[ema12Arr.length - 1] : null;  // ✅ Assign to function-scoped variable
  ema26 = ema26Arr.length > 0 ? ema26Arr[ema26Arr.length - 1] : null;  // ✅ Assign to function-scoped variable
  // ... calculation logic
}
// ... similar blocks for 5m and 1m (also assign to ema12/ema26, not const)

// Later in return statement (lines 1485-1486)
macdFastState: ema12 !== null ? { ema: ema12 } : null,  // ✅ Works correctly
macdSlowState: ema26 !== null ? { ema: ema26 } : null,  // ✅ Works correctly
```

**Why This Fixes the Bug**: By declaring `ema12` and `ema26` at function scope (alongside `macdLineVal`, `macdSignalVal`, etc.), they remain accessible in the return statement. The if/else blocks now **assign** to these variables instead of declaring new block-scoped constants.

**Impact**: This single fix will likely resolve 80%+ of the "buildEntry returned null" errors, as the ReferenceError will no longer be thrown.

---

**CRITICAL FIX #2: Apply Same Pattern to Other Block-Scoped Variables**

Audit the entire `buildEntry` function for other variables that are:
1. Declared with `const` inside if/else blocks
2. Accessed in the return statement outside those blocks

**Potential candidates to check**:
- Any variables used in the return statement (lines 1475-1500)
- Variables declared inside aggregation fallback blocks (5m/1m fallbacks)
- Variables declared inside conditional indicator calculations

**Action**: Search for all variables in the return statement and verify they are function-scoped, not block-scoped.

---

1. **VWAP Multi-Tier Fallback** (lines 1340-1350):
   - Current: Single fallback from UTC day to 4-hour window
   - Fixed: Cascade through 4h → 2h → 1h → all available data
   - Add logging of fallback strategy used
   ```typescript
   // Current (lines 1340-1350)
   if (validKlines.length - vwapStart < 10 && validKlines.length >= 240) {
     vwapStart = validKlines.length - 240;
   } else if (validKlines.length - vwapStart < 10) {
     vwapStart = 0;
   }
   
   // Fixed
   let vwapWindow = 'UTC_DAY';
   if (validKlines.length - vwapStart < 10) {
     if (validKlines.length >= 240) {
       vwapStart = validKlines.length - 240;
       vwapWindow = '4H_ROLLING';
     } else if (validKlines.length >= 120) {
       vwapStart = validKlines.length - 120;
       vwapWindow = '2H_ROLLING';
     } else if (validKlines.length >= 60) {
       vwapStart = validKlines.length - 60;
       vwapWindow = '1H_ROLLING';
     } else {
       vwapStart = 0;
       vwapWindow = 'ALL_AVAILABLE';
     }
     debugLog(`[screener] ${sym}: VWAP fallback to ${vwapWindow} (${validKlines.length - vwapStart} candles)`);
   }
   ```

2. **ADX Timeframe Fallback** (lines 1420-1435):
   - Current: Single attempt on 15m aggregation, falls back to 5m/1m only if 15m has <14 candles
   - Fixed: Explicit fallback chain with diagnostic logging
   ```typescript
   // Current (lines 1420-1435)
   if (highs15m.length >= 14 && lows15m.length >= 14 && closes15m.length >= 14) {
     atr = calculateATR(highs15m, lows15m, closes15m);
     adx = calculateADX(highs15m, lows15m, closes15m);
     debugLog(`[screener] ${sym}: ATR/ADX from 15m data`);
   } else if (agg5m.length >= 14) {
     // ... fallback to 5m
   }
   
   // Fixed
   let adxTimeframe = '15m';
   if (highs15m.length >= 14 && lows15m.length >= 14 && closes15m.length >= 14) {
     atr = calculateATR(highs15m, lows15m, closes15m);
     adx = calculateADX(highs15m, lows15m, closes15m);
   } else if (agg5m.length >= 14) {
     adxTimeframe = '5m';
     const highs5m = agg5m.map((c) => c.high);
     const lows5m = agg5m.map((c) => c.low);
     atr = calculateATR(highs5m, lows5m, closes5m);
     adx = calculateADX(highs5m, lows5m, closes5m);
   } else if (highs1m.length >= 14 && lows1m.length >= 14 && closes1m.length >= 14) {
     adxTimeframe = '1m';
     atr = calculateATR(highs1m, lows1m, closes1m);
     adx = calculateADX(highs1m, lows1m, closes1m);
   } else {
     debugWarn(`[screener] ${sym}: Insufficient data for ATR/ADX (need 14 candles, have 1m:${closes1m.length}, 5m:${closes5m.length}, 15m:${closes15m.length})`);
   }
   if (atr !== null || adx !== null) {
     debugLog(`[screener] ${sym}: ATR/ADX from ${adxTimeframe} data (${adxTimeframe === '15m' ? closes15m.length : adxTimeframe === '5m' ? closes5m.length : closes1m.length} candles)`);
   }
   ```

3. **MACD Diagnostic Logging Enhancement** (lines 1280-1330):
   - Current: Attempts 15m, then 5m, then 1m, but no failure logging
   - Fixed: Add diagnostic logging when all timeframes fail
   ```typescript
   // Add after line 1270 (after all MACD fallback attempts)
   if (macdHistogramVal === null) {
     debugWarn(`[screener] ${sym}: MACD calculation failed on all timeframes (need 35 candles, have 1m:${closes1m.length}, 5m:${closes5m.length}, 15m:${closes15m.length})`);
   }
   ```

4. **Stochastic RSI Diagnostic Logging** (lines 1335-1350):
   - Current: Attempts 15m, then 5m, then 1m, but no failure logging
   - Fixed: Add diagnostic logging for failures
   ```typescript
   // Add after line 1350 (after all Stoch RSI fallback attempts)
   if (stochRsi === null) {
     debugWarn(`[screener] ${sym}: Stochastic RSI calculation failed on all timeframes (need 50 candles, have 1m:${closes1m.length}, 5m:${closes5m.length}, 15m:${closes15m.length})`);
   }
   ```

5. **buildEntry Partial Success Logic** (lines 1440-1450):
   - Current: Returns null if critical indicators fail (via catch block when ReferenceError occurs)
   - Fixed: With the scope fix (#1), buildEntry will no longer throw ReferenceError and will naturally return partial entries
   - Additional: Add indicator coverage logging for diagnostics
   ```typescript
   // Add before return statement (line 1470)
   const indicatorCoverage = {
     rsi: [rsi1m, rsi5m, rsi15m, rsi1h].filter(v => v !== null).length,
     ema: [ema9Val, ema21Val].filter(v => v !== null).length,
     macd: macdHistogramVal !== null ? 1 : 0,
     bb: bb !== null ? 1 : 0,
     stoch: stochRsi !== null ? 1 : 0,
     vwap: vwap !== null ? 1 : 0,
     atr: atr !== null ? 1 : 0,
     adx: adx !== null ? 1 : 0,
   };
   const totalIndicators = Object.values(indicatorCoverage).reduce((a, b) => a + b, 0);
   const maxIndicators = 4 + 2 + 1 + 1 + 1 + 1 + 1 + 1; // 12 total
   debugLog(`[screener] ${sym}: Indicator coverage: ${totalIndicators}/${maxIndicators} (${Math.round(totalIndicators/maxIndicators*100)}%)`);
   ```

6. **UI Syncing State Detection** (components/screener-dashboard.tsx):
   - Current: Displays "-" for both syncing and no-data states
   - Fixed: Display "..." for syncing, "-" for permanent no-data
   ```typescript
   // In IndicatorCell component (line ~150)
   const isSyncing = isSyncing && value === null;
   
   // In render (line ~170)
   {showSyncing ? '...' : formatted}
   ```

7. **Asset-Specific Handling**:
   - No code changes needed - existing fallback logic will naturally handle forex/low-volatility assets
   - Fallback to lower timeframes provides more candles for these assets

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate various insufficient-data scenarios and assert that indicators return null on UNFIXED code. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **CRITICAL: Variable Scope ReferenceError Test**: Call buildEntry with any valid kline data (100+ candles), verify it throws ReferenceError when accessing ema12/ema26 in return statement (will fail on unfixed code with "ReferenceError: ema12 is not defined")
2. **VWAP Early UTC Day Test**: Fetch BTCUSDT at 00:05 UTC, verify VWAP returns null (will fail on unfixed code)
3. **ADX Forex Insufficient Test**: Simulate EURUSDT with 12 15m candles, verify ADX returns null (will fail on unfixed code)
4. **MACD Low-Volatility Test**: Simulate PAXGUSDT with 30 15m candles, verify MACD returns null (will fail on unfixed code)
5. **Stochastic RSI New Symbol Test**: Simulate new token with 45 15m candles, verify Stoch RSI returns null (will fail on unfixed code)
6. **buildEntry Null Return Test**: Simulate symbol with valid klines, verify buildEntry returns null due to ReferenceError (will fail on unfixed code)
7. **Multi-Indicator Forex Test**: Simulate GBPUSDT with aggregation gaps, verify multiple indicators return null (will fail on unfixed code)

**Expected Counterexamples**:
- **PRIMARY**: buildEntry throws ReferenceError when accessing ema12/ema26 in return statement, caught by catch block, returns null
- Indicators return null despite having 1000 1m klines
- buildEntry returns null when some indicators could be calculated
- Possible causes: block-scoped variables accessed outside scope, insufficient fallback logic

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := buildEntry_fixed(input.symbol, input.klines1m, ...)
  ASSERT expectedBehavior(result)
END FOR

FUNCTION expectedBehavior(result)
  // Verify multi-tier fallback worked
  IF result.vwap == null AND input.klines1m.length >= 60 THEN
    FAIL "VWAP should use 1h fallback"
  END IF
  
  IF result.adx == null AND input.klines1m.length >= 14 THEN
    FAIL "ADX should use 1m fallback"
  END IF
  
  IF result.macdHistogram == null AND input.klines1m.length >= 35 THEN
    FAIL "MACD should use 1m fallback"
  END IF
  
  IF result.stochK == null AND input.klines1m.length >= 50 THEN
    FAIL "Stoch RSI should use 1m fallback"
  END IF
  
  // Verify buildEntry returns partial entry
  IF result == null AND input.klines1m.length >= 20 THEN
    FAIL "buildEntry should return partial entry"
  END IF
  
  // Verify at least some indicators calculated
  indicatorCount = countNonNullIndicators(result)
  IF indicatorCount == 0 AND input.klines1m.length >= 100 THEN
    FAIL "At least some indicators should calculate with 100+ klines"
  END IF
  
  RETURN true
END FUNCTION
```

**Test Cases**:
1. **CRITICAL: Variable Scope Fix Verification**: Call buildEntry with valid klines, verify it returns entry object without throwing ReferenceError
2. **CRITICAL: ema12/ema26 Accessibility**: Verify macdFastState and macdSlowState are populated correctly in return statement
3. **VWAP Multi-Tier Fallback**: Verify VWAP uses 4h → 2h → 1h → all-data fallback chain
4. **ADX Timeframe Fallback**: Verify ADX tries 15m → 5m → 1m until sufficient candles
5. **MACD Timeframe Fallback**: Verify MACD tries 15m → 5m → 1m until sufficient candles (and ema12/ema26 are accessible)
6. **Stochastic RSI Timeframe Fallback**: Verify Stoch RSI tries 15m → 5m → 1m until sufficient candles
7. **buildEntry Partial Success**: Verify buildEntry returns entry with some indicators even if others fail (no ReferenceError)
8. **Diagnostic Logging**: Verify fallback attempts are logged with timeframe, candles available, candles required
9. **Indicator Coverage Logging**: Verify indicator coverage percentage is logged per symbol

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT buildEntry_original(input) = buildEntry_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for symbols with sufficient 15m data, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Sufficient 15m Data Preservation**: Observe that symbols with 66+ 15m candles calculate all indicators on unfixed code, then verify fixed code produces identical results
2. **Indicator Algorithm Preservation**: Observe that RSI/EMA/MACD/BB calculations produce specific values on unfixed code, then verify fixed code produces identical values
3. **Cache Behavior Preservation**: Observe that indicator cache TTL and eviction work correctly on unfixed code, then verify fixed code preserves this behavior
4. **Ticker Overlay Preservation**: Observe that price/volume updates work correctly on unfixed code, then verify fixed code preserves this behavior
5. **Signal Derivation Preservation**: Observe that oversold/overbought/neutral signals derive correctly on unfixed code, then verify fixed code preserves this logic
6. **Strategy Score Preservation**: Observe that strategy scores compute correctly on unfixed code, then verify fixed code produces identical scores
7. **Baseline Cache Preservation**: Observe that avgBarSize1m/avgVolume1m cache correctly on unfixed code, then verify fixed code preserves this behavior

### Unit Tests

- **CRITICAL**: Test that ema12/ema26 are function-scoped and accessible in return statement
- **CRITICAL**: Test that buildEntry does not throw ReferenceError with valid kline data
- Test VWAP fallback chain (UTC day → 4h → 2h → 1h → all-data) with various candle counts
- Test ADX/MACD/Stoch RSI fallback (15m → 5m → 1m) with various aggregation results
- Test buildEntry partial success with mixed indicator success/failure scenarios
- Test diagnostic logging output format and content
- Test indicator coverage calculation and logging
- Test edge cases (0 candles, 1 candle, exactly threshold candles)
- Test that all variables used in return statement are function-scoped

### Property-Based Tests

- **CRITICAL**: Generate random kline datasets and verify buildEntry never throws ReferenceError
- **CRITICAL**: Verify all variables in return statement are accessible (no undefined references)
- Generate random kline datasets with varying lengths (20-1000 candles)
- Generate random aggregation results (0-100 15m candles)
- Verify indicators always attempt fallback when primary timeframe insufficient
- Verify buildEntry never returns null when ≥20 klines exist (unless genuine calculation failure)
- Verify fixed code produces identical results to original when 15m data sufficient
- Test across all asset classes (Crypto, Forex, Metal, Index, Stocks)
- Verify no ReferenceErrors occur across thousands of random inputs

### Integration Tests

- **CRITICAL**: Test full screener flow with 100/200/500 symbols, verify no ReferenceErrors occur
- **CRITICAL**: Test that buildEntry returns valid entries (not null) for all symbols with ≥20 klines
- Test indicator coverage percentage reaches 90%+ after fix
- Test that macdFastState and macdSlowState are populated correctly across all symbols
- Test cache warming and hydration with fixed buildEntry logic
- Test exchange failover with fixed indicator calculation
- Test real-time price shadowing with fixed indicator states
- Test forex/metal symbols specifically to verify fallback mechanisms work
