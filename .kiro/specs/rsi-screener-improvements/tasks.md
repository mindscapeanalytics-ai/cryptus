# Implementation Plan: RSI Screener Improvements

## Overview

This implementation plan addresses production-grade improvements to the RSI-based cryptocurrency screener and alert system. The work is organized into focused phases covering data accuracy, alert reliability, performance optimization, user experience enhancements, and infrastructure hardening. Each task builds incrementally on previous work, with property-based tests integrated throughout to validate correctness.

## Tasks

- [x] 1. Set up testing infrastructure and data validation layer
  - [x] 1.1 Install and configure fast-check for property-based testing
    - Add fast-check dependency to package.json
    - Configure test runner (Jest/Vitest) for property tests
    - Set minimum 100 iterations per property test
    - _Requirements: Testing Strategy_
  
  - [x] 1.2 Implement data validation module with OHLC validation
    - Create `lib/data-validator.ts` with validateKline function
    - Implement OHLC relationship checks (Low ≤ Open ≤ High, Low ≤ Close ≤ High)
    - Add NaN/Infinity detection
    - Add zero volume warning
    - _Requirements: 13.1, 13.2, 2.6_
  
  - [ ]* 1.3 Write property tests for data validation
    - **Property 6: OHLC relationship validation**
    - **Property 7: Invalid data rejection**
    - **Property 11: Zero volume handling**
    - **Validates: Requirements 13.1, 13.2, 2.6, 13.3**
  
  - [x] 1.4 Implement outlier detection and gap interpolation
    - Add detectOutliers function (50% threshold)
    - Add interpolateMissingCandles function
    - Add staleness check for Yahoo Finance data
    - _Requirements: 13.4, 13.5, 13.6, 2.5_
  
  - [ ]* 1.5 Write property tests for outlier detection and interpolation
    - **Property 8: Outlier detection**
    - **Property 9: Gap interpolation**
    - **Property 10: Stale data exclusion**
    - **Validates: Requirements 13.4, 13.5, 13.6, 2.5**

- [ ] 2. Enhance Ticker Worker with delta merge and staleness detection
  - [x] 2.1 Implement delta merge logic for Bybit updates
    - Update `public/ticker-worker.js` with mergeDeltaUpdate function
    - Add required field validation (symbol, lastPrice)
    - Implement high/low tracking across updates
    - Add timestamp on every update
    - _Requirements: 1.1, 1.6, 1.7_
  
  - [ ]* 2.2 Write property tests for delta merge
    - **Property 1: Delta merge completeness**
    - **Property 5: Update timestamping**
    - **Validates: Requirements 1.1, 1.6, 1.7**
  
  - [x] 2.3 Implement staleness detection with 60-second timeout
    - Add detectStaleness function to ticker worker
    - Implement periodic staleness check (every 10 seconds)
    - Emit staleness alerts to main thread
    - _Requirements: 1.2_
  
  - [ ]* 2.4 Write property tests for staleness detection
    - **Property 2: Staleness detection accuracy**
    - **Validates: Requirements 1.2**
  
  - [x] 2.5 Add cold-start baseline fetching
    - Fetch most recent kline for each symbol on worker start
    - Store baseline open price and volume in ticker state
    - Use baseline for first-candle RSI calculations
    - _Requirements: 1.4, 1.5_
  
  - [ ]* 2.6 Write property tests for baseline-aware RSI
    - **Property 4: Baseline-aware RSI calculation**
    - **Validates: Requirements 1.5**
  
  - [x] 2.7 Implement REST polling fallback for Bybit Spot (30+ symbols)
    - Add pollBybitSpotPrices function
    - Detect when symbol count exceeds 30
    - Poll at 2-second intervals with rate limit protection
    - _Requirements: 2.1, 2.2_

- [ ] 3. Implement LRU cache for indicator calculations
  - [x] 3.1 Create LRU cache class with 1000-entry limit
    - Create `lib/lru-cache.ts` with LRUCache class
    - Implement get, set, delete, clear methods
    - Implement access order tracking
    - Implement automatic LRU eviction
    - _Requirements: 6.1_
  
  - [ ]* 3.2 Write property tests for LRU cache
    - **Property 19: LRU cache eviction**
    - **Validates: Requirements 6.1**
  
  - [x] 3.3 Integrate LRU cache into screener service
    - Replace time-based TTL cache with LRU cache in `lib/screener-service.ts`
    - Use cache key format: `{symbol}:{exchange}:{timeframe}:{indicator}`
    - Add cache hit/miss metrics
    - _Requirements: 6.1_
  
  - [x] 3.4 Implement zone state cleanup on symbol removal
    - Add cleanup logic in ticker worker when symbols are unsubscribed
    - Remove zone states from memory
    - _Requirements: 6.2_
  
  - [ ]* 3.5 Write property tests for zone state cleanup
    - **Property 20: Zone state cleanup**
    - **Validates: Requirements 6.2**

