# Requirements Document

## Introduction

This document specifies requirements for a comprehensive audit and enhancement of the signal generation workflow across all modules in the RSIQ Pro trading application. The system currently includes terminal outputs, narrator logic, real-time dataflow, indicator calculations, strategy scoring, and signal synchronization. This audit will verify end-to-end workflow integrity, identify gaps, and implement institutional-grade improvements to signal accuracy, narrative clarity, and system robustness.

## Glossary

- **Signal_Generation_System**: The complete pipeline that produces trading signals (Buy, Strong Buy, Sell, Strong Sell, Oversold, Overbought) from market data
- **Terminal**: The primary user interface component displaying the screener dashboard with real-time signal data
- **Narrator**: The Signal Narration Engine™ that generates institutional-grade, human-readable explanations for strategy signals
- **Screener_Service**: Backend service that fetches market data, calculates indicators, and produces screener entries
- **Strategy_Scorer**: The computeStrategyScore function that weighs multiple indicators to produce composite buy/sell scores
- **Indicator_Calculator**: Collection of functions that compute technical indicators (RSI, MACD, EMA, Bollinger Bands, etc.)
- **Signal_Sync_API**: Redis-backed API endpoint that aggregates global win rates across devices
- **Real_Time_Flow**: WebSocket or polling-based live price updates and indicator recalculations
- **Default_Settings**: Global configuration values for indicator periods, thresholds, and signal parameters
- **Institutional_Grade**: Meeting professional trading standards for accuracy, consistency, reproducibility, and robustness

## Requirements

### Requirement 1: End-to-End Workflow Verification

**User Story:** As a system administrator, I want to verify the complete signal generation pipeline from data ingestion to terminal display, so that I can confirm all components are correctly wired and functioning.

#### Acceptance Criteria

1. WHEN the audit is initiated, THE Audit_Engine SHALL trace the complete data flow from market data fetch through indicator calculation to terminal display
2. THE Audit_Engine SHALL verify that the Screener_Service correctly fetches kline data from all configured exchanges (Binance, Bybit, Bybit-linear)
3. THE Audit_Engine SHALL confirm that all Indicator_Calculator functions receive valid input data and produce finite numeric outputs
4. THE Audit_Engine SHALL validate that the Strategy_Scorer correctly integrates all enabled indicators according to their configured weights
5. THE Audit_Engine SHALL verify that the Narrator generates narration for all non-neutral signals with conviction scores and supporting reasons
6. THE Audit_Engine SHALL confirm that the Terminal correctly displays all signal components (signal tags, strategy badges, narration modals)
7. THE Audit_Engine SHALL validate that the Signal_Sync_API correctly aggregates and retrieves global win rate statistics
8. THE Audit_Engine SHALL produce a comprehensive workflow verification report documenting all validated components and any detected issues

### Requirement 2: Default Settings and Global Options Validation

**User Story:** As a system administrator, I want to verify that all default settings and global options are correctly applied throughout the system, so that users receive consistent and predictable signal behavior.

#### Acceptance Criteria

1. THE Audit_Engine SHALL verify that RSI_DEFAULTS (overbought: 80, oversold: 20) are correctly applied in all signal derivation functions
2. THE Audit_Engine SHALL confirm that INDICATOR_DEFAULTS for all technical indicators match their usage in the Strategy_Scorer
3. THE Audit_Engine SHALL validate that asset-specific RSI zones (Crypto: 20/80, Forex: 25/75, Metal: 22/78) are correctly applied based on market classification
4. THE Audit_Engine SHALL verify that global indicator enable/disable flags are respected in strategy scoring calculations
5. THE Audit_Engine SHALL confirm that custom per-symbol configurations correctly override global defaults when present
6. THE Audit_Engine SHALL validate that volatility multipliers for different asset classes (Forex: 5.0, Index/Stocks: 2.5, Metal: 1.5, Crypto: 1.0) are correctly applied
7. THE Audit_Engine SHALL verify that all threshold values (volume spike, long candle, overbought/oversold) are consistently applied across all calculation contexts
8. THE Audit_Engine SHALL produce a settings validation report documenting all verified configurations and any inconsistencies

### Requirement 3: Signal Accuracy and Consistency Verification

