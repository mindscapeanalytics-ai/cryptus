# Signal Narration Field Mismatch Bugfix Design

## Overview

This design document addresses a critical field name mismatch bug in the signal narration system where code references `entry.priceChange24h` but the actual field in the `ScreenerEntry` interface is `change24h`. This causes 24-hour price change context to never appear in signal evidence lists, resulting in confusing and potentially contradictory signals.

**Impact:** ALL signals across the platform are affected. Users see headlines like "Bullish Expansion" for assets that crashed 40% in 24 hours, or "Institutional Sell Setup" for assets with strong bullish indicators and positive 24h momentum.

**Fix Strategy:** Simple field name correction in `lib/signal-narration.ts` and parameter passing fix in `lib/screener-service.ts` for market regime classification. This is a low-risk, high-impact fix with no logic changes required.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when code attempts to access `entry.priceChange24h` which does not exist on the ScreenerEntry interface
- **Property (P)**: The desired behavior - code should access `entry.change24h` to retrieve 24-hour price change data
- **Preservation**: All other signal narration logic, evidence generation, and headline formatting must remain unchanged
- **ScreenerEntry**: The TypeScript interface in `lib/types.ts` that defines the structure of screener data, including the `change24h` field
- **Signal Narration Engine**: The function `generateSignalNarration()` in `lib/signal-narration.ts` that generates human-readable explanations for trading signals
- **Market Regime Classification**: The function `classifyRegime()` in `lib/market-regime.ts` that determines market conditions (trending, ranging, volatile, breakout)

## Bug Details

### Bug Condition

The bug manifests when the signal narration engine attempts to access 24-hour price change data. The code checks for `entry.priceChange24h` but this field does not exist on the ScreenerEntry interface - the actual field name is `change24h`.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ScreenerEntry
  OUTPUT: boolean
  
  RETURN (codeReferences(input, 'priceChange24h'))
         AND (actualFieldName(input) == 'change24h')
         AND NOT fieldExists(input, 'priceChange24h')
