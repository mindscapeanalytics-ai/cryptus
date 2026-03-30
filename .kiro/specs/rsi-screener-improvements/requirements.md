# Requirements Document: RSI Screener Improvements

## Introduction

This document specifies requirements for improving an existing RSI-based cryptocurrency screener and alert system to production-grade reliability. The system currently monitors 600+ symbols across multiple exchanges (Binance, Bybit) with real-time WebSocket updates, technical indicator calculations, and multi-channel alerting. The improvements focus on data accuracy, alert reliability, performance optimization, and infrastructure hardening while maintaining backward compatibility with existing user configurations.

## Glossary

- **Screener_Service**: Backend service that fetches cryptocurrency data and calculates technical indicators
- **Ticker_Worker**: SharedWorker/Worker that manages WebSocket connections for real-time price streaming
- **Alert_Engine**: Client-side and worker-side system that evaluates alert conditions and triggers notifications
- **Zone_State**: Tracking mechanism for alert hysteresis (whether RSI is currently above/below threshold)
- **Cooldown_Period**: 3-minute window after an alert fires to prevent duplicate notifications
- **Confluence**: Multiple timeframes agreeing on the same signal (e.g., RSI < 30 on 1m, 5m, 15m)
- **Kline**: Candlestick data (OHLCV - Open, High, Low, Close, Volume) for a specific timeframe
- **VAPID**: Voluntary Application Server Identification for Web Push protocol
- **Hysteresis**: Mechanism to prevent alert flipping when price oscillates around threshold
- **Delta_Update**: Partial data update containing only changed fields (Bybit WebSocket format)
- **Rate_Limit_Weight**: API request cost tracking for exchange rate limit compliance
- **Cold_Start**: Initial state when worker/service starts without cached data
- **Stale_Price**: Price data that hasn't updated within expected timeframe
- **LRU_Cache**: Least Recently Used cache eviction strategy

## Requirements

### Requirement 1: Real-Time Data Accuracy

**User Story:** As a trader, I want accurate real-time price and indicator data, so that I can trust the alerts and make informed trading decisions.

#### Acceptance Criteria

1. WHEN Bybit sends delta updates, THE Ticker_Worker SHALL merge them with previous ticker state to maintain complete data
2. WHEN a symbol has not received price updates for 60 seconds, THE Ticker_Worker SHALL mark the price as stale and request fresh data
3. WHEN switching between exchanges, THE Alert_Engine SHALL reset Zone_State for all symbols to prevent cross-exchange state bleeding
4. WHEN the Ticker_Worker starts, THE Ticker_Worker SHALL fetch the most recent kline for each symbol to establish accurate baseline open price and volume
5. WHEN calculating RSI approximations, THE Alert_Engine SHALL use the established baseline to ensure first-candle accuracy
6. WHEN merging delta updates, THE Ticker_Worker SHALL validate that required fields (symbol, lastPrice) are present before updating state
7. WHEN a price update is received, THE Ticker_Worker SHALL timestamp the update for staleness detection

### Requirement 2: Exchange-Specific Data Handling

**User Story:** As a system operator, I want proper handling of exchange-specific data formats, so that the system works reliably across all supported exchanges.

#### Acceptance Criteria

1. WHEN subscribing to Bybit Spot symbols, THE Ticker_Worker SHALL implement REST polling fallback for symbols beyond the 30-symbol WebSocket limit
2. WHEN Bybit Spot REST polling is active, THE Ticker_Worker SHALL poll at 2-second intervals to maintain near-real-time updates
3. WHEN rate limits are approached, THE Screener_Service SHALL implement exponential backoff with jitter for kline fetching
4. WHEN fetching klines in batches, THE Screener_Service SHALL track API weight consumption and pause when approaching limits
5. WHEN Yahoo Finance data is stale or missing, THE Screener_Service SHALL log warnings and exclude affected symbols from results
6. WHEN kline data contains invalid values (null, NaN, negative volume), THE Screener_Service SHALL reject the data and log validation errors

