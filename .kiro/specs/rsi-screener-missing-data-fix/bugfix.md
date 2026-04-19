# Bugfix Requirements Document

## Introduction

This document defines the requirements for fixing the screener data flow issue where many columns display "-" (NO DATA) in the UI despite logs showing kline data is being fetched successfully. The bug affects multiple indicator columns including VWAP, ADX, MACD, and others, resulting in a degraded user experience where users see "NO DATA" instead of calculated indicator values.

The root causes identified include:
1. VWAP calculation returning null when insufficient intraday data exists
2. ADX calculation returning null when 15m aggregation produces insufficient candles
3. MACD calculation returning null when timeframe aggregation is insufficient
4. `buildEntry` function returning null despite having adequate kline data
5. Insufficient fallback mechanisms for indicator calculations across different timeframes

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN VWAP is calculated with less than 10 minutes of UTC day data AND the 4-hour rolling window fallback also has insufficient data THEN the system returns null for VWAP causing "-" to display in the UI

1.2 WHEN ADX is calculated on 15m aggregated data AND the aggregation produces fewer than 14 candles THEN the system returns null for ADX causing "-" to display in the UI

1.3 WHEN MACD is calculated on 15m aggregated data AND the aggregation produces fewer than 35 candles (26 slow period + 9 signal period) THEN the system returns null for MACD causing "-" to display in the UI

1.4 WHEN Stochastic RSI is calculated on 15m aggregated data AND the aggregation produces fewer than 50 candles THEN the system returns null for Stochastic RSI causing "-" to display in the UI

1.5 WHEN `buildEntry` successfully fetches 1000 klines but some indicators return null THEN the system logs "buildEntry returned null despite having 1000 klines" and the entry may be discarded or show partial data

1.6 WHEN forex symbols or other low-volatility assets are processed AND their data aggregation produces insufficient candles for certain indicators THEN multiple columns display "-" instead of calculated values

1.7 WHEN the screener processes symbols during market open/close transitions AND some indicators fail to calculate THEN the UI shows "NO DATA" instead of distinguishing between "loading/syncing" and "no data available"

### Expected Behavior (Correct)

2.1 WHEN VWAP is calculated with insufficient UTC day data THEN the system SHALL use a robust multi-tier fallback mechanism (4-hour window → 2-hour window → 1-hour window → all available data) to ensure VWAP is calculated whenever any kline data exists

2.2 WHEN ADX is calculated on 15m aggregated data with insufficient candles THEN the system SHALL automatically fall back to 5m aggregated data, and if still insufficient, fall back to 1m data to ensure ADX is calculated whenever at least 14 candles exist in any timeframe

2.3 WHEN MACD is calculated on 15m aggregated data with insufficient candles THEN the system SHALL automatically fall back to 5m aggregated data, and if still insufficient, fall back to 1m data to ensure MACD is calculated whenever at least 35 candles exist in any timeframe

2.4 WHEN Stochastic RSI is calculated on 15m aggregated data with insufficient candles THEN the system SHALL automatically fall back to 5m aggregated data, and if still insufficient, fall back to 1m data to ensure Stochastic RSI is calculated whenever at least 50 candles exist in any timeframe

2.5 WHEN `buildEntry` successfully fetches klines but some indicators return null THEN the system SHALL still create and return a valid entry with the successfully calculated indicators, allowing partial data display rather than complete entry rejection

2.6 WHEN forex symbols or other assets are processed THEN the system SHALL apply appropriate timeframe fallbacks for all indicators to ensure maximum data coverage across all asset classes

2.7 WHEN indicators are being calculated but not yet available THEN the UI SHALL display a "syncing" state (e.g., "...") to distinguish from permanent "no data available" ("-") state

2.8 WHEN the VWAP anchor point (UTC day start) has insufficient data THEN the system SHALL log the fallback strategy being used for debugging and monitoring purposes

2.9 WHEN indicator calculations fail due to insufficient data THEN the system SHALL log detailed diagnostic information including the timeframe attempted, candles available, and candles required

### Unchanged Behavior (Regression Prevention)

3.1 WHEN sufficient data exists for all indicators on the preferred timeframe (15m) THEN the system SHALL CONTINUE TO calculate all indicators using the 15m timeframe without falling back to lower timeframes

3.2 WHEN `buildEntry` receives fewer than 20 klines THEN the system SHALL CONTINUE TO return a ticker-only entry or null as appropriate, maintaining the data sufficiency guard

3.3 WHEN RSI calculations are performed THEN the system SHALL CONTINUE TO use the configured periods (rsi1mPeriod, rsi5mPeriod, rsi15mPeriod, rsi1hPeriod) from coin configs

3.4 WHEN EMA cross detection is performed THEN the system SHALL CONTINUE TO use 15m closes data for the 9/21 EMA cross calculation

3.5 WHEN Bollinger Bands are calculated THEN the system SHALL CONTINUE TO use 15m closes data with the standard 20-period and 2-standard-deviation parameters

3.6 WHEN the strategy score is computed THEN the system SHALL CONTINUE TO use all available indicators (even if some are null) to produce a composite score

3.7 WHEN ticker overlay is applied THEN the system SHALL CONTINUE TO update price, change24h, and volume24h from fresh ticker data while preserving calculated indicators

3.8 WHEN indicator cache is checked THEN the system SHALL CONTINUE TO respect the TTL settings (15s for standard symbols, 10s for alert-active symbols)

3.9 WHEN symbols are prioritized for refresh THEN the system SHALL CONTINUE TO prioritize viewport symbols, search matches, and top 100 symbols over others

3.10 WHEN kline validation is performed THEN the system SHALL CONTINUE TO filter out invalid klines with null/NaN values before processing