- [ ] 4. Checkpoint - Verify data accuracy improvements
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement centralized alert coordinator with database-backed cooldown
  - [x] 5.1 Create alert coordinator module
    - Create `lib/alert-coordinator.ts` with AlertCoordinator class
    - Implement getCooldownKey with standardized format
    - Implement checkAndRecordAlert with atomic transaction
    - _Requirements: 3.1, 3.4, 3.6_
  
  - [ ]* 5.2 Write property tests for cooldown key format
    - **Property 12: Cooldown key format consistency**
    - **Property 13: Alert record completeness**
    - **Property 14: Atomic cooldown check**
    - **Validates: Requirements 3.1, 3.4, 3.6**
  
  - [x] 5.3 Implement exchange isolation for zone states
    - Add resetZoneStates function in alert engine
    - Call on exchange switch
    - _Requirements: 1.3_
  
  - [ ]* 5.4 Write property tests for exchange isolation
    - **Property 3: Exchange isolation**
    - **Validates: Requirements 1.3**
  
  - [x] 5.5 Update worker and main thread alert engines to use coordinator
    - Integrate AlertCoordinator into `hooks/use-alert-engine.ts`
    - Integrate AlertCoordinator into ticker worker alert evaluation
    - Remove in-memory cooldown tracking
    - _Requirements: 3.2, 3.3, 3.5_

- [ ] 6. Enhance confluence validation and conditional alert logic
  - [x] 6.1 Implement improved confluence validation
    - Update confluence evaluation in alert engine
    - Require minimum 2 valid (non-null) timeframes
    - Exclude null/undefined indicator values
    - Include agreeing timeframes in metadata
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ]* 6.2 Write property tests for confluence validation
    - **Property 15: Confluence minimum timeframes**
    - **Property 16: Null value exclusion**
    - **Property 17: Confluence metadata completeness**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
  
  - [x] 6.3 Implement custom RSI period support in confluence
    - Read custom periods from CoinConfig
    - Apply custom periods to all timeframes for symbol
    - _Requirements: 5.5_
  
  - [ ]* 6.4 Write property tests for custom period respect
    - **Property 18: Custom period respect**
    - **Validates: Requirements 5.5**
  
  - [x] 6.5 Implement conditional alert evaluation logic
    - Create evaluateConditionalAlert function
    - Support AND/OR logic with up to 5 conditions
    - Support condition types: RSI, volume spike, EMA cross, MACD, BB touch, price change
    - Add validation for indicator availability
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [ ]* 6.6 Write property tests for conditional alerts
    - **Property 27: AND logic evaluation**
    - **Property 28: OR logic evaluation**
    - **Property 29: Conditional validation**
    - **Property 30: Conditional metadata**
    - **Property 31: Conditional cooldown consistency**
    - **Validates: Requirements 9.1, 9.2, 9.4, 9.5, 9.6**

- [ ] 7. Implement push notification service with retry and VAPID singleton
  - [x] 7.1 Create VAPID singleton initialization
    - Create `lib/push-service.ts` with module-level VAPID keys
    - Implement initializeVAPID function (call once on module load)
    - Implement getVAPIDKeys function with validation
    - Add error handling for missing keys
    - _Requirements: 12.1, 12.2, 12.3_
  
  - [ ]* 7.2 Write property tests for VAPID key reuse
    - **Property 43: VAPID key reuse**
    - **Validates: Requirements 12.2**
  
  - [x] 7.3 Implement push notification retry logic
    - Create sendNotificationWithRetry function
    - Implement exponential backoff (1s, 2s, 4s)
    - Add failure logging with subscription details
    - _Requirements: 4.2, 4.3_
  
  - [ ]* 7.4 Write property tests for retry logic
    - **Property 24: Push notification retry**
    - **Validates: Requirements 4.2**
  
  - [x] 7.5 Implement AudioContext resume for mobile
    - Add resumeAudioContext function in alert engine
    - Call before playing alert sounds
    - _Requirements: 4.1_

