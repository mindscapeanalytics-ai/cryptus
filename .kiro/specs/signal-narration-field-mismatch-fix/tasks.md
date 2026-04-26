# Implementation Plan

## Overview

This task list implements the fix for the signal narration field name mismatch bug where code references `entry.priceChange24h` but the actual field in the ScreenerEntry interface is `change24h`. The fix follows the exploratory bugfix workflow: explore the bug first, preserve existing behavior, then implement the fix with full understanding.

---

## Phase 1: Exploratory Testing (BEFORE Fix)

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 24h Price Context Never Appears
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Test with concrete extreme price moves (-40%, +42%, +18%) to ensure reproducibility
  - Test implementation details from Bug Condition in design:
    - Create ScreenerEntry with `change24h: -40.08` (XATUSDT crash scenario)
    - Create ScreenerEntry with `change24h: 42.5` (extreme rally scenario)
    - Create ScreenerEntry with `change24h: 18.3` (moderate move scenario)
    - Call `generateSignalNarration()` on each entry
    - Assert that evidence list contains 24h price context items (e.g., "💥 PARABOLIC MOVE", "🚀 EXTREME MOMENTUM", "📈 Strong 24h momentum")
    - Assert that headlines reflect price context for extreme moves
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found:
    - XATUSDT (-40.08%): No 24h evidence item appears, headline shows "Bullish Expansion" instead of "Deeply Oversold Condition"
    - Extreme rally (+42.5%): No 24h evidence item appears, headline shows generic "Institutional Sell Setup" instead of "Overbought Exhaustion After +42.5% Rally"
    - Moderate move (+18.3%): No 24h evidence item appears in evidence list
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-24h Indicator Evidence Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for entries with null or small 24h changes:
    - Create ScreenerEntry with `change24h: null` and RSI indicators populated
    - Create ScreenerEntry with `change24h: 2.5` (small positive change) and MACD indicators populated
    - Create ScreenerEntry with `change24h: -3.0` (small negative change) and EMA cross populated
    - Call `generateSignalNarration()` on each entry
    - Record the exact evidence items generated (RSI, MACD, EMA, Bollinger Bands, etc.)
    - Record the conviction scores and headlines
  - Write property-based tests capturing observed behavior patterns:
    - For entries with null/small change24h, verify RSI evidence items are identical
    - For entries with null/small change24h, verify MACD evidence items are identical
    - For entries with null/small change24h, verify EMA cross evidence items are identical
    - For entries with null/small change24h, verify Bollinger Band evidence items are identical
    - For entries with null/small change24h, verify Stochastic RSI evidence items are identical
    - For entries with null/small change24h, verify Volume Spike evidence items are identical
    - For entries with null/small change24h, verify VWAP evidence items are identical
    - For entries with null/small change24h, verify ADX evidence items are identical
    - For entries with null/small change24h, verify Confluence evidence items are identical
    - For entries with null/small change24h, verify Divergence evidence items are identical
    - For entries with null/small change24h, verify OBV evidence items are identical
    - For entries with null/small change24h, verify Williams %R evidence items are identical
    - For entries with null/small change24h, verify CCI evidence items are identical
    - For entries with null/small change24h, verify Hidden Divergence evidence items are identical
    - For entries with null/small change24h, verify Market Regime evidence items are identical
    - For entries with null/small change24h, verify Risk Parameters evidence items are identical
    - For entries with null/small change24h, verify Fibonacci evidence items are identical
    - For entries with null/small change24h, verify conviction scores are identical
    - For entries with null/small change24h, verify headlines are identical
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

---

## Phase 2: Implementation