### Requirement 3: Alert Deduplication and Coordination

**User Story:** As a trader, I want to receive each alert exactly once, so that I am not overwhelmed by duplicate notifications.

#### Acceptance Criteria

1. WHEN an alert condition is met, THE Alert_Engine SHALL use a standardized cooldown key format: `{symbol}:{exchange}:{timeframe}:{condition}`
2. WHEN the worker-side Alert_Engine fires an alert, THE Alert_Engine SHALL communicate the cooldown key to the main thread to prevent duplicate firing
3. WHEN the main thread Alert_Engine evaluates conditions, THE Alert_Engine SHALL check both local and worker-communicated cooldown states
4. WHEN the cron job evaluates alerts, THE Alert_Engine SHALL query the AlertLog database with the standardized cooldown key format
5. WHEN multiple alert channels (worker, main, cron) are active, THE Alert_Engine SHALL ensure only one channel fires per cooldown period
6. WHEN an alert fires, THE Alert_Engine SHALL record the alert in AlertLog with timestamp, symbol, exchange, timeframe, and condition type

### Requirement 4: Mobile Alert Reliability

**User Story:** As a mobile trader, I want alerts to work reliably when the app is backgrounded, so that I don't miss trading opportunities.

#### Acceptance Criteria

1. WHEN the AudioContext is suspended due to inactivity, THE Alert_Engine SHALL resume the AudioContext before playing alert sounds
2. WHEN a push notification fails to send, THE Alert_Engine SHALL retry up to 3 times with exponential backoff (1s, 2s, 4s)
3. WHEN push notification retries are exhausted, THE Alert_Engine SHALL log the failure with subscription details for debugging
4. WHEN the service worker receives a push event, THE Service_Worker SHALL display the notification even if the main app is closed
5. WHEN the Wake Lock is released by the system, THE Alert_Engine SHALL attempt to reacquire it and log the event
6. WHEN the app is backgrounded on mobile, THE Ticker_Worker SHALL continue processing WebSocket updates via SharedWorker

### Requirement 5: Confluence Validation

**User Story:** As a trader, I want confluence alerts to only fire when multiple timeframes genuinely agree, so that I receive high-quality signals.

#### Acceptance Criteria

1. WHEN evaluating confluence conditions, THE Alert_Engine SHALL require at least 2 timeframes to have valid (non-null) indicator values
2. WHEN a timeframe has null or undefined indicator values, THE Alert_Engine SHALL exclude it from confluence calculation
3. WHEN fewer than 2 timeframes have valid values, THE Alert_Engine SHALL not trigger confluence alerts
4. WHEN confluence is detected, THE Alert_Engine SHALL include the list of agreeing timeframes in the alert message
5. WHEN custom RSI periods are configured, THE Alert_Engine SHALL use those periods for confluence evaluation on the respective timeframes

### Requirement 6: Performance and Scalability

**User Story:** As a system operator, I want the system to handle 600+ symbols efficiently, so that it remains responsive and cost-effective.

#### Acceptance Criteria

1. WHEN the indicator cache exceeds 1000 entries, THE Screener_Service SHALL implement LRU eviction to remove least recently used entries
2. WHEN symbols are removed from monitoring, THE Ticker_Worker SHALL clean up associated Zone_State entries to prevent memory leaks
3. WHEN calculating indicators for multiple symbols, THE Screener_Service SHALL reuse calculation functions to minimize memory allocation
4. WHEN the Ticker_Worker receives updates for 600+ symbols, THE Ticker_Worker SHALL process updates in batches of 50 to prevent event loop blocking
5. WHEN IndexedDB persistence is used, THE Ticker_Worker SHALL debounce writes to occur at most once per 5 seconds per symbol
6. WHEN multiple Vercel instances are running, THE Alert_Engine SHALL use database-backed cooldown tracking to coordinate across instances

### Requirement 7: Alert Configuration Enhancements

**User Story:** As a trader, I want flexible alert configuration options, so that I can customize alerts to my trading strategy.