- [ ] 8. Add priority-based alert handling and quiet hours
  - [x] 8.1 Extend database schema for priority and sound fields
    - Add migration to extend CoinConfig with priority, sound, conditionalLogic, quietHours
    - Add migration to extend AlertLog with priority, metadata
    - Set default values for backward compatibility
    - _Requirements: 14.1, 14.2_
  
  - [x] 8.2 Implement priority-based notification behavior
    - Create getAlertBehavior function mapping priority to sound/persistence
    - Update alert firing to use priority-based behavior
    - _Requirements: 7.2, 7.3_
  
  - [ ]* 8.3 Write property tests for priority behavior
    - **Property 25: Priority-based notification behavior**
    - **Validates: Requirements 7.3**
  
  - [x] 8.4 Implement quiet hours suppression
    - Create shouldSuppressAlert function
    - Check current time against quiet hours config
    - Suppress low/medium priority, allow high/critical
    - _Requirements: 7.4, 7.5_
  
  - [ ]* 8.5 Write property tests for quiet hours
    - **Property 26: Quiet hours suppression**
    - **Validates: Requirements 7.4, 7.5**
  
  - [x] 8.6 Implement custom sound selection
    - Add sound library with predefined alert sounds
    - Update alert firing to use configured sound
    - _Requirements: 7.1_

- [ ] 9. Checkpoint - Verify alert reliability improvements
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement alert template and bulk operations
  - [x] 10.1 Create AlertTemplate database model
    - Add AlertTemplate model to Prisma schema
    - Run migration to create table
    - _Requirements: 7.6_
  
  - [x] 10.2 Implement template creation and application
    - Create `/api/templates` endpoint for CRUD operations
    - Implement applyTemplate function with transaction
    - _Requirements: 7.6, 7.7_
  
  - [ ]* 10.3 Write property tests for template application
    - **Property 32: Template application**
    - **Validates: Requirements 7.7, 10.3**
  
  - [x] 10.4 Implement bulk configuration operations
    - Create bulkUpdate function with transaction
    - Create bulkDelete function with transaction
    - Implement result reporting (success/failure counts)
    - _Requirements: 10.2, 10.3, 10.5, 10.6_
  
  - [ ]* 10.5 Write property tests for bulk operations
    - **Property 33: Bulk operation atomicity**
    - **Property 34: Bulk operation result reporting**
    - **Validates: Requirements 10.2, 10.5, 10.6**

- [ ] 11. Implement alert history management with filtering and export
  - [x] 11.1 Create alert history API with filtering
    - Create `/api/alerts/history` endpoint
    - Implement getAlerts with filter support (symbol, exchange, timeframe, condition, date range)
    - Implement pagination (50 entries per page)
    - _Requirements: 8.1, 8.3_
  
  - [ ]* 11.2 Write property tests for filtering and pagination
    - **Property 35: Filter correctness**
    - **Property 37: Pagination correctness**
    - **Validates: Requirements 8.1, 8.3**
  
  - [x] 11.3 Implement full-text search
    - Add searchAlerts function with text search across messages
    - _Requirements: 8.2_
  
  - [ ]* 11.4 Write property tests for search
    - **Property 36: Search correctness**
    - **Validates: Requirements 8.2**
  
  - [x] 11.5 Implement CSV export
    - Create exportAlerts function generating CSV
    - Include all alert fields in export
    - _Requirements: 8.4_
  
  - [ ]* 11.6 Write property tests for CSV export
    - **Property 38: CSV export completeness**
    - **Validates: Requirements 8.4**
  
  - [x] 11.7 Implement alert statistics
    - Create getStatistics function
    - Calculate counts by condition, priority, symbol
    - Calculate average time between alerts
    - _Requirements: 8.5_
  
  - [ ]* 11.8 Write property tests for statistics
    - **Property 39: Statistics accuracy**
    - **Validates: Requirements 8.5**
  
  - [x] 11.9 Implement bulk delete for alert history
    - Add bulk delete support to history API
    - _Requirements: 8.6_
  
  - [ ]* 11.10 Write property tests for bulk delete
    - **Property 40: Bulk delete completeness**
    - **Validates: Requirements 8.6**

