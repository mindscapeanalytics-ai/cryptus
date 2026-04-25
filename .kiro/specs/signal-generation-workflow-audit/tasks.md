# Implementation Plan: Signal Generation Workflow Audit

## Overview

This implementation plan creates a comprehensive audit and enhancement system for the RSIQ Pro signal generation workflow. The system will verify end-to-end integrity, validate configurations, detect gaps, and strengthen signal accuracy through property-based testing and static analysis. All components are designed to be non-invasive, modular, and independently testable.

**Implementation Language**: TypeScript  
**Testing Framework**: Vitest + fast-check (property-based testing)  
**Architecture**: Non-conflicting audit system that runs independently without modifying production signal logic

## Tasks

- [x] 1. Set up audit infrastructure and testing framework
  - Create directory structure: `lib/audit/`, `lib/audit/tests/`, `lib/audit/reports/`
  - Install fast-check for property-based testing: `npm install --save-dev fast-check @types/fast-check`
  - Create base types and interfaces for audit system in `lib/audit/types.ts`
  - Set up test configuration for property-based tests in `vitest.config.ts`
  - _Requirements: 12.1, 12.2_

- [ ]* 1.1 Write unit tests for audit infrastructure
  - Test audit configuration loading and validation
  - Test report generation utilities
  - Test error handling and recovery mechanisms
  - _Requirements: 12.1_

- [x] 2. Implement Audit_Engine core orchestration
  - [x] 2.1 Create Audit_Engine class in `lib/audit/audit-engine.ts`
    - Implement `executeAudit()` method with module coordination
    - Implement `verifyWorkflow()` for end-to-end data flow tracing
    - Implement `validateSettings()` for configuration validation
    - Implement `verifySignalAccuracy()` for signal correctness checks
    - Implement `validateNarrator()` for narrative output validation
    - Implement `detectGaps()` for implementation gap detection
    - Add comprehensive error handling with AuditError types
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ]* 2.2 Write property test for Audit_Engine orchestration
    - **Property 1: Audit execution completeness**
    - **Validates: Requirements 1.1**
    - Test that all enabled modules execute and produce results
    - Verify error isolation prevents cascade failures

  - [x] 2.3 Implement workflow verification module
    - Create `lib/audit/workflow-verifier.ts`
    - Trace data flow from market data fetch through terminal display
    - Verify Screener_Service kline fetch from all exchanges
    - Validate indicator calculation data flow
    - Verify Strategy_Scorer integration
    - Validate Narrator generation for non-neutral signals
    - Verify Terminal display components
    - Validate Signal_Sync_API aggregation
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ]* 2.4 Write unit tests for workflow verification
    - Test data flow tracing logic
    - Test component verification
    - Test integration point validation
    - _Requirements: 1.1, 1.8_

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement settings and configuration validation
  - [x] 4.1 Create settings validator in `lib/audit/settings-validator.ts`
    - Validate RSI_DEFAULTS usage across all modules
    - Verify INDICATOR_DEFAULTS consistency
    - Validate asset-specific RSI zones (Crypto, Forex, Metal, Index, Stocks)
    - Verify global indicator enable/disable flags
    - Validate custom per-symbol configuration overrides
    - Verify volatility multipliers for asset classes
    - Validate threshold values (volume spike, long candle, overbought/oversold)
    - Generate settings validation report
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 4.2 Write property test for settings validation
    - **Property 10: Default settings consistency**
    - **Validates: Requirements 2.1, 2.2**
    - Test that all indicator calculations use centralized defaults
    - Verify no hardcoded values exist outside defaults module

  - [ ]* 4.3 Write unit tests for settings validator
    - Test RSI zone calibration detection
    - Test volatility multiplier validation
    - Test configuration override logic
    - _Requirements: 2.3, 2.6_