- [x] 3. Fix field name references in lib/signal-narration.ts

  - [x] 3.1 Fix 24h price context condition check (Line 103)
    - Change `if (entry.priceChange24h !== null && entry.priceChange24h !== undefined) {`
    - To: `if (entry.change24h !== null && entry.change24h !== undefined) {`
    - Location: `lib/signal-narration.ts` line 103
    - _Bug_Condition: isBugCondition(input) where codeReferences(input, 'priceChange24h') AND actualFieldName(input) == 'change24h'_
    - _Expected_Behavior: Code accesses entry.change24h to retrieve 24-hour price change data_
    - _Preservation: All other evidence item generation (RSI, EMA, MACD, etc.) must remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 3.2 Fix 24h price context variable assignment (Line 104)
    - Change `const priceChange = entry.priceChange24h;`
    - To: `const priceChange = entry.change24h;`
    - Location: `lib/signal-narration.ts` line 104
    - _Bug_Condition: isBugCondition(input) where codeReferences(input, 'priceChange24h') AND actualFieldName(input) == 'change24h'_
    - _Expected_Behavior: Variable priceChange is assigned from entry.change24h_
    - _Preservation: All other evidence item generation must remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 3.3 Fix headline generation 24h price access (Line 629)
    - Change `const priceChange24h = entry.priceChange24h ?? 0;`
    - To: `const priceChange24h = entry.change24h ?? 0;`
    - Location: `lib/signal-narration.ts` line 629
    - _Bug_Condition: isBugCondition(input) where codeReferences(input, 'priceChange24h') AND actualFieldName(input) == 'change24h'_
    - _Expected_Behavior: Headline generation logic accesses entry.change24h for price context_
    - _Preservation: Headline generation logic for non-extreme price moves must remain unchanged_
    - _Requirements: 2.5, 2.6, 2.7, 2.8_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 24h Price Context Displays Correctly
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify evidence items now contain:
      - "💥 PARABOLIC MOVE: Price crashed 40.1% in 24h" for -40.08% move
      - "🚀 PARABOLIC MOVE: Price rallied 42.5% in 24h" for +42.5% move
      - "📈 Strong 24h momentum: +18.3%" for +18.3% move
    - Verify headlines now reflect price context:
      - "Deeply Oversold Condition | Reversal Potential Building" for -40.08% move
      - "Overbought Exhaustion After +42.5% Rally | Pullback Risk Extreme" for +42.5% move
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-24h Indicator Evidence Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - Verify RSI, MACD, EMA, Bollinger Bands, Stochastic RSI, Volume Spike, VWAP, ADX, Confluence, Divergence, OBV, Williams %R, CCI, Hidden Divergence, Market Regime, Risk Parameters, and Fibonacci evidence items are identical before and after fix
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 4. Add priceChange24h parameter to market regime classification

  - [x] 4.1 Pass priceChange24h to classifyRegime() call
    - Location: `lib/screener-service.ts` line 1535-1542
    - Add parameter to existing classifyRegime() call:
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
    - The `ticker.priceChangePercent` is already available in scope and contains the 24h change percentage
    - _Bug_Condition: Market regime classification receives priceChange24h parameter but calling code never passes it_
    - _Expected_Behavior: Market regime classification correctly classifies extreme price moves (>20% in 24h) as "trending" or "breakout"_
    - _Preservation: Market regime classification for non-extreme moves must remain unchanged_
    - _Requirements: 1.4, 2.6_

  - [x] 4.2 (Optional Enhancement) Add volumeRatio parameter for complete regime classification
    - Location: `lib/screener-service.ts` line 1535-1542
    - Add volumeRatio parameter after priceChange24h:
      ```typescript
      priceChange24h: toNum(ticker.priceChangePercent, 0),
      volumeRatio: volumeSpike ? (curCandleVol && avgVolume1m && avgVolume1m > 0 ? curCandleVol / avgVolume1m : null) : null,
      ```
    - This provides volume context for breakout vs trending classification
    - Only calculated when volumeSpike is true to avoid unnecessary computation
    - _Expected_Behavior: Market regime classification distinguishes between "breakout" (with volume) and "trending" (without volume) for extreme moves_
    - _Preservation: Market regime classification for non-extreme moves must remain unchanged_
    - _Requirements: 2.6_

  - [x] 4.3 Write test for market regime with extreme price move
    - Create ScreenerEntry with `change24h: 35` and `volumeSpike: true`
    - Call screener computation logic that invokes `classifyRegime()`
    - Assert regime is classified as "breakout" (not "ranging")
    - Assert regime details mention "Extreme bullish breakout: +35.0% in 24h with volume confirmation"
    - Run test on FIXED code
    - **EXPECTED OUTCOME**: Test PASSES (confirms regime classification fix works)
    - _Requirements: 1.4, 2.6_

  - [x] 4.4 Verify market regime preservation test passes
    - Create ScreenerEntry with `change24h: 5` (non-extreme move) and various ADX/ATR values
    - Call screener computation logic that invokes `classifyRegime()`
    - Assert regime classification matches behavior before fix (trending/ranging/volatile based on ADX/ATR)
    - Run test on FIXED code
    - **EXPECTED OUTCOME**: Test PASSES (confirms no regressions in regime classification)
    - _Requirements: 3.5_

