# Implementation Plan

## Overview

This implementation plan addresses the RSI screener missing data bug using the bug condition methodology. The PRIMARY root cause is a critical variable scope error where `ema12` and `ema26` are declared with `const` inside if/else blocks but accessed in the return statement outside those blocks, causing ReferenceError. SECONDARY issues include insufficient fallback mechanisms for VWAP, ADX, MACD, and Stochastic RSI.

**Critical Priority**: The variable scope fix will resolve 80%+ of "buildEntry returned null" errors and must be implemented first.

---

## Phase 1: Exploration (Write Tests BEFORE Fix)

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Variable Scope ReferenceError
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the variable scope bug exists
  - **Scoped PBT Approach**: Test that buildEntry throws ReferenceError when accessing ema12/ema26 in return statement
  - Test implementation details from Bug Condition in design:
    - Call buildEntry with valid kline data (100+ candles)
    - Verify it throws ReferenceError with message containing "ema12" or "ema26"
    - Verify the error occurs when accessing macdFastState/macdSlowState in return statement
  - The test assertions should match the Expected Behavior Properties from design:
    - After fix: buildEntry should return valid entry object without throwing ReferenceError
    - After fix: macdFastState and macdSlowState should be populated correctly
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS with ReferenceError (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.3, 1.5_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Sufficient 15m Data Unchanged Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for symbols with sufficient 15m data (66+ candles):
    - Run buildEntry with symbols that have 66+ 15m candles
    - Record the exact indicator values produced (RSI, EMA, MACD, BB, etc.)
    - Record the timeframes used for each indicator
    - Record the cache behavior and TTL settings
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - For all symbols with 66+ 15m candles, verify indicators use 15m timeframe (not fallback)
    - For all symbols with sufficient data, verify indicator values match original algorithm
    - For all symbols, verify cache TTL remains 15s (10s for alert-active)
    - For all symbols, verify ticker overlay behavior unchanged
    - For all symbols, verify strategy score computation unchanged
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

---

## Phase 2: Implementation (Apply Fix with Understanding)

- [-] 3. Fix for RSI screener missing data bug

  - [x] 3.1 CRITICAL: Fix variable scope error in MACD calculation (PRIMARY FIX)
    - Open `lib/screener-service.ts` and locate the buildEntry function (lines 1190-1510)
    - Identify all variables used in the return statement (lines 1475-1500)
    - Declare `ema12` and `ema26` at function scope (alongside macdLineVal, macdSignalVal, etc.)
    - Change lines 1199, 1224, 1249 from `const ema12 = ...` to `ema12 = ...` (assignment, not declaration)
    - Change lines 1199, 1224, 1249 from `const ema26 = ...` to `ema26 = ...` (assignment, not declaration)
    - Verify all variables in return statement are function-scoped, not block-scoped
    - Audit entire buildEntry function for other block-scoped variables accessed in return statement
    - _Bug_Condition: isBugCondition(input) where ema12/ema26 are declared in if/else blocks but accessed in return statement_
    - _Expected_Behavior: buildEntry returns valid entry object without throwing ReferenceError, macdFastState and macdSlowState are populated correctly_
    - _Preservation: Indicator calculation algorithms, cache behavior, ticker overlay unchanged_
    - _Requirements: 1.3, 1.5, 2.5, 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 3.2 Implement VWAP multi-tier fallback (SECONDARY FIX)
    - Locate VWAP calculation in buildEntry (lines 1340-1350)
    - Replace single 4-hour fallback with cascade: 4h → 2h → 1h → all available data
    - Add logging of fallback strategy used (UTC_DAY, 4H_ROLLING, 2H_ROLLING, 1H_ROLLING, ALL_AVAILABLE)
    - Verify VWAP calculates successfully when any kline data exists (≥10 candles)
    - _Bug_Condition: isBugCondition(input) where VWAP returns null despite having ≥60 klines_
    - _Expected_Behavior: VWAP uses multi-tier fallback to calculate whenever ≥10 candles exist_
    - _Preservation: VWAP calculation algorithm unchanged, only fallback strategy enhanced_
    - _Requirements: 1.1, 2.1, 2.8, 3.1_

  - [x] 3.3 Implement ADX timeframe fallback with diagnostic logging
    - Locate ADX calculation in buildEntry (lines 1420-1435)
    - Add explicit fallback chain: 15m → 5m → 1m with diagnostic logging
    - Log timeframe used, candles available, and candles required
    - Add warning log when all timeframes fail (insufficient data)
    - Verify ADX calculates successfully when ≥14 candles exist in any timeframe
    - _Bug_Condition: isBugCondition(input) where ADX returns null despite having ≥14 1m candles_
    - _Expected_Behavior: ADX tries 15m → 5m → 1m until sufficient candles found_
    - _Preservation: ADX calculation algorithm unchanged, only fallback logic enhanced_
    - _Requirements: 1.2, 2.2, 2.9, 3.1_

  - [x] 3.4 Implement MACD diagnostic logging enhancement
    - Locate MACD calculation in buildEntry (lines 1280-1330)
    - Add diagnostic logging after all MACD fallback attempts (after line 1270)
    - Log warning when MACD fails on all timeframes (need 35 candles)
    - Include candles available for each timeframe (1m, 5m, 15m)
    - Verify MACD calculates successfully when ≥35 candles exist in any timeframe
    - _Bug_Condition: isBugCondition(input) where MACD returns null despite having ≥35 1m candles_
    - _Expected_Behavior: MACD tries 15m → 5m → 1m until sufficient candles found, logs failures_
    - _Preservation: MACD calculation algorithm unchanged, only diagnostic logging added_
    - _Requirements: 1.3, 2.3, 2.9, 3.1_

  - [x] 3.5 Implement Stochastic RSI diagnostic logging
    - Locate Stochastic RSI calculation in buildEntry (lines 1335-1350)
    - Add diagnostic logging after all Stoch RSI fallback attempts (after line 1350)
    - Log warning when Stoch RSI fails on all timeframes (need 50 candles)
    - Include candles available for each timeframe (1m, 5m, 15m)
    - Verify Stoch RSI calculates successfully when ≥50 candles exist in any timeframe
    - _Bug_Condition: isBugCondition(input) where Stoch RSI returns null despite having ≥50 1m candles_
    - _Expected_Behavior: Stoch RSI tries 15m → 5m → 1m until sufficient candles found, logs failures_
    - _Preservation: Stoch RSI calculation algorithm unchanged, only diagnostic logging added_
    - _Requirements: 1.4, 2.4, 2.9, 3.1_

  - [x] 3.6 Implement buildEntry indicator coverage logging
    - Locate buildEntry return statement (line 1470)
    - Add indicator coverage calculation before return statement
    - Count non-null indicators: rsi (4), ema (2), macd (1), bb (1), stoch (1), vwap (1), atr (1), adx (1)
    - Calculate coverage percentage: totalIndicators / maxIndicators * 100
    - Log coverage percentage per symbol for diagnostics
    - Verify buildEntry returns partial entries (not null) when some indicators succeed
    - _Bug_Condition: isBugCondition(input) where buildEntry returns null despite some indicators calculable_
    - _Expected_Behavior: buildEntry returns partial entry with successfully calculated indicators_
    - _Preservation: buildEntry return logic unchanged, only diagnostic logging added_
    - _Requirements: 1.5, 2.5, 2.9, 3.2_

  - [ ] 3.7 Implement UI syncing state detection (OPTIONAL)
    - Open `components/screener-dashboard.tsx`
    - Locate IndicatorCell component (line ~150)
    - Add syncing state detection: `const isSyncing = isSyncing && value === null`
    - Update render logic (line ~170): `{showSyncing ? '...' : formatted}`
    - Verify UI displays "..." for syncing, "-" for permanent no-data
    - _Bug_Condition: isBugCondition(input) where UI shows "-" for both syncing and no-data_
    - _Expected_Behavior: UI shows "..." for syncing, "-" for permanent no-data_
    - _Preservation: UI rendering logic for calculated indicators unchanged_
    - _Requirements: 1.7, 2.7_

  - [x] 3.8 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Variable Scope Fix Validation
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify buildEntry returns valid entry object without throwing ReferenceError
    - Verify macdFastState and macdSlowState are populated correctly
    - Verify no ReferenceError occurs when accessing ema12/ema26 in return statement
    - _Requirements: 2.5, Expected Behavior Properties from design_

  - [x] 3.9 Verify preservation tests still pass
    - **Property 2: Preservation** - Sufficient 15m Data Unchanged Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Verify symbols with 66+ 15m candles still use 15m timeframe (no fallback)
    - Verify indicator values match original algorithm for sufficient data
    - Verify cache TTL remains 15s (10s for alert-active)
    - Verify ticker overlay behavior unchanged
    - Verify strategy score computation unchanged
    - Confirm all tests still pass after fix (no regressions)

---

## Phase 3: Validation (Verify Fix Works and No Regressions)

- [ ] 4. Unit Tests - Variable Scope Fix

  - [ ] 4.1 Test ema12/ema26 function scope accessibility
    - Write unit test verifying ema12/ema26 are declared at function scope
    - Verify they are accessible in return statement without ReferenceError
    - Test with various kline datasets (100, 500, 1000 candles)
    - Verify macdFastState and macdSlowState are populated correctly
    - _Requirements: 1.3, 1.5, 2.5_

  - [ ] 4.2 Test buildEntry does not throw ReferenceError
    - Write unit test calling buildEntry with valid kline data
    - Verify it returns entry object (not null)
    - Verify no ReferenceError is thrown
    - Test with edge cases (exactly 35 candles, 34 candles, 36 candles)
    - _Requirements: 1.5, 2.5_

  - [ ] 4.3 Test all return statement variables are function-scoped
    - Audit all variables used in buildEntry return statement (lines 1475-1500)
    - Write unit tests verifying each variable is accessible
    - Test with various scenarios (sufficient data, insufficient data, mixed)
    - _Requirements: 1.5, 2.5_

- [ ] 5. Unit Tests - Fallback Mechanisms

  - [ ] 5.1 Test VWAP multi-tier fallback chain
    - Test UTC day → 4h → 2h → 1h → all-data fallback with various candle counts
    - Verify VWAP calculates successfully with 240, 120, 60, 10 candles
    - Verify fallback strategy is logged correctly
    - Test edge cases (exactly 10 candles, 9 candles)
    - _Requirements: 1.1, 2.1, 2.8_

  - [ ] 5.2 Test ADX timeframe fallback (15m → 5m → 1m)
    - Test with 66, 40, 14 15m/5m/1m candles respectively
    - Verify ADX uses appropriate timeframe based on availability
    - Verify diagnostic logging includes timeframe, candles available, candles required
    - Test edge cases (exactly 14 candles, 13 candles)
    - _Requirements: 1.2, 2.2, 2.9_

  - [ ] 5.3 Test MACD timeframe fallback (15m → 5m → 1m)
    - Test with 66, 40, 35 15m/5m/1m candles respectively
    - Verify MACD uses appropriate timeframe based on availability
    - Verify diagnostic logging when all timeframes fail
    - Test edge cases (exactly 35 candles, 34 candles)
    - _Requirements: 1.3, 2.3, 2.9_

  - [ ] 5.4 Test Stochastic RSI timeframe fallback (15m → 5m → 1m)
    - Test with 66, 100, 50 15m/5m/1m candles respectively
    - Verify Stoch RSI uses appropriate timeframe based on availability
    - Verify diagnostic logging when all timeframes fail
    - Test edge cases (exactly 50 candles, 49 candles)
    - _Requirements: 1.4, 2.4, 2.9_

  - [ ] 5.5 Test buildEntry partial success logic
    - Test with mixed indicator success/failure scenarios
    - Verify buildEntry returns partial entry (not null) when some indicators succeed
    - Verify indicator coverage logging is correct
    - Test edge cases (all indicators succeed, all fail, 50% succeed)
    - _Requirements: 1.5, 2.5, 2.9_

- [ ] 6. Property-Based Tests - Bug Condition Coverage

  - [ ] 6.1 Generate random kline datasets and verify no ReferenceError
    - Use property-based testing library (fast-check, jsverify, etc.)
    - Generate random kline datasets with varying lengths (20-1000 candles)
    - Verify buildEntry never throws ReferenceError
    - Verify all variables in return statement are accessible
    - Run 1000+ test cases to ensure comprehensive coverage
    - _Requirements: 1.3, 1.5, 2.5_

  - [ ] 6.2 Verify indicators attempt fallback when primary timeframe insufficient
    - Generate random aggregation results (0-100 15m candles)
    - Verify VWAP/ADX/MACD/Stoch RSI attempt fallback to lower timeframes
    - Verify indicators calculate successfully when sufficient data exists in any timeframe
    - Run 1000+ test cases across all indicators
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

  - [ ] 6.3 Verify buildEntry never returns null when ≥20 klines exist
    - Generate random kline datasets with ≥20 candles
    - Verify buildEntry returns entry object (not null)
    - Verify at least some indicators are calculated (not all null)
    - Test across all asset classes (Crypto, Forex, Metal, Index, Stocks)
    - _Requirements: 1.5, 2.5, 3.2_

- [ ] 7. Property-Based Tests - Preservation Coverage

  - [ ] 7.1 Verify fixed code produces identical results when 15m data sufficient
    - Generate random kline datasets with 66+ 15m candles
    - Compare original buildEntry output with fixed buildEntry output
    - Verify all indicator values are identical
    - Verify timeframes used are identical (15m, no fallback)
    - Run 1000+ test cases to ensure comprehensive coverage
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ] 7.2 Verify cache behavior preservation
    - Test indicator cache TTL (15s standard, 10s alert-active)
    - Verify cache eviction logic unchanged
    - Verify cache hit/miss behavior unchanged
    - Test across various symbols and timeframes
    - _Requirements: 3.8_

  - [ ] 7.3 Verify ticker overlay preservation
    - Test price/volume updates with fixed buildEntry
    - Verify ticker overlay behavior unchanged
    - Verify real-time price shadowing unchanged
    - Test across various symbols and market conditions
    - _Requirements: 3.7_

  - [ ] 7.4 Verify signal derivation preservation
    - Test oversold/overbought/neutral signal derivation
    - Verify signal logic unchanged with fixed buildEntry
    - Test across various indicator values and thresholds
    - _Requirements: 3.6_

  - [ ] 7.5 Verify strategy score preservation
    - Test strategy score computation with fixed buildEntry
    - Verify score calculation unchanged
    - Test with various indicator combinations (all present, some null, etc.)
    - _Requirements: 3.6_