#### Acceptance Criteria

1. WHEN configuring an alert, THE Alert_Engine SHALL support custom alert sounds selected from a predefined library
2. WHEN configuring an alert, THE Alert_Engine SHALL support priority levels (Low, Medium, High, Critical) that affect notification behavior
3. WHEN a High or Critical priority alert fires, THE Alert_Engine SHALL use a more prominent sound and persistent notification
4. WHEN configuring quiet hours, THE Alert_Engine SHALL suppress Low and Medium priority alerts during the specified time range
5. WHEN quiet hours are active, THE Alert_Engine SHALL still fire High and Critical priority alerts
6. WHEN creating alert templates, THE Alert_Engine SHALL allow saving a configuration set that can be applied to multiple symbols
7. WHEN applying a template to symbols, THE Alert_Engine SHALL create individual CoinConfig entries with the template settings

### Requirement 8: Alert History and Management

**User Story:** As a trader, I want to search and analyze my alert history, so that I can evaluate strategy effectiveness.

#### Acceptance Criteria

1. WHEN viewing alert history, THE Alert_Engine SHALL support filtering by symbol, exchange, timeframe, condition type, and date range
2. WHEN viewing alert history, THE Alert_Engine SHALL support full-text search across alert messages
3. WHEN viewing alert history, THE Alert_Engine SHALL display alerts in paginated format with 50 entries per page
4. WHEN exporting alert history, THE Alert_Engine SHALL generate CSV files with all alert details and metadata
5. WHEN viewing alert statistics, THE Alert_Engine SHALL display counts by condition type, success rate, and average time between alerts
6. WHEN bulk deleting alerts, THE Alert_Engine SHALL support selecting multiple entries and deleting them in a single operation

### Requirement 9: Conditional Alert Logic

**User Story:** As a trader, I want to combine multiple conditions in alerts, so that I can create sophisticated trading signals.

#### Acceptance Criteria

1. WHEN configuring conditional alerts, THE Alert_Engine SHALL support AND logic combining up to 5 conditions
2. WHEN configuring conditional alerts, THE Alert_Engine SHALL support OR logic combining up to 5 conditions
3. WHEN evaluating conditional alerts, THE Alert_Engine SHALL support conditions: RSI thresholds, volume spikes, EMA crosses, MACD signals, Bollinger Band touches, price change percentage
4. WHEN a conditional alert is configured, THE Alert_Engine SHALL validate that all referenced indicators are available for the selected timeframe
5. WHEN a conditional alert fires, THE Alert_Engine SHALL include which specific conditions were met in the alert message
6. WHEN conditional alerts are evaluated, THE Alert_Engine SHALL apply the same cooldown and hysteresis rules as simple alerts

### Requirement 10: Bulk Configuration Operations

**User Story:** As a trader managing many symbols, I want to apply settings to multiple coins at once, so that I can configure alerts efficiently.

#### Acceptance Criteria

1. WHEN selecting multiple symbols in the dashboard, THE Alert_Engine SHALL enable bulk action buttons (Enable, Disable, Delete, Apply Template)
2. WHEN applying bulk enable/disable, THE Alert_Engine SHALL update all selected CoinConfig entries in a single database transaction
3. WHEN applying a template to multiple symbols, THE Alert_Engine SHALL create or update CoinConfig entries for all selected symbols
4. WHEN bulk deleting configurations, THE Alert_Engine SHALL prompt for confirmation and delete all selected entries
5. WHEN bulk operations complete, THE Alert_Engine SHALL display a summary showing success count and any failures
6. WHEN bulk operations fail partially, THE Alert_Engine SHALL roll back the transaction and report which symbols failed

### Requirement 11: Infrastructure Monitoring

**User Story:** As a system operator, I want visibility into system health and performance, so that I can proactively address issues.

#### Acceptance Criteria