**User Story:** As a trader, I want all signals to be accurate, consistent, and reproducible, so that I can trust the system's recommendations for trading decisions.

#### Acceptance Criteria

1. THE Audit_Engine SHALL verify that all RSI calculations produce values between 0 and 100 for all timeframes (1m, 5m, 15m, 1h)
2. THE Audit_Engine SHALL confirm that MACD histogram values are correctly normalized using ATR when available, falling back to price-relative scaling
3. THE Audit_Engine SHALL validate that Bollinger Band positions are clamped to [0, 1] range to handle outliers beyond the bands
4. THE Audit_Engine SHALL verify that all indicator calculations handle edge cases (insufficient data, null values, zero division) without producing NaN or Infinity
5. THE Audit_Engine SHALL confirm that strategy scores are always clamped between -100 and +100
6. THE Audit_Engine SHALL validate that signal classifications (strong-buy, buy, neutral, sell, strong-sell) are consistently derived from strategy scores using the same thresholds
7. THE Audit_Engine SHALL verify that real-time indicator updates (via approximateRsi, approximateEma) maintain mathematical consistency with full recalculations
8. THE Audit_Engine SHALL produce a signal accuracy report with test cases covering all indicator combinations and edge cases

### Requirement 4: Narrator Logic Enhancement and Validation

**User Story:** As a trader, I want signal narratives to be clear, credible, and actionable, so that I can understand the reasoning behind each signal and make informed decisions.

#### Acceptance Criteria

1. THE Narrator SHALL generate narratives for all non-neutral strategy signals with headline, reasons array, conviction score, conviction label, and emoji
2. THE Narrator SHALL calculate conviction scores using the institutional algorithm: (|netBias| / maxPossible) * 100 * scaleFactor + confluenceBonus
3. THE Narrator SHALL apply pillar confluence bonuses (12 points per pillar after the first) when multiple analytical pillars (momentum, trend, structure, liquidity, volatility) are activated
4. THE Narrator SHALL include asset-specific macro context for Metal-classified assets (Gold, Silver, Oil, Gas, Copper) with relevant economic drivers
5. THE Narrator SHALL integrate all available indicators (RSI multi-TF, EMA cross, MACD, Bollinger Bands, Stochastic RSI, divergence, volume spike, VWAP, ADX, confluence, OBV, Williams %R, hidden divergence, market regime, ATR risk parameters, Fibonacci levels, FVG/momentum gaps)
6. THE Narrator SHALL format all numeric values with appropriate precision (RSI: 1 decimal, prices: dynamic based on magnitude, percentages: 2 decimals)
7. THE Narrator SHALL generate shareable one-line summaries with emoji, headline, top reason, and conviction for viral social sharing
8. THE Audit_Engine SHALL validate that all narration components are present and correctly formatted for a representative sample of signals

### Requirement 5: Gap Detection and Intelligent Resolution

**User Story:** As a system administrator, I want the audit to identify any remaining gaps in entry flow, signal logic, or strategy execution, so that I can ensure the system is complete and production-ready.

#### Acceptance Criteria

1. WHEN the audit detects missing indicator calculations, THE Gap_Resolver SHALL implement the missing calculations following the established patterns in the Indicator_Calculator
2. WHEN the audit detects inconsistent indicator weighting, THE Gap_Resolver SHALL standardize weights according to institutional best practices and document the rationale
3. WHEN the audit detects missing error handling, THE Gap_Resolver SHALL add appropriate null checks, finite value validation, and fallback logic
4. WHEN the audit detects incomplete real-time update logic, THE Gap_Resolver SHALL implement missing approximation functions for live indicator shadowing
5. WHEN the audit detects missing test coverage, THE Gap_Resolver SHALL generate property-based tests for critical calculation functions
6. THE Gap_Resolver SHALL document each fix with rationale, impact analysis, and verification steps
7. THE Gap_Resolver SHALL ensure all fixes are modular, testable, and reversible without disrupting existing architecture
8. THE Gap_Resolver SHALL produce a gap resolution report documenting all identified gaps, implemented fixes, and verification results

### Requirement 6: Real-Time Data Flow Validation