END FUNCTION
```

### Examples

**Example 1: XATUSDT with -40.08% 24h crash**
- **Current (Buggy):** Headline shows "Bullish Expansion — Strategy Confirmed" with no 24h context in evidence list
- **Expected (Fixed):** Evidence item #2 shows "💥 PARABOLIC MOVE: Price crashed 40.1% in 24h — extreme exhaustion risk, high reversal probability" and headline shows "Deeply Oversold Condition | Reversal Potential Building"

**Example 2: Asset with +42.5% 24h rally and RSI 75+**
- **Current (Buggy):** Generic headline "Institutional Sell Setup" with no explanation of the extreme rally
- **Expected (Fixed):** Evidence item #2 shows "🚀 PARABOLIC MOVE: Price rallied 42.5% in 24h — extreme exhaustion risk, high reversal probability" and headline shows "Overbought Exhaustion After +42.5% Rally | Pullback Risk Extreme"

**Example 3: ALGOUSDT with +1.71% 24h change and bullish indicators**
- **Current (Buggy):** Headline shows "Institutional Sell Setup — High Confluence" (90% conviction) with no 24h context explaining the contradiction
- **Expected (Fixed):** Evidence includes "📊 24h change: +1.71% — moderate momentum" and headline reflects the bullish context

**Example 4: Market regime with +35% 24h move and volume spike**
- **Current (Buggy):** Regime classified as "ranging" because `priceChange24h` parameter is never passed
- **Expected (Fixed):** Regime classified as "breakout" with details "Extreme bullish breakout: +35.0% in 24h with volume confirmation"

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All other evidence item generation (RSI, EMA, MACD, Bollinger Bands, Stochastic RSI, Volume Spike, VWAP, ADX, Confluence, Divergence, OBV, Williams %R, CCI, Hidden Divergence, Market Regime, Risk Parameters, Fibonacci) must continue to work exactly as before
- Conviction scoring algorithm and weights must remain unchanged
- Headline generation logic for non-extreme price moves must remain unchanged
- Evidence item ordering and emoji usage must remain unchanged
- Signal narration output format and structure must remain unchanged

**Scope:**
All inputs where `change24h` is null, undefined, or between -5% and +5% should be completely unaffected by this fix. This includes:
- Signals with no 24h price data available
- Signals with minimal 24h price movement
- All other indicator-based evidence generation

**Note:** The actual expected correct behavior (what should happen when the bug is fixed) is defined in the Correctness Properties section (Property 1). This section focuses on what must NOT change.

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Field Name Typo**: The developer who wrote the 24h price context logic used `priceChange24h` instead of the actual field name `change24h` defined in the ScreenerEntry interface
   - Lines 103, 104, 629 in `lib/signal-narration.ts` reference the wrong field name
   - This is a simple typo that went unnoticed because TypeScript doesn't enforce strict null checks on optional property access

2. **Missing Parameter Passing**: The `classifyRegime()` function expects a `priceChange24h` parameter but the calling code in `lib/screener-service.ts` never passes it
   - Line 1535-1542 in `lib/screener-service.ts` calls `classifyRegime()` without the `priceChange24h` parameter
   - This means the extreme price move override (lines 61-83 in `lib/market-regime.ts`) never triggers

3. **Inconsistent Naming Convention**: The codebase uses both `change24h` (in types.ts) and `priceChange24h` (in market-regime.ts parameter name) for the same concept
   - This naming inconsistency led to the mismatch

4. **Lack of Type Safety**: TypeScript allows accessing non-existent properties with optional chaining (`entry.priceChange24h ?? 0`) which returns undefined without compile-time errors
   - The code silently fails at runtime, defaulting to 0 or undefined

## Correctness Properties

Property 1: Bug Condition - 24h Price Context Display

_For any_ ScreenerEntry where `change24h` is not null and has an absolute value greater than 5%, the fixed signal narration function SHALL access `entry.change24h` (not `entry.priceChange24h`) and generate appropriate evidence items with correct emoji, priority, and conviction scoring based on the magnitude of the price change.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8**

Property 2: Preservation - Non-24h Evidence Generation

_For any_ ScreenerEntry, the fixed code SHALL produce exactly the same evidence items, conviction scores, and headline logic for all non-24h indicators (RSI, EMA, MACD, Bollinger Bands, Stochastic RSI, Volume Spike, VWAP, ADX, Confluence, Divergence, OBV, Williams %R, CCI, Hidden Divergence, Risk Parameters, Fibonacci) as the original code, preserving all existing functionality for indicator-based signal generation.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File 1**: `lib/signal-narration.ts`

**Function**: `generateSignalNarration()`

**Specific Changes**:
1. **Line 103**: Change `if (entry.priceChange24h !== null && entry.priceChange24h !== undefined) {` to `if (entry.change24h !== null && entry.change24h !== undefined) {`
   - This fixes the condition check for 24h price context block

2. **Line 104**: Change `const priceChange = entry.priceChange24h;` to `const priceChange = entry.change24h;`
   - This fixes the variable assignment to use the correct field

3. **Line 629**: Change `const priceChange24h = entry.priceChange24h ?? 0;` to `const priceChange24h = entry.change24h ?? 0;`
   - This fixes the headline generation logic to access the correct field

4. **Lines 658, 662, 663, 664**: No changes needed - these lines use the local variable `priceChange24h` which will now have the correct value from line 629

**File 2**: `lib/screener-service.ts`

**Function**: Main screener computation logic (around line 1535)

**Specific Changes**:
1. **Line 1535-1542**: Add `priceChange24h` parameter to `classifyRegime()` call:
   ```typescript
   const regimeResult = classifyRegime({
     adx,
     atr,
     atrAvg: atrAvgRolling,
     bbWidth,
     bbWidthAvg: bbWidthAvgRolling,
     volumeSpike,
     priceChange24h: toNum(ticker.priceChangePercent, 0),  // ← ADD THIS LINE
   });
   ```
   - This ensures the market regime classification receives 24h price change data
   - The `ticker.priceChangePercent` is already available in scope and contains the 24h change percentage

2. **Optional Enhancement**: Add `volumeRatio` parameter for complete regime classification:
   ```typescript
   priceChange24h: toNum(ticker.priceChangePercent, 0),
   volumeRatio: volumeSpike ? (curCandleVol && avgVolume1m && avgVolume1m > 0 ? curCandleVol / avgVolume1m : null) : null,
   ```
   - This provides volume context for breakout vs trending classification
   - Only calculated when volumeSpike is true to avoid unnecessary computation

**File 3**: `lib/market-regime.ts`

**No changes required** - the function signature already accepts `priceChange24h` as an optional parameter. The logic (lines 61-83) will automatically activate once the parameter is passed from the calling code.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that create ScreenerEntry objects with various `change24h` values and call `generateSignalNarration()`. Run these tests on the UNFIXED code to observe that 24h price context never appears in the evidence list.

**Test Cases**:
1. **Extreme Negative Move Test**: Create entry with `change24h: -40.08` (will fail on unfixed code - no 24h evidence item)
2. **Extreme Positive Move Test**: Create entry with `change24h: 42.5` (will fail on unfixed code - no 24h evidence item)
3. **Moderate Move Test**: Create entry with `change24h: 18.3` (will fail on unfixed code - no 24h evidence item)
4. **Market Regime Test**: Create entry with `change24h: 35` and volumeSpike true, verify regime is "ranging" on unfixed code (incorrect)

**Expected Counterexamples**:
- 24h price context evidence items are never generated
- Headlines do not reflect extreme price movements
- Market regime classification ignores extreme price moves
- Possible causes: field name mismatch (`priceChange24h` vs `change24h`), missing parameter passing

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL entry WHERE entry.change24h IS NOT NULL AND |entry.change24h| > 5 DO
  result := generateSignalNarration_fixed(entry)
  ASSERT result.reasons CONTAINS evidence_item_with_24h_context
  ASSERT result.headline REFLECTS price_context_when_extreme
END FOR
```

**Test Cases**:
1. **Extreme Negative Move (-40%)**: Verify evidence item shows "💥 PARABOLIC MOVE: Price crashed 40.0% in 24h"
2. **Extreme Positive Move (+42%)**: Verify evidence item shows "🚀 PARABOLIC MOVE: Price rallied 42.0% in 24h"
3. **Strong Negative Move (-25%)**: Verify evidence item shows "📉 EXTREME MOMENTUM: Price plunged 25.0% in 24h"
4. **Strong Positive Move (+35%)**: Verify evidence item shows "🚀 EXTREME MOMENTUM: Price surged 35.0% in 24h"
5. **Moderate Move (+18%)**: Verify evidence item shows "📈 Strong 24h momentum: +18.0%"
6. **Headline Context Test**: Verify headline for +42% move with RSI 75+ shows "Overbought Exhaustion After +42.0% Rally"
7. **Market Regime Test**: Verify regime for +35% move with volume spike is "breakout" not "ranging"

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL entry WHERE entry.change24h IS NULL OR |entry.change24h| <= 5 DO
  ASSERT generateSignalNarration_original(entry) = generateSignalNarration_fixed(entry)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for entries with null/small 24h changes, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Null 24h Change**: Observe that unfixed code generates evidence items for RSI, MACD, etc. without 24h context, then verify fixed code produces identical output
2. **Small Positive Change (+2%)**: Observe that unfixed code either omits 24h context or shows low-priority evidence, then verify fixed code produces identical output
3. **Small Negative Change (-3%)**: Observe that unfixed code handles this correctly, then verify fixed code produces identical output
4. **All Other Indicators**: Verify RSI, EMA, MACD, Bollinger Bands, Stochastic RSI, Volume Spike, VWAP, ADX, Confluence, Divergence, OBV, Williams %R, CCI evidence items are identical before and after fix

### Unit Tests

- Test field access with various `change24h` values (null, 0, positive, negative, extreme)
- Test evidence item generation for each price change magnitude tier (>50%, 30-50%, 15-30%, 5-15%, <5%)
- Test headline generation with extreme price moves and various RSI combinations
- Test market regime classification with and without `priceChange24h` parameter

### Property-Based Tests

- Generate random ScreenerEntry objects with `change24h` values across the full range (-100% to +100%)
- Verify 24h evidence items appear when |change24h| > 5%
- Verify evidence items do NOT appear when change24h is null or |change24h| <= 5%
- Generate random entries with null/small change24h and verify all other evidence items are identical before and after fix

### Integration Tests

- Test full signal narration flow with real ScreenerEntry data from production
- Test market regime classification with extreme price moves and volume spikes
- Test that visual feedback (emoji, conviction labels) is correct for extreme moves
- Test that headlines reflect price context appropriately across all scenarios

### Manual Verification

After implementing the fix, manually verify with the screenshot examples:
1. **XATUSDT (-40.08%)**: Check that evidence list shows parabolic crash warning and headline reflects oversold condition
2. **ALGOUSDT (+1.71%)**: Check that evidence list includes 24h context and headline is consistent with bullish indicators
3. **Any asset with +42% move**: Check that headline shows "Overbought Exhaustion After +42% Rally" instead of generic "Bullish Expansion"