1. WHEN errors occur in the Ticker_Worker, THE Ticker_Worker SHALL report errors to a centralized error tracking service with context (symbol, exchange, error type)
2. WHEN the Screener_Service fetches data, THE Screener_Service SHALL record metrics: latency, cache hit rate, API weight consumed, symbols processed
3. WHEN the Alert_Engine evaluates conditions, THE Alert_Engine SHALL record metrics: evaluation time, alerts fired, cooldowns active, confluence detections
4. WHEN the cron job runs, THE Cron_Job SHALL record execution time, symbols checked, alerts fired, and any errors encountered
5. WHEN WebSocket connections experience issues, THE Ticker_Worker SHALL record reconnection attempts, backoff delays, and connection duration
6. WHEN the system starts, THE System SHALL expose a health check endpoint returning: worker status, database connectivity, cache status, active subscriptions

### Requirement 12: VAPID Key Management

**User Story:** As a system operator, I want efficient VAPID key handling, so that push notifications are reliable and performant.

#### Acceptance Criteria

1. WHEN the push notification module loads, THE System SHALL initialize VAPID keys once as a module-level singleton
2. WHEN sending push notifications, THE System SHALL reuse the initialized VAPID keys rather than recreating them per request
3. WHEN VAPID keys are missing or invalid, THE System SHALL log a critical error and prevent push notification registration
4. WHEN the environment changes (development to production), THE System SHALL validate that VAPID keys are properly configured for the environment

### Requirement 13: Data Quality Validation

**User Story:** As a trader, I want the system to handle data anomalies gracefully, so that false alerts are minimized.

#### Acceptance Criteria

1. WHEN kline data is received, THE Screener_Service SHALL validate that OHLC values satisfy: Low ≤ Open ≤ High, Low ≤ Close ≤ High
2. WHEN kline data contains volume = 0, THE Screener_Service SHALL accept the data but flag volume-based indicators as unreliable
3. WHEN calculating indicators produces NaN or Infinity, THE Screener_Service SHALL log the error, exclude the symbol from results, and continue processing other symbols
4. WHEN price changes exceed 50% in a single candle, THE Screener_Service SHALL flag the data as a potential outlier and require confirmation from multiple sources
5. WHEN consecutive klines have gaps (missing timestamps), THE Screener_Service SHALL interpolate missing candles using the last known close price
6. WHEN Yahoo Finance returns stale data (timestamp > 1 hour old), THE Screener_Service SHALL exclude the symbol and log a warning

### Requirement 14: Backward Compatibility

**User Story:** As an existing user, I want my current alert configurations to continue working, so that I don't lose my setup during the upgrade.

#### Acceptance Criteria

1. WHEN the system upgrades, THE System SHALL migrate existing CoinConfig entries to include new fields with sensible defaults (priority: Medium, sound: default, conditions: null)
2. WHEN evaluating alerts with legacy configurations, THE Alert_Engine SHALL treat missing priority as Medium and missing sound as default
3. WHEN the new cooldown key format is introduced, THE Alert_Engine SHALL check both old and new formats during the transition period
4. WHEN new features are added, THE System SHALL ensure existing API endpoints maintain their current response format with new fields added as optional
5. WHEN database schema changes occur, THE System SHALL use Prisma migrations that preserve existing data

### Requirement 15: Horizontal Scaling Support

**User Story:** As a system operator, I want the system to work correctly with multiple instances, so that it can scale with user growth.

#### Acceptance Criteria

1. WHEN multiple Vercel instances are running, THE Alert_Engine SHALL use database-backed AlertLog for cooldown coordination rather than in-memory state
2. WHEN the cron job runs, THE Cron_Job SHALL use database locks or timestamps to ensure only one instance processes alerts at a time
3. WHEN cache invalidation occurs, THE System SHALL use a cache key format that includes instance-specific data to prevent cross-instance conflicts
4. WHEN WebSocket connections are established, THE Ticker_Worker SHALL run in the browser (not server-side) to avoid connection duplication across instances
5. WHEN push notifications are sent, THE System SHALL query the database for active subscriptions rather than maintaining in-memory subscription lists