- [ ] 12. Add monitoring, metrics, and health checks
  - [x] 12.1 Create metrics collector module
    - Create `lib/metrics-collector.ts` with MetricsCollector class
    - Implement recordLatency, recordCacheHit, recordAPIWeight, recordAlertFired
    - Implement percentile calculations (p95, p99)
    - _Requirements: 11.2, 11.3, 11.4_
  
  - [ ]* 12.2 Write property tests for metrics collection
    - **Property 42: Metrics collection**
    - **Validates: Requirements 11.2, 11.3, 11.4, 11.5**
  
  - [x] 12.3 Integrate metrics collection throughout system
    - Add metrics to screener service (latency, cache hits, API weight)
    - Add metrics to alert engine (evaluation time, alerts fired)
    - Add metrics to ticker worker (reconnections, connection duration)
    - _Requirements: 11.2, 11.3, 11.5_
  
  - [x] 12.4 Implement error tracking
    - Add recordError function to metrics collector
    - Integrate error tracking in ticker worker
    - Add context to all error reports (symbol, exchange, error type)
    - _Requirements: 11.1_
  
  - [ ]* 12.5 Write property tests for error reporting
    - **Property 41: Error reporting completeness**
    - **Validates: Requirements 11.1**
  
  - [x] 12.6 Create health check endpoint
    - Create `/api/health` endpoint
    - Check database connectivity
    - Check cache status
    - Check VAPID keys
    - Return metrics snapshot
    - _Requirements: 11.6_

- [ ] 13. Implement performance optimizations
  - [x] 13.1 Add batch processing for ticker updates
    - Update ticker worker to process updates in batches of 50
    - Prevent event loop blocking with large update sets
    - _Requirements: 6.4_
  
  - [ ]* 13.2 Write property tests for batch processing
    - **Property 21: Batch processing**
    - **Validates: Requirements 6.4**
  
  - [x] 13.3 Implement API weight tracking and backoff
    - Add weight tracking to screener service
    - Implement exponential backoff on rate limits
    - Add jitter to backoff delays
    - _Requirements: 2.3, 2.4_
  
  - [ ]* 13.4 Write property tests for weight tracking and backoff
    - **Property 22: API weight tracking**
    - **Property 23: Exponential backoff**
    - **Validates: Requirements 2.3, 2.4**

- [ ] 14. Add backward compatibility and multi-instance support
  - [x] 14.1 Implement legacy configuration handling
    - Add default value logic for missing priority/sound fields
    - Support both old and new cooldown key formats during transition
    - _Requirements: 14.2, 14.3_
  
  - [ ]* 14.2 Write property tests for backward compatibility
    - **Property 44: Legacy configuration defaults**
    - **Validates: Requirements 14.2**
  
  - [x] 14.3 Add instance isolation for cache keys
    - Include instance identifier in cache key format
    - Prevent cross-instance cache conflicts
    - _Requirements: 15.3_
  
  - [ ]* 14.4 Write property tests for cache key isolation
    - **Property 45: Cache key instance isolation**
    - **Validates: Requirements 15.3**

- [x] 15. Update UI components for new features
  - [x] 15.1 Add priority and sound selection to alert configuration UI
    - Update `components/screener-dashboard.tsx` with priority dropdown
    - Add sound selection dropdown
    - _Requirements: 7.1, 7.2_
  
  - [x] 15.2 Add quiet hours configuration UI
    - Create quiet hours time range picker
    - Add priority suppression checkboxes
    - _Requirements: 7.4, 7.5_
  
  - [x] 15.3 Add conditional alert builder UI
    - Create condition builder with AND/OR logic selector
    - Add condition type dropdowns (RSI, volume, EMA, etc.)
    - Add operator and value inputs
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [x] 15.4 Add template management UI
    - Create template list view
    - Add template creation/edit form
    - Add template application to selected symbols
    - _Requirements: 7.6, 7.7_
  
  - [x] 15.5 Add bulk operations UI
    - Add multi-select checkbox to symbol rows
    - Add bulk action buttons (Enable, Disable, Delete, Apply Template)
    - Show operation result summary
    - _Requirements: 10.2, 10.3, 10.4, 10.5_
  
  - [x] 15.6 Add alert history UI
    - Create alert history page with filters
    - Add search bar for full-text search
    - Add pagination controls
    - Add CSV export button
    - Add statistics dashboard
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 16. Final checkpoint and integration testing
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation maintains backward compatibility with existing configurations
- All database changes use Prisma migrations to preserve existing data