**User Story:** As a trader, I want real-time price updates to correctly trigger indicator recalculations and signal updates, so that I always see current market conditions.

#### Acceptance Criteria

1. THE Audit_Engine SHALL verify that the Real_Time_Flow correctly updates prices for all visible symbols in the viewport
2. THE Audit_Engine SHALL confirm that approximateRsi correctly updates RSI values using the stored RSI state and new price ticks
3. THE Audit_Engine SHALL validate that approximateEma correctly updates EMA values using the exponential smoothing formula
4. THE Audit_Engine SHALL verify that live strategy scores are recalculated when any input indicator changes
5. THE Audit_Engine SHALL confirm that signal tags (oversold, overbought, neutral) are re-derived when RSI values update
6. THE Audit_Engine SHALL validate that the Terminal UI reflects all real-time updates with appropriate visual feedback (flash animations, color changes)
7. THE Audit_Engine SHALL verify that viewport-aware optimization correctly pauses updates for non-visible rows
8. THE Audit_Engine SHALL produce a real-time flow validation report documenting update latencies and correctness

### Requirement 7: Strategy Indication Strengthening

**User Story:** As a trader, I want strategy indications to be credible and backed by multiple confirming factors, so that I can trust the system's buy/sell recommendations.

#### Acceptance Criteria

1. THE Strategy_Scorer SHALL require a minimum of 4 active factors before producing non-neutral signals
2. THE Strategy_Scorer SHALL apply counter-trend penalties when 1h RSI disagrees with shorter timeframes
3. THE Strategy_Scorer SHALL apply ADX choppy dampening (0.7x multiplier) when ADX is below 18
4. THE Strategy_Scorer SHALL apply ADX strong trend boost (1.2x multiplier) when ADX is above 30 and aligns with the dominant bias
5. THE Strategy_Scorer SHALL integrate Smart Money confirmation boost (+15 points) when Smart Money score aligns with signal direction
6. THE Strategy_Scorer SHALL integrate Smart Money contradiction penalty (-20 points) when Smart Money score opposes signal direction
7. THE Strategy_Scorer SHALL integrate hidden divergence as continuation signals (+12 points for hidden-bullish, +14 points for hidden-bearish)
8. THE Audit_Engine SHALL verify that all strategy strengthening rules are correctly implemented and produce expected score adjustments

### Requirement 8: Institutional-Grade Robustness Validation

**User Story:** As a system administrator, I want the system to handle all edge cases, errors, and extreme market conditions gracefully, so that it maintains reliability under all circumstances.

#### Acceptance Criteria

1. THE Audit_Engine SHALL verify that all indicator calculations handle insufficient data gracefully by returning null without throwing exceptions
2. THE Audit_Engine SHALL confirm that all numeric operations check for finite values and reject NaN or Infinity inputs
3. THE Audit_Engine SHALL validate that all division operations check for zero denominators before dividing
4. THE Audit_Engine SHALL verify that all array access operations check bounds before accessing elements
5. THE Audit_Engine SHALL confirm that all API endpoints implement proper error handling with fallback responses
6. THE Audit_Engine SHALL validate that the Screener_Service implements request cancellation via AbortSignal to prevent resource leaks
7. THE Audit_Engine SHALL verify that all caching mechanisms (session cache, rate limit buckets, pending fetches) implement proper expiration and cleanup
8. THE Audit_Engine SHALL produce a robustness validation report documenting all verified error handling paths and any missing safeguards

### Requirement 9: Multi-Asset Class Calibration Verification

**User Story:** As a trader working across multiple asset classes, I want signals to be calibrated appropriately for each asset type, so that I receive accurate signals for Crypto, Forex, Metals, Indices, and Stocks.

#### Acceptance Criteria