- [ ] 5. Implement signal accuracy verification with property-based tests
  - [ ] 5.1 Create indicator property tests in `lib/audit/tests/indicator-properties.test.ts`
    - Set up fast-check generators for price arrays
    - Create generators for edge cases (empty arrays, null values, extreme values)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 5.2 Write property test for RSI range invariant
    - **Property 1: RSI Range Invariant**
    - **Validates: Requirements 3.1**
    - Generate random price arrays (15-1000 elements, 0.01-100000 range)
    - Verify RSI output is always in [0, 100] for all timeframes
    - Test with 100 iterations minimum

  - [ ]* 5.3 Write property test for MACD histogram normalization
    - **Property 2: MACD Histogram Normalization**
    - **Validates: Requirements 3.2**
    - Generate price arrays with and without ATR values
    - Verify normalization produces finite numeric values
    - Test ATR-based and price-relative scaling paths

  - [ ]* 5.4 Write property test for Bollinger Band position clamping
    - **Property 3: Bollinger Band Position Clamping**
    - **Validates: Requirements 3.3**
    - Generate price arrays with extreme outliers
    - Verify BB position never exceeds [0, 1] bounds

  - [ ]* 5.5 Write property test for strategy score clamping
    - **Property 4: Strategy Score Clamping**
    - **Validates: Requirements 3.5**
    - Generate random indicator combinations including extreme values
    - Verify score is always clamped to [-100, 100]

  - [ ]* 5.6 Write property test for signal classification consistency
    - **Property 5: Signal Classification Consistency**
    - **Validates: Requirements 3.6**
    - Generate random scores across full range
    - Verify classification is deterministic and threshold-consistent

  - [ ]* 5.7 Write property test for real-time approximation consistency
    - **Property 6: Real-Time Approximation Consistency**
    - **Validates: Requirements 3.7**
    - Generate price series, compute full RSI, simulate real-time updates
    - Verify approximation accuracy within 0.5 RSI points tolerance

  - [ ]* 5.8 Write property test for indicator edge case handling
    - **Property 11: Indicator Edge Case Handling**
    - **Validates: Requirements 3.4, 8.1, 8.2, 8.3, 8.4**
    - Test insufficient data, null values, zero division, empty arrays
    - Verify graceful handling without exceptions or NaN/Infinity

- [ ] 6. Checkpoint - Ensure all property tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement narrator validation with property-based tests
  - [ ] 7.1 Create narrator property tests in `lib/audit/tests/narrator-properties.test.ts`
    - Set up fast-check generators for ScreenerEntry objects
    - Create generators for varying indicator combinations
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 7.2 Write property test for narrator conviction calculation
    - **Property 7: Narrator Conviction Calculation**
    - **Validates: Requirements 4.2**
    - Generate random ScreenerEntry objects with non-neutral signals
    - Verify conviction formula: (|netBias| / maxPossible) × 100 × scaleFactor + confluenceBonus
    - Verify conviction is always in [0, 100] range

  - [ ]* 7.3 Write property test for pillar confluence bonus
    - **Property 8: Narrator Pillar Confluence Bonus**
    - **Validates: Requirements 4.3**
    - Generate signals with 1-5 active pillars
    - Verify bonus calculation: 12 × (N - 1) points

  - [ ]* 7.4 Write property test for asset-specific RSI zone application
    - **Property 9: Asset-Specific RSI Zone Application**
    - **Validates: Requirements 2.3, 9.1**
    - Generate signals for each asset class (Crypto, Forex, Metal, Index, Stocks)
    - Verify correct zone thresholds are applied

  - [ ]* 7.5 Write property test for narrator numeric formatting
    - **Property 15: Narrator Numeric Formatting**
    - **Validates: Requirements 4.6**
    - Generate narrator output for various numeric ranges
    - Verify RSI: 1 decimal, prices: dynamic precision, percentages: 2 decimals

  - [ ] 7.6 Create narrator validator in `lib/audit/narrator-validator.ts`
    - Validate conviction algorithm implementation
    - Verify pillar confluence bonus calculation
    - Validate asset-specific macro context for Metals
    - Verify indicator integration (RSI multi-TF, EMA, MACD, BB, Stoch, divergence, etc.)
    - Validate formatting precision
    - Generate narrator validation report
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 7.7 Write unit tests for narrator validator
    - Test conviction algorithm verification
    - Test pillar confluence detection
    - Test asset-specific context generation
    - _Requirements: 4.2, 4.3, 4.4_

- [ ] 8. Implement strategy strengthening validation
  - [ ] 8.1 Create strategy validator in `lib/audit/strategy-validator.ts`
    - Verify minimum 4 active factors requirement
    - Validate counter-trend penalties (1h RSI disagreement)
    - Verify ADX choppy dampening (0.7x when ADX < 18)
    - Verify ADX strong trend boost (1.2x when ADX > 30)
    - Validate Smart Money confirmation boost (+15 points)
    - Validate Smart Money contradiction penalty (-20 points)
    - Verify hidden divergence integration (+12/+14 points)
    - Generate strategy validation report
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ]* 8.2 Write property test for strategy strengthening rules
    - **Property 12: Strategy Strengthening Rules**
    - **Validates: Requirements 7.1, 7.3, 7.4**
    - Generate strategy inputs with varying factor counts and ADX values
    - Verify multipliers are correctly applied (0.7x choppy, 1.2x strong trend)
    - Verify minimum factor requirement enforcement

  - [ ]* 8.3 Write unit tests for strategy validator
    - Test factor counting logic
    - Test ADX multiplier application
    - Test Smart Money integration
    - _Requirements: 7.1, 7.3, 7.4, 7.5, 7.6_