- [ ] 8. Integration Tests - Full Screener Flow

  - [ ] 8.1 Test full screener flow with 100 symbols
    - Run screener with 100 diverse symbols (Crypto, Forex, Metal, etc.)
    - Verify no ReferenceErrors occur
    - Verify buildEntry returns valid entries (not null) for all symbols with ≥20 klines
    - Verify indicator coverage reaches 90%+ after fix
    - Verify macdFastState and macdSlowState are populated correctly across all symbols
    - _Requirements: 1.5, 2.5, 2.6_

  - [ ] 8.2 Test full screener flow with 200 symbols
    - Run screener with 200 diverse symbols
    - Verify no ReferenceErrors occur
    - Verify buildEntry returns valid entries for all symbols
    - Verify indicator coverage remains high (90%+)
    - Test cache warming and hydration with fixed buildEntry logic
    - _Requirements: 1.5, 2.5, 2.6, 3.8_

  - [ ] 8.3 Test full screener flow with 500 symbols
    - Run screener with 500 diverse symbols
    - Verify no ReferenceErrors occur
    - Verify buildEntry returns valid entries for all symbols
    - Verify indicator coverage remains high (90%+)
    - Test exchange failover with fixed indicator calculation
    - _Requirements: 1.5, 2.5, 2.6_

  - [ ] 8.4 Test forex/metal symbols specifically
    - Run screener with forex symbols (EURUSDT, GBPUSDT, USDJPY, etc.)
    - Run screener with metal symbols (PAXGUSDT, XAUUSDT, etc.)
    - Verify fallback mechanisms work correctly for these asset classes
    - Verify indicator coverage is high despite market hours gaps
    - _Requirements: 1.6, 2.6_

  - [ ] 8.5 Test real-time price shadowing with fixed indicator states
    - Run screener with real-time price updates
    - Verify ticker overlay works correctly with fixed buildEntry
    - Verify real-time price shadowing unchanged
    - Test across various symbols and market conditions
    - _Requirements: 3.7_

- [ ] 9. Checkpoint - Ensure all tests pass
  - Verify all unit tests pass (tasks 4.1-4.3, 5.1-5.5)
  - Verify all property-based tests pass (tasks 6.1-6.3, 7.1-7.5)
  - Verify all integration tests pass (tasks 8.1-8.5)
  - Verify no ReferenceErrors occur across all test suites
  - Verify indicator coverage reaches 90%+ in integration tests
  - Verify no regressions in preservation tests
  - Ask the user if questions arise or if any tests fail

---

## Summary

This implementation plan follows the bugfix workflow:
1. **Explore** (Tasks 1-2): Write tests BEFORE fix to understand the bug
2. **Implement** (Task 3): Apply the fix with understanding from exploration
3. **Validate** (Tasks 4-9): Verify fix works and doesn't break anything

**Critical Priority**: Task 3.1 (variable scope fix) is the PRIMARY fix that will resolve 80%+ of errors. Tasks 3.2-3.7 are SECONDARY improvements for fallback mechanisms and diagnostics.

**Testing Strategy**: Property-based testing is used extensively to ensure comprehensive coverage across the input domain and strong preservation guarantees.