1. THE Audit_Engine SHALL verify that RSI zones are correctly calibrated for each asset class (Crypto: 20/30/70/80, Forex: 25/35/65/75, Metal/Index/Stocks: 22/32/68/78)
2. THE Audit_Engine SHALL confirm that volatility multipliers are correctly applied in VWAP deviation calculations for each asset class
3. THE Audit_Engine SHALL validate that the Narrator includes asset-specific macro context for Metal assets (Gold, Silver, Oil, Gas, Copper)
4. THE Audit_Engine SHALL verify that CCI (Commodity Channel Index) is calculated and integrated for Metal assets with appropriate overbought/oversold thresholds (±100, ±200)
5. THE Audit_Engine SHALL confirm that Forex-specific formatting (5 decimals for pipettes, pip-based indicator display) is correctly applied
6. THE Audit_Engine SHALL validate that market state indicators (REGULAR, CLOSED, PRE, POST) are correctly displayed for non-Crypto assets
7. THE Audit_Engine SHALL verify that all asset-specific logic is properly isolated and does not interfere with other asset classes
8. THE Audit_Engine SHALL produce an asset calibration report documenting all verified asset-specific behaviors

### Requirement 10: Signal Synchronization and Win Rate Tracking Validation

**User Story:** As a trader, I want the system to track signal performance and display global win rates, so that I can assess the system's historical accuracy.

#### Acceptance Criteria

1. THE Audit_Engine SHALL verify that the Signal_Sync_API correctly increments global statistics (total, win5m, win15m, win1h, evaluated5m, evaluated15m, evaluated1h) using Redis HINCRBY
2. THE Audit_Engine SHALL confirm that the Signal_Sync_API implements rate limiting (1-minute cooldown per user/IP) to prevent abuse
3. THE Audit_Engine SHALL validate that the Signal_Sync_API returns calibrating status when Redis is unavailable or statistics are empty
4. THE Audit_Engine SHALL verify that win rate calculations correctly compute percentages from win counts and evaluated counts
5. THE Audit_Engine SHALL confirm that the Terminal displays global win rates with appropriate visual indicators (badges, colors, labels)
6. THE Audit_Engine SHALL validate that signal outcome evaluation correctly determines wins/losses based on price movement thresholds
7. THE Audit_Engine SHALL verify that win rate data is persisted correctly and survives server restarts
8. THE Audit_Engine SHALL produce a signal tracking validation report documenting all verified tracking behaviors and any data integrity issues

### Requirement 11: Performance and Scalability Validation

**User Story:** As a system administrator, I want the signal generation system to perform efficiently under high load, so that it can serve many concurrent users without degradation.

#### Acceptance Criteria

1. THE Audit_Engine SHALL verify that the Screener_Service implements thundering herd prevention using pending fetch deduplication
2. THE Audit_Engine SHALL confirm that session caching reduces database load by caching authentication results for 30 seconds
3. THE Audit_Engine SHALL validate that rate limiting prevents abuse while allowing legitimate burst traffic (40 requests per 10s for authenticated users, 12 for anonymous)
4. THE Audit_Engine SHALL verify that viewport-aware rendering optimizes performance by only updating visible rows
5. THE Audit_Engine SHALL confirm that indicator calculations use efficient algorithms with appropriate caching (LRU cache for kline aggregations)
6. THE Audit_Engine SHALL validate that real-time updates use efficient approximation algorithms rather than full recalculations
7. THE Audit_Engine SHALL verify that the system handles 500-coin fetches within the 60-second timeout limit
8. THE Audit_Engine SHALL produce a performance validation report documenting all verified optimizations and any bottlenecks

### Requirement 12: Documentation and Audit Report Generation

**User Story:** As a system administrator, I want comprehensive documentation of the audit findings and all implemented enhancements, so that I can understand the system's current state and any changes made.

#### Acceptance Criteria

1. THE Audit_Engine SHALL generate a comprehensive audit report including all verification results, identified gaps, and implemented fixes
2. THE Audit_Report SHALL include a workflow diagram showing the complete signal generation pipeline from data ingestion to terminal display
3. THE Audit_Report SHALL document all default settings and global options with their current values and usage locations
4. THE Audit_Report SHALL include test results for signal accuracy, consistency, and reproducibility across all indicator combinations
5. THE Audit_Report SHALL document all narrator enhancements with before/after examples of generated narratives
6. THE Audit_Report SHALL include a gap analysis section documenting all identified gaps, their severity, and resolution status
7. THE Audit_Report SHALL provide recommendations for future enhancements and ongoing maintenance
8. THE Audit_Report SHALL be formatted in Markdown with clear sections, code examples, and visual diagrams where appropriate