---

## Phase 3: Validation & Documentation

- [ ] 5. Run comprehensive test suite
  - Run all unit tests for signal narration engine
  - Run all unit tests for market regime classification
  - Run all property-based tests for preservation checking
  - Verify all tests pass
  - Document any test failures and root causes
  - _Requirements: All requirements_

- [ ] 6. Manual verification with screenshot examples
  - Test XATUSDT with -40.08% 24h change:
    - Verify evidence list shows "💥 PARABOLIC MOVE: Price crashed 40.1% in 24h — extreme exhaustion risk, high reversal probability"
    - Verify headline shows "Deeply Oversold Condition | Reversal Potential Building" (not "Bullish Expansion")
    - Take screenshot for documentation
  - Test asset with +42.5% 24h rally and RSI 75+:
    - Verify evidence list shows "🚀 PARABOLIC MOVE: Price rallied 42.5% in 24h — extreme exhaustion risk, high reversal probability"
    - Verify headline shows "Overbought Exhaustion After +42.5% Rally | Pullback Risk Extreme" (not generic "Institutional Sell Setup")
    - Take screenshot for documentation
  - Test ALGOUSDT with +1.71% 24h change and bullish indicators:
    - Verify evidence list includes "📊 24h change: +1.71% — moderate momentum"
    - Verify headline is consistent with bullish indicators (not contradictory "Institutional Sell Setup")
    - Take screenshot for documentation
  - Test asset with +35% 24h move and volume spike:
    - Verify market regime is classified as "breakout" (not "ranging")
    - Verify regime details show "Extreme bullish breakout: +35.0% in 24h with volume confirmation"
    - Take screenshot for documentation
  - _Requirements: 1.5, 1.6, 1.7, 2.2, 2.3, 2.4, 2.6, 2.7_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Verify all unit tests pass
  - Verify all property-based tests pass
  - Verify all integration tests pass
  - Verify manual verification screenshots confirm expected behavior
  - Ask the user if questions arise
  - _Requirements: All requirements_

---

## Notes

- **Bug Condition**: The bug manifests when code attempts to access `entry.priceChange24h` which does not exist on the ScreenerEntry interface - the actual field name is `change24h`
- **Expected Behavior**: Code should access `entry.change24h` to retrieve 24-hour price change data and generate appropriate evidence items with correct emoji, priority, and conviction scoring
- **Preservation**: All other signal narration logic, evidence generation, and headline formatting must remain unchanged for entries with null/small 24h changes
- **Testing Strategy**: Exploratory tests first (to surface counterexamples), then fix implementation, then preservation tests (to ensure no regressions)
- **Property-Based Testing**: Recommended for preservation checking to generate many test cases automatically and catch edge cases

---

## Success Criteria

- [ ] All exploratory tests document the bug with concrete counterexamples
- [ ] All field name references are corrected in `lib/signal-narration.ts`
- [ ] Market regime classification receives `priceChange24h` parameter
- [ ] All bug condition tests pass after fix
- [ ] All preservation tests pass after fix
- [ ] Manual verification confirms expected behavior with screenshot examples
- [ ] No regressions in existing signal narration functionality