- [ ] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement gap detection and resolution system
  - [ ] 10.1 Create Gap_Resolver in `lib/audit/gap-resolver.ts`
    - Implement gap pattern matching for common gap types
    - Create fix generation templates for missing calculations
    - Implement impact analysis for proposed fixes
    - Add rollback mechanism using Git-based approach
    - Generate gap resolution report
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ] 10.2 Implement static analysis for gap detection
    - Use TypeScript Compiler API to parse production code
    - Detect missing indicator calculations
    - Identify inconsistent indicator weighting
    - Find missing error handling patterns
    - Detect incomplete real-time update logic
    - Identify missing test coverage
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 10.3 Write unit tests for Gap_Resolver
    - Test gap pattern matching
    - Test fix generation
    - Test impact analysis
    - Test rollback mechanism
    - _Requirements: 5.6, 5.7, 5.8_

- [ ] 11. Implement real-time data flow validation
  - [ ] 11.1 Create real-time flow validator in `lib/audit/realtime-validator.ts`
    - Verify Real_Time_Flow price updates for visible symbols
    - Validate approximateRsi correctness
    - Validate approximateEma correctness
    - Verify live strategy score recalculation
    - Validate signal tag re-derivation
    - Verify Terminal UI update propagation
    - Validate viewport-aware optimization
    - Generate real-time flow validation report
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ]* 11.2 Write unit tests for real-time flow validator
    - Test price update detection
    - Test approximation accuracy validation
    - Test viewport optimization verification
    - _Requirements: 6.1, 6.2, 6.3, 6.7_

- [ ] 12. Implement robustness validation
  - [ ] 12.1 Create robustness validator in `lib/audit/robustness-validator.ts`
    - Verify indicator calculations handle insufficient data gracefully
    - Validate finite value checks for all numeric operations
    - Verify zero denominator checks before division
    - Validate array bounds checking
    - Verify API endpoint error handling
    - Validate request cancellation via AbortSignal
    - Verify caching mechanism expiration and cleanup
    - Generate robustness validation report
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [ ]* 12.2 Write unit tests for robustness validator
    - Test edge case detection
    - Test error handling verification
    - Test resource cleanup validation
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement multi-asset class calibration validation
  - [ ] 14.1 Create asset calibration validator in `lib/audit/asset-validator.ts`
    - Verify RSI zones for each asset class
    - Validate volatility multipliers in VWAP calculations
    - Verify asset-specific macro context for Metals
    - Validate CCI calculation and integration for Metals
    - Verify Forex-specific formatting (5 decimals, pip-based display)
    - Validate market state indicators (REGULAR, CLOSED, PRE, POST)
    - Verify asset-specific logic isolation
    - Generate asset calibration report
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [ ]* 14.2 Write unit tests for asset calibration validator
    - Test RSI zone detection per asset class
    - Test volatility multiplier application
    - Test asset-specific context generation
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 15. Implement signal synchronization validation
  - [ ] 15.1 Create signal sync validator in `lib/audit/sync-validator.ts`
    - Verify Redis HINCRBY atomic increment operations
    - Validate rate limiting (1-minute cooldown per user/IP)
    - Verify calibrating status when Redis unavailable
    - Validate win rate calculation correctness
    - Verify Terminal display of global win rates
    - Validate signal outcome evaluation logic
    - Verify win rate data persistence
    - Generate signal tracking validation report
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [ ]* 15.2 Write property test for signal sync increment atomicity
    - **Property 13: Signal Sync Increment Atomicity**
    - **Validates: Requirements 10.1**
    - Simulate concurrent sync requests (requires Redis mock)
    - Verify final counts match expected sum

  - [ ]* 15.3 Write property test for win rate calculation correctness
    - **Property 14: Win Rate Calculation Correctness**
    - **Validates: Requirements 10.4**
    - Generate random win/evaluated count pairs
    - Verify percentage calculation and [0, 100] range

  - [ ]* 15.4 Write unit tests for signal sync validator
    - Test rate limiting enforcement
    - Test fallback behavior
    - Test win rate display validation
    - _Requirements: 10.2, 10.3, 10.5_

- [ ] 16. Implement performance and scalability validation
  - [ ] 16.1 Create performance validator in `lib/audit/performance-validator.ts`
    - Verify thundering herd prevention (pending fetch deduplication)
    - Validate session caching (30s TTL)
    - Verify rate limiting (40 req/10s authenticated, 12 req/10s anonymous)
    - Validate viewport-aware rendering optimization
    - Verify indicator calculation efficiency and caching
    - Validate real-time update approximation algorithms
    - Verify 500-coin fetch within 60-second timeout
    - Generate performance validation report
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

  - [ ]* 16.2 Write unit tests for performance validator
    - Test thundering herd prevention logic
    - Test session cache TTL enforcement
    - Test rate limit bucket management
    - _Requirements: 11.1, 11.2, 11.3_

- [ ] 17. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Implement comprehensive reporting system
  - [ ] 18.1 Create Validation_Reporter in `lib/audit/validation-reporter.ts`
    - Implement `generateReport()` for comprehensive audit report
    - Implement `generateWorkflowDiagram()` for Mermaid diagrams
    - Implement `generateGapAnalysis()` for gap documentation
    - Implement `generateRecommendations()` for future enhancements
    - Add Markdown formatting utilities
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

  - [ ] 18.2 Create report templates in `lib/audit/templates/`
    - Create workflow diagram template
    - Create settings validation report template
    - Create signal accuracy report template
    - Create narrator validation report template
    - Create gap analysis report template
    - Create recommendations template
    - _Requirements: 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [ ]* 18.3 Write unit tests for Validation_Reporter
    - Test report generation logic
    - Test Mermaid diagram generation
    - Test Markdown formatting
    - _Requirements: 12.1, 12.2, 12.8_

- [ ] 19. Implement CLI interface for audit execution
  - [x] 19.1 Create CLI entry point in `lib/audit/cli.ts`
    - Implement command-line argument parsing
    - Add audit execution orchestration
    - Implement progress reporting
    - Add report output to file system
    - Support read-only mode flag
    - Support module selection flags
    - Support verbose logging flag
    - _Requirements: 1.1, 12.1_

  - [ ]* 19.2 Write integration tests for CLI
    - Test full audit execution
    - Test read-only mode enforcement
    - Test module selection
    - Test report generation
    - _Requirements: 1.1, 12.1_

- [ ] 20. Integration and wiring
  - [ ] 20.1 Wire all audit components together
    - Connect Audit_Engine to all validators
    - Connect Gap_Resolver to static analysis
    - Connect Validation_Reporter to all report generators
    - Integrate Property_Test_Suite with all property tests
    - Add comprehensive error handling and recovery
    - _Requirements: 1.1, 5.1, 12.1_

  - [ ]* 20.2 Write end-to-end integration tests
    - Test complete audit workflow execution
    - Test multi-module coordination
    - Test report generation pipeline
    - Test error isolation and recovery
    - _Requirements: 1.1, 12.1_

- [ ] 21. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 22. Create comprehensive documentation
  - [ ] 22.1 Create audit system documentation in `docs/audit-system.md`
    - Document audit architecture and components
    - Document property-based testing approach
    - Document gap detection and resolution process
    - Document CLI usage and options
    - Document report interpretation
    - _Requirements: 12.1, 12.2, 12.7_

  - [ ] 22.2 Create property test documentation in `docs/property-tests.md`
    - Document all 15 correctness properties
    - Document test strategies and generators
    - Document how to add new property tests
    - Document troubleshooting failed property tests
    - _Requirements: 12.4, 12.7_

  - [ ] 22.3 Create gap resolution guide in `docs/gap-resolution.md`
    - Document common gap patterns
    - Document fix generation process
    - Document impact analysis methodology
    - Document rollback procedures
    - _Requirements: 12.6, 12.7_

  - [ ] 22.4 Update main README with audit system section
    - Add audit system overview
    - Add quick start guide
    - Add link to detailed documentation
    - _Requirements: 12.1, 12.7_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (15 total)
- Unit tests validate specific behaviors and edge cases
- All audit components are non-invasive and run independently from production code
- The audit system uses TypeScript with Vitest and fast-check for comprehensive testing
- All fixes generated by Gap_Resolver are modular, reversible, and require manual approval
- The implementation follows an 8-week phased approach with clear milestones

## Success Criteria

The implementation is complete when:
1. All 15 correctness properties pass with 100+ iterations each
2. All audit modules execute successfully and generate reports
3. Gap detection identifies and documents all implementation gaps
4. Comprehensive audit report is generated with workflow diagrams
5. CLI interface allows easy audit execution with configurable options
6. All documentation is complete and accurate
7. Zero production system interference or degradation observed
