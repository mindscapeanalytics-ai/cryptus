# Design Document: RSI Screener Improvements

## Overview

This design addresses production-grade improvements to an existing RSI-based cryptocurrency screener and alert system. The system currently monitors 600+ symbols across multiple exchanges with real-time WebSocket updates, technical indicators, and multi-channel alerting. This design focuses on five critical areas:

1. **Data Accuracy**: Ensuring real-time price and indicator calculations are correct and reliable
2. **Alert Reliability**: Eliminating duplicate alerts and ensuring delivery across all channels
3. **Performance**: Optimizing for 600+ symbols with sub-second latency
4. **User Experience**: Adding flexible configuration, history management, and conditional logic
5. **Infrastructure**: Adding monitoring, error tracking, and horizontal scaling support

The design maintains backward compatibility with existing alert configurations and preserves the current architecture's strengths (worker-based processing, multi-exchange support, smart caching).

## Architecture

### High-Level Architecture

The system follows a multi-tier architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser Layer                         │
│  ┌──────────────────┐  ┌─────────────────┐  ┌────────────┐ │
│  │ Screener         │  │ Alert Engine    │  │ Service    │ │
│  │ Dashboard UI     │◄─┤ (Main Thread)   │◄─┤ Worker     │ │
│  └──────────────────┘  └─────────────────┘  └────────────┘ │
│           ▲                     ▲                   ▲        │
└───────────┼─────────────────────┼───────────────────┼────────┘
            │                     │                   │
            │                     │                   │
┌───────────┼─────────────────────┼───────────────────┼────────┐
│           │                     │                   │        │
│  ┌────────▼────────┐   ┌────────▼────────┐  ┌──────▼──────┐│
│  │ Ticker Worker   │   │ Alert Coordinator│  │ Push Service││
│  │ (SharedWorker)  │   │ (Database)       │  │ (VAPID)     ││
│  │ - WebSocket Mgmt│   │ - Cooldown Track │  │ - Retry     ││
│  │ - Delta Merge   │   │ - Deduplication  │  │ - Singleton ││
│  │ - Staleness Det │   │ - Multi-instance │  │             ││
│  └─────────────────┘   └──────────────────┘  └─────────────┘│
│           ▲                     ▲                            │
└───────────┼─────────────────────┼────────────────────────────┘
            │                     │
┌───────────┼─────────────────────┼────────────────────────────┐
│           │                     │                            │
│  ┌────────▼────────┐   ┌────────▼────────┐                  │
│  │ Exchange APIs   │   │ PostgreSQL DB   │                  │
│  │ - Binance WS    │   │ - CoinConfig    │                  │
│  │ - Bybit WS/REST │   │ - AlertLog      │                  │
│  │ - Yahoo Finance │   │ - PushSubscript │                  │
│  └─────────────────┘   └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Changes

1. **Centralized Alert Coordination**: Move cooldown tracking from in-memory to database-backed for multi-instance support
2. **Enhanced Ticker Worker**: Add delta merge logic, staleness detection, and REST polling fallback
3. **LRU Cache Layer**: Replace time-based TTL with LRU eviction for indicator cache
4. **Monitoring Pipeline**: Add metrics collection at each layer with centralized aggregation
5. **VAPID Singleton**: Initialize push notification keys once at module level


## Components and Interfaces

### 1. Enhanced Ticker Worker

**Purpose**: Manage WebSocket connections and real-time price updates with improved accuracy and reliability.

**Key Enhancements**:
- Delta merge for Bybit partial updates
- Staleness detection with 60-second timeout
- REST polling fallback for Bybit Spot (30+ symbols)
- Cold-start baseline fetching
- Zone state cleanup on symbol removal

**Interface**:
```typescript
interface TickerWorkerMessage {
  type: 'subscribe' | 'unsubscribe' | 'price_update' | 'staleness_alert' | 'zone_reset'
  payload: {
    symbols?: string[]
    exchange?: 'binance' | 'bybit_spot' | 'bybit_linear'
    priceData?: TickerUpdate
    staleSymbols?: string[]
  }
}

interface TickerUpdate {
  symbol: string
  exchange: string
  lastPrice: number
  volume: number
  timestamp: number
  isStale: boolean
  source: 'websocket' | 'rest_poll'
}

interface TickerState {
  symbol: string
  lastPrice: number
  volume: number
  open: number  // Baseline from cold-start fetch
  high: number
  low: number
  lastUpdate: number
  isStale: boolean
}
```

**Delta Merge Logic**:
```typescript
function mergeDeltaUpdate(current: TickerState, delta: Partial<TickerUpdate>): TickerState {
  // Validate required fields
  if (!delta.symbol || delta.lastPrice === undefined) {
    throw new Error('Invalid delta update: missing required fields')
  }
  
  return {
    ...current,
    lastPrice: delta.lastPrice ?? current.lastPrice,
    volume: delta.volume ?? current.volume,
    high: Math.max(current.high, delta.lastPrice),
    low: Math.min(current.low, delta.lastPrice),
    lastUpdate: Date.now(),
    isStale: false
  }
}
```

**Staleness Detection**:
```typescript
function detectStaleness(states: Map<string, TickerState>): string[] {
  const now = Date.now()
  const staleThreshold = 60000 // 60 seconds
  const staleSymbols: string[] = []
  
  for (const [symbol, state] of states) {
    if (now - state.lastUpdate > staleThreshold) {
      state.isStale = true
      staleSymbols.push(symbol)
    }
  }
  
  return staleSymbols
}
```

**REST Polling Fallback** (Bybit Spot):
```typescript
async function pollBybitSpotPrices(symbols: string[]): Promise<TickerUpdate[]> {
  const batchSize = 10
  const updates: TickerUpdate[] = []
  
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    const response = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${batch.join(',')}`)
    const data = await response.json()
    
    for (const ticker of data.result.list) {
      updates.push({
        symbol: ticker.symbol,
        exchange: 'bybit_spot',
        lastPrice: parseFloat(ticker.lastPrice),
        volume: parseFloat(ticker.volume24h),
        timestamp: Date.now(),
        isStale: false,
        source: 'rest_poll'
      })
    }
    
    // Rate limit protection: 2 second interval
    await sleep(2000)
  }
  
  return updates
}
```


### 2. Alert Coordinator

**Purpose**: Centralized alert deduplication and cooldown tracking across multiple instances and channels.

**Key Features**:
- Standardized cooldown key format
- Database-backed cooldown state
- Multi-channel coordination (worker, main thread, cron)
- Atomic alert logging with cooldown check

**Interface**:
```typescript
interface AlertCoordinator {
  checkAndRecordAlert(alert: AlertEvent): Promise<boolean>
  getCooldownKey(alert: AlertEvent): string
  isInCooldown(key: string): Promise<boolean>
  recordAlert(alert: AlertEvent): Promise<void>
}

interface AlertEvent {
  symbol: string
  exchange: string
  timeframe: string
  conditionType: 'rsi_oversold' | 'rsi_overbought' | 'ema_cross' | 'confluence' | 'conditional'
  value: number
  threshold: number
  priority: 'low' | 'medium' | 'high' | 'critical'
  metadata?: Record<string, any>
}

interface CooldownKey {
  format: string  // "{symbol}:{exchange}:{timeframe}:{condition}"
  example: "BTCUSDT:binance:5m:rsi_oversold"
}
```

**Cooldown Key Standardization**:
```typescript
function getCooldownKey(alert: AlertEvent): string {
  return `${alert.symbol}:${alert.exchange}:${alert.timeframe}:${alert.conditionType}`
}
```

**Atomic Alert Check and Record**:
```typescript
async function checkAndRecordAlert(alert: AlertEvent): Promise<boolean> {
  const key = getCooldownKey(alert)
  const cooldownMinutes = 3
  const cutoffTime = new Date(Date.now() - cooldownMinutes * 60 * 1000)
  
  // Use database transaction for atomicity
  const result = await db.$transaction(async (tx) => {
    // Check if alert exists within cooldown period
    const recentAlert = await tx.alertLog.findFirst({
      where: {
        symbol: alert.symbol,
        exchange: alert.exchange,
        timeframe: alert.timeframe,
        conditionType: alert.conditionType,
        createdAt: { gte: cutoffTime }
      }
    })
    
    if (recentAlert) {
      return { shouldFire: false, alertId: null }
    }
    
    // Record new alert
    const newAlert = await tx.alertLog.create({
      data: {
        symbol: alert.symbol,
        exchange: alert.exchange,
        timeframe: alert.timeframe,
        conditionType: alert.conditionType,
        value: alert.value,
        threshold: alert.threshold,
        priority: alert.priority,
        metadata: alert.metadata,
        createdAt: new Date()
      }
    })
    
    return { shouldFire: true, alertId: newAlert.id }
  })
  
  return result.shouldFire
}
```


### 3. Enhanced Alert Engine

**Purpose**: Evaluate alert conditions with improved confluence validation, conditional logic, and priority handling.

**Key Enhancements**:
- Confluence validation (minimum 2 valid timeframes)
- Conditional alert logic (AND/OR combinations)
- Priority-based alert handling
- Quiet hours support
- Custom sound selection

**Interface**:
```typescript
interface AlertEngine {
  evaluateConditions(symbol: string, indicators: IndicatorSet): Promise<AlertEvent[]>
  evaluateConditionalAlert(config: ConditionalAlertConfig, indicators: IndicatorSet): boolean
  shouldSuppressAlert(alert: AlertEvent, quietHours: QuietHoursConfig): boolean
}

interface ConditionalAlertConfig {
  logic: 'AND' | 'OR'
  conditions: AlertCondition[]
}

interface AlertCondition {
  type: 'rsi' | 'volume_spike' | 'ema_cross' | 'macd_signal' | 'bb_touch' | 'price_change'
  operator: '<' | '>' | '=' | 'cross_above' | 'cross_below'
  value: number
  timeframe?: string
}

interface IndicatorSet {
  timeframe: string
  rsi?: number
  ema9?: number
  ema21?: number
  macd?: { value: number, signal: number, histogram: number }
  bb?: { upper: number, middle: number, lower: number }
  volume?: number
  volumeAvg?: number
  priceChange?: number
}

interface QuietHoursConfig {
  enabled: boolean
  startHour: number  // 0-23
  endHour: number    // 0-23
  suppressPriorities: ('low' | 'medium')[]
}
```

**Confluence Validation**:
```typescript
function evaluateConfluence(
  symbol: string,
  timeframes: string[],
  indicatorsByTimeframe: Map<string, IndicatorSet>,
  threshold: number,
  direction: 'oversold' | 'overbought'
): AlertEvent | null {
  const validTimeframes: string[] = []
  
  for (const tf of timeframes) {
    const indicators = indicatorsByTimeframe.get(tf)
    if (!indicators || indicators.rsi === null || indicators.rsi === undefined) {
      continue  // Skip timeframes with missing data
    }
    
    const meetsCondition = direction === 'oversold' 
      ? indicators.rsi < threshold
      : indicators.rsi > threshold
    
    if (meetsCondition) {
      validTimeframes.push(tf)
    }
  }
  
  // Require at least 2 valid timeframes
  if (validTimeframes.length < 2) {
    return null
  }
  
  return {
    symbol,
    exchange: 'binance',  // From context
    timeframe: validTimeframes.join(','),
    conditionType: 'confluence',
    value: threshold,
    threshold,
    priority: 'high',
    metadata: {
      direction,
      agreeing_timeframes: validTimeframes,
      total_checked: timeframes.length
    }
  }
}
```


**Conditional Alert Evaluation**:
```typescript
function evaluateConditionalAlert(
  config: ConditionalAlertConfig,
  indicators: IndicatorSet
): boolean {
  const results = config.conditions.map(condition => {
    switch (condition.type) {
      case 'rsi':
        if (indicators.rsi === null || indicators.rsi === undefined) return false
        return evaluateOperator(indicators.rsi, condition.operator, condition.value)
      
      case 'volume_spike':
        if (!indicators.volume || !indicators.volumeAvg) return false
        const volumeRatio = indicators.volume / indicators.volumeAvg
        return evaluateOperator(volumeRatio, condition.operator, condition.value)
      
      case 'ema_cross':
        if (!indicators.ema9 || !indicators.ema21) return false
        const isBullishCross = indicators.ema9 > indicators.ema21
        return condition.operator === 'cross_above' ? isBullishCross : !isBullishCross
      
      case 'price_change':
        if (indicators.priceChange === null || indicators.priceChange === undefined) return false
        return evaluateOperator(indicators.priceChange, condition.operator, condition.value)
      
      default:
        return false
    }
  })
  
  return config.logic === 'AND' 
    ? results.every(r => r) 
    : results.some(r => r)
}

function evaluateOperator(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '<': return value < threshold
    case '>': return value > threshold
    case '=': return Math.abs(value - threshold) < 0.0001
    default: return false
  }
}
```

**Priority-Based Alert Handling**:
```typescript
function getAlertBehavior(priority: string): AlertBehavior {
  switch (priority) {
    case 'critical':
      return {
        sound: 'critical-alarm.mp3',
        persistent: true,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200]
      }
    case 'high':
      return {
        sound: 'high-priority.mp3',
        persistent: true,
        requireInteraction: false,
        vibrate: [200, 100, 200]
      }
    case 'medium':
      return {
        sound: 'default-chime.mp3',
        persistent: false,
        requireInteraction: false,
        vibrate: [200]
      }
    case 'low':
      return {
        sound: 'soft-notification.mp3',
        persistent: false,
        requireInteraction: false,
        vibrate: []
      }
  }
}
```


### 4. LRU Cache for Indicators

**Purpose**: Efficient memory management for indicator calculations with least-recently-used eviction.

**Key Features**:
- Maximum 1000 entries
- O(1) get/set operations
- Automatic eviction of least recently used
- Thread-safe for worker environment

**Interface**:
```typescript
interface LRUCache<K, V> {
  get(key: K): V | undefined
  set(key: K, value: V): void
  has(key: K): boolean
  delete(key: K): boolean
  clear(): void
  size: number
}

interface CacheEntry<V> {
  value: V
  timestamp: number
}
```

**Implementation**:
```typescript
class LRUCache<K, V> {
  private maxSize: number
  private cache: Map<K, CacheEntry<V>>
  private accessOrder: K[]
  
  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize
    this.cache = new Map()
    this.accessOrder = []
  }
  
  get(key: K): V | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    
    // Move to end (most recently used)
    this.updateAccessOrder(key)
    return entry.value
  }
  
  set(key: K, value: V): void {
    // Evict if at capacity and key is new
    if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
      this.evictLRU()
    }
    
    this.cache.set(key, { value, timestamp: Date.now() })
    this.updateAccessOrder(key)
  }
  
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return
    
    const lruKey = this.accessOrder.shift()!
    this.cache.delete(lruKey)
  }
  
  private updateAccessOrder(key: K): void {
    // Remove from current position
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
    
    // Add to end (most recent)
    this.accessOrder.push(key)
  }
  
  clear(): void {
    this.cache.clear()
    this.accessOrder = []
  }
  
  get size(): number {
    return this.cache.size
  }
}
```

**Cache Key Format**:
```typescript
function getIndicatorCacheKey(
  symbol: string,
  exchange: string,
  timeframe: string,
  indicator: string
): string {
  return `${symbol}:${exchange}:${timeframe}:${indicator}`
}
```


### 5. Push Notification Service with Retry

**Purpose**: Reliable push notification delivery with retry logic and VAPID singleton.

**Key Features**:
- Module-level VAPID key initialization
- Exponential backoff retry (3 attempts)
- Failure logging with subscription details
- AudioContext resume for mobile

**Interface**:
```typescript
interface PushService {
  sendNotification(subscription: PushSubscription, payload: NotificationPayload): Promise<boolean>
  initializeVAPID(): void
  resumeAudioContext(): Promise<void>
}

interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: Record<string, any>
  requireInteraction?: boolean
  vibrate?: number[]
}
```

**VAPID Singleton**:
```typescript
// Module-level initialization
let vapidKeys: { publicKey: string, privateKey: string } | null = null

function initializeVAPID(): void {
  if (vapidKeys) return  // Already initialized
  
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  
  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys not configured')
  }
  
  vapidKeys = { publicKey, privateKey }
}

function getVAPIDKeys(): { publicKey: string, privateKey: string } {
  if (!vapidKeys) {
    throw new Error('VAPID keys not initialized. Call initializeVAPID() first.')
  }
  return vapidKeys
}
```

**Retry Logic**:
```typescript
async function sendNotificationWithRetry(
  subscription: PushSubscription,
  payload: NotificationPayload,
  maxRetries: number = 3
): Promise<boolean> {
  const keys = getVAPIDKeys()
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify(payload),
        {
          vapidDetails: {
            subject: 'mailto:alerts@cryptoscreener.com',
            publicKey: keys.publicKey,
            privateKey: keys.privateKey
          }
        }
      )
      
      return true  // Success
      
    } catch (error) {
      const isLastAttempt = attempt === maxRetries
      
      if (isLastAttempt) {
        // Log failure with details
        console.error('Push notification failed after retries', {
          subscription: subscription.endpoint,
          payload,
          error: error.message,
          attempts: maxRetries
        })
        return false
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delayMs = Math.pow(2, attempt - 1) * 1000
      await sleep(delayMs)
    }
  }
  
  return false
}
```

**AudioContext Resume** (Mobile):
```typescript
async function resumeAudioContext(audioContext: AudioContext): Promise<void> {
  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume()
      console.log('AudioContext resumed successfully')
    } catch (error) {
      console.error('Failed to resume AudioContext', error)
    }
  }
}
```


### 6. Data Validation Layer

**Purpose**: Ensure data quality by validating kline data and handling anomalies gracefully.

**Key Features**:
- OHLC relationship validation
- NaN/Infinity detection
- Outlier detection (50% price change threshold)
- Missing candle interpolation
- Yahoo Finance staleness check

**Interface**:
```typescript
interface DataValidator {
  validateKline(kline: Kline): ValidationResult
  interpolateMissingCandles(klines: Kline[]): Kline[]
  detectOutliers(klines: Kline[]): OutlierReport
}

interface Kline {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

interface OutlierReport {
  hasOutliers: boolean
  outlierIndices: number[]
  maxPriceChange: number
}
```

**OHLC Validation**:
```typescript
function validateKline(kline: Kline): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check for NaN or Infinity
  const values = [kline.open, kline.high, kline.low, kline.close, kline.volume]
  if (values.some(v => !isFinite(v))) {
    errors.push('Kline contains NaN or Infinity values')
    return { isValid: false, errors, warnings }
  }
  
  // Validate OHLC relationships
  if (kline.low > kline.open || kline.low > kline.close) {
    errors.push(`Low (${kline.low}) exceeds Open (${kline.open}) or Close (${kline.close})`)
  }
  
  if (kline.high < kline.open || kline.high < kline.close) {
    errors.push(`High (${kline.high}) is below Open (${kline.open}) or Close (${kline.close})`)
  }
  
  if (kline.low > kline.high) {
    errors.push(`Low (${kline.low}) exceeds High (${kline.high})`)
  }
  
  // Warn on zero volume
  if (kline.volume === 0) {
    warnings.push('Volume is zero - volume-based indicators may be unreliable')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}
```

**Outlier Detection**:
```typescript
function detectOutliers(klines: Kline[]): OutlierReport {
  const outlierIndices: number[] = []
  let maxPriceChange = 0
  const threshold = 0.5  // 50% change
  
  for (let i = 1; i < klines.length; i++) {
    const prevClose = klines[i - 1].close
    const currentClose = klines[i].close
    const priceChange = Math.abs(currentClose - prevClose) / prevClose
    
    maxPriceChange = Math.max(maxPriceChange, priceChange)
    
    if (priceChange > threshold) {
      outlierIndices.push(i)
    }
  }
  
  return {
    hasOutliers: outlierIndices.length > 0,
    outlierIndices,
    maxPriceChange
  }
}
```

**Missing Candle Interpolation**:
```typescript
function interpolateMissingCandles(klines: Kline[], expectedInterval: number): Kline[] {
  if (klines.length < 2) return klines
  
  const result: Kline[] = [klines[0]]
  
  for (let i = 1; i < klines.length; i++) {
    const prev = klines[i - 1]
    const current = klines[i]
    const timeDiff = current.timestamp - prev.timestamp
    const expectedDiff = expectedInterval * 60 * 1000  // Convert minutes to ms
    
    // Check for gap
    if (timeDiff > expectedDiff * 1.5) {
      const missingCount = Math.floor(timeDiff / expectedDiff) - 1
      
      // Interpolate missing candles using previous close
      for (let j = 1; j <= missingCount; j++) {
        const interpolatedTimestamp = prev.timestamp + (j * expectedDiff)
        result.push({
          timestamp: interpolatedTimestamp,
          open: prev.close,
          high: prev.close,
          low: prev.close,
          close: prev.close,
          volume: 0
        })
      }
    }
    
    result.push(current)
  }
  
  return result
}
```


### 7. Monitoring and Metrics

**Purpose**: Provide visibility into system health, performance, and errors for proactive issue detection.

**Key Features**:
- Centralized error tracking
- Performance metrics (latency, cache hit rate, API weight)
- Health check endpoint
- Worker connection monitoring

**Interface**:
```typescript
interface MetricsCollector {
  recordLatency(operation: string, durationMs: number): void
  recordCacheHit(hit: boolean): void
  recordAPIWeight(exchange: string, weight: number): void
  recordAlertFired(alert: AlertEvent): void
  recordError(error: Error, context: Record<string, any>): void
  getMetrics(): MetricsSnapshot
}

interface MetricsSnapshot {
  latency: {
    screenerFetch: { avg: number, p95: number, p99: number }
    indicatorCalc: { avg: number, p95: number, p99: number }
    alertEval: { avg: number, p95: number, p99: number }
  }
  cache: {
    hitRate: number
    size: number
    evictions: number
  }
  api: {
    binanceWeight: number
    bybitWeight: number
    yahooRequests: number
  }
  alerts: {
    totalFired: number
    byPriority: Record<string, number>
    byCondition: Record<string, number>
  }
  errors: {
    total: number
    byType: Record<string, number>
  }
  worker: {
    connectionStatus: 'connected' | 'disconnected' | 'reconnecting'
    reconnectAttempts: number
    lastReconnect: number
    activeSymbols: number
  }
}
```

**Metrics Collection**:
```typescript
class MetricsCollector {
  private latencies: Map<string, number[]> = new Map()
  private cacheHits: number = 0
  private cacheMisses: number = 0
  private apiWeights: Map<string, number> = new Map()
  private alertCounts: Map<string, number> = new Map()
  private errorCounts: Map<string, number> = new Map()
  
  recordLatency(operation: string, durationMs: number): void {
    if (!this.latencies.has(operation)) {
      this.latencies.set(operation, [])
    }
    this.latencies.get(operation)!.push(durationMs)
    
    // Keep only last 1000 measurements
    const measurements = this.latencies.get(operation)!
    if (measurements.length > 1000) {
      measurements.shift()
    }
  }
  
  recordCacheHit(hit: boolean): void {
    if (hit) {
      this.cacheHits++
    } else {
      this.cacheMisses++
    }
  }
  
  recordAPIWeight(exchange: string, weight: number): void {
    const current = this.apiWeights.get(exchange) || 0
    this.apiWeights.set(exchange, current + weight)
  }
  
  getMetrics(): MetricsSnapshot {
    return {
      latency: {
        screenerFetch: this.calculatePercentiles('screenerFetch'),
        indicatorCalc: this.calculatePercentiles('indicatorCalc'),
        alertEval: this.calculatePercentiles('alertEval')
      },
      cache: {
        hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses),
        size: indicatorCache.size,
        evictions: 0  // Track separately
      },
      api: {
        binanceWeight: this.apiWeights.get('binance') || 0,
        bybitWeight: this.apiWeights.get('bybit') || 0,
        yahooRequests: this.apiWeights.get('yahoo') || 0
      },
      alerts: {
        totalFired: Array.from(this.alertCounts.values()).reduce((a, b) => a + b, 0),
        byPriority: Object.fromEntries(this.alertCounts),
        byCondition: {}  // Track separately
      },
      errors: {
        total: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
        byType: Object.fromEntries(this.errorCounts)
      },
      worker: {
        connectionStatus: 'connected',  // From worker state
        reconnectAttempts: 0,
        lastReconnect: 0,
        activeSymbols: 0
      }
    }
  }
  
  private calculatePercentiles(operation: string): { avg: number, p95: number, p99: number } {
    const measurements = this.latencies.get(operation) || []
    if (measurements.length === 0) {
      return { avg: 0, p95: 0, p99: 0 }
    }
    
    const sorted = [...measurements].sort((a, b) => a - b)
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    const p99 = sorted[Math.floor(sorted.length * 0.99)]
    
    return { avg, p95, p99 }
  }
}
```


**Health Check Endpoint**:
```typescript
// /api/health
export async function GET(request: Request) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: await checkDatabase(),
      cache: checkCache(),
      worker: checkWorker(),
      vapid: checkVAPID()
    },
    metrics: metricsCollector.getMetrics()
  }
  
  const isHealthy = Object.values(health.checks).every(check => check.status === 'ok')
  health.status = isHealthy ? 'healthy' : 'degraded'
  
  return Response.json(health, {
    status: isHealthy ? 200 : 503
  })
}

async function checkDatabase(): Promise<{ status: string, latencyMs?: number }> {
  const start = Date.now()
  try {
    await db.$queryRaw`SELECT 1`
    return { status: 'ok', latencyMs: Date.now() - start }
  } catch (error) {
    return { status: 'error', latencyMs: Date.now() - start }
  }
}

function checkCache(): { status: string, size: number } {
  return {
    status: indicatorCache.size < 1000 ? 'ok' : 'warning',
    size: indicatorCache.size
  }
}

function checkVAPID(): { status: string } {
  try {
    getVAPIDKeys()
    return { status: 'ok' }
  } catch (error) {
    return { status: 'error' }
  }
}
```


### 8. Alert Configuration Management

**Purpose**: Provide flexible alert configuration with templates, bulk operations, and conditional logic.

**Key Features**:
- Alert templates for reusable configurations
- Bulk operations (enable, disable, delete, apply template)
- Conditional alert builder
- Priority and sound customization
- Quiet hours configuration

**Interface**:
```typescript
interface AlertConfigManager {
  createTemplate(template: AlertTemplate): Promise<string>
  applyTemplate(templateId: string, symbols: string[]): Promise<BulkOperationResult>
  bulkUpdate(symbols: string[], updates: Partial<CoinConfig>): Promise<BulkOperationResult>
  bulkDelete(symbols: string[]): Promise<BulkOperationResult>
}

interface AlertTemplate {
  name: string
  description: string
  rsiPeriod?: number
  rsiOversold?: number
  rsiOverbought?: number
  priority: 'low' | 'medium' | 'high' | 'critical'
  sound: string
  conditionalLogic?: ConditionalAlertConfig
  quietHours?: QuietHoursConfig
}

interface BulkOperationResult {
  success: number
  failed: number
  errors: Array<{ symbol: string, error: string }>
}
```

**Template Application**:
```typescript
async function applyTemplate(
  templateId: string,
  symbols: string[],
  userId: string
): Promise<BulkOperationResult> {
  const template = await db.alertTemplate.findUnique({
    where: { id: templateId }
  })
  
  if (!template) {
    throw new Error('Template not found')
  }
  
  const result: BulkOperationResult = {
    success: 0,
    failed: 0,
    errors: []
  }
  
  // Use transaction for atomicity
  await db.$transaction(async (tx) => {
    for (const symbol of symbols) {
      try {
        await tx.coinConfig.upsert({
          where: {
            userId_symbol_exchange: {
              userId,
              symbol,
              exchange: 'binance'  // From context
            }
          },
          create: {
            userId,
            symbol,
            exchange: 'binance',
            rsiPeriod: template.rsiPeriod,
            rsiOversold: template.rsiOversold,
            rsiOverbought: template.rsiOverbought,
            priority: template.priority,
            sound: template.sound,
            conditionalLogic: template.conditionalLogic,
            quietHours: template.quietHours,
            enabled: true
          },
          update: {
            rsiPeriod: template.rsiPeriod,
            rsiOversold: template.rsiOversold,
            rsiOverbought: template.rsiOverbought,
            priority: template.priority,
            sound: template.sound,
            conditionalLogic: template.conditionalLogic,
            quietHours: template.quietHours
          }
        })
        
        result.success++
      } catch (error) {
        result.failed++
        result.errors.push({
          symbol,
          error: error.message
        })
      }
    }
  })
  
  return result
}
```

**Bulk Operations**:
```typescript
async function bulkUpdate(
  symbols: string[],
  updates: Partial<CoinConfig>,
  userId: string
): Promise<BulkOperationResult> {
  const result: BulkOperationResult = {
    success: 0,
    failed: 0,
    errors: []
  }
  
  await db.$transaction(async (tx) => {
    for (const symbol of symbols) {
      try {
        await tx.coinConfig.updateMany({
          where: {
            userId,
            symbol,
            exchange: 'binance'
          },
          data: updates
        })
        
        result.success++
      } catch (error) {
        result.failed++
        result.errors.push({ symbol, error: error.message })
      }
    }
  })
  
  return result
}
```


### 9. Alert History Management

**Purpose**: Provide comprehensive alert history with filtering, search, export, and analytics.

**Key Features**:
- Advanced filtering (symbol, exchange, timeframe, condition, date range)
- Full-text search
- Pagination
- CSV export
- Statistics and analytics

**Interface**:
```typescript
interface AlertHistoryManager {
  getAlerts(filters: AlertFilters, pagination: Pagination): Promise<AlertHistoryPage>
  searchAlerts(query: string, pagination: Pagination): Promise<AlertHistoryPage>
  exportAlerts(filters: AlertFilters): Promise<string>  // CSV content
  getStatistics(filters: AlertFilters): Promise<AlertStatistics>
}

interface AlertFilters {
  symbols?: string[]
  exchanges?: string[]
  timeframes?: string[]
  conditionTypes?: string[]
  priorities?: string[]
  dateFrom?: Date
  dateTo?: Date
}

interface Pagination {
  page: number
  pageSize: number
}

interface AlertHistoryPage {
  alerts: AlertLog[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface AlertStatistics {
  totalAlerts: number
  byCondition: Record<string, number>
  byPriority: Record<string, number>
  bySymbol: Record<string, number>
  avgTimeBetweenAlerts: number  // milliseconds
  successRate: number  // percentage
}
```

**Filtering Implementation**:
```typescript
async function getAlerts(
  filters: AlertFilters,
  pagination: Pagination,
  userId: string
): Promise<AlertHistoryPage> {
  const where: any = { userId }
  
  if (filters.symbols?.length) {
    where.symbol = { in: filters.symbols }
  }
  
  if (filters.exchanges?.length) {
    where.exchange = { in: filters.exchanges }
  }
  
  if (filters.timeframes?.length) {
    where.timeframe = { in: filters.timeframes }
  }
  
  if (filters.conditionTypes?.length) {
    where.conditionType = { in: filters.conditionTypes }
  }
  
  if (filters.priorities?.length) {
    where.priority = { in: filters.priorities }
  }
  
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {}
    if (filters.dateFrom) where.createdAt.gte = filters.dateFrom
    if (filters.dateTo) where.createdAt.lte = filters.dateTo
  }
  
  const [alerts, total] = await Promise.all([
    db.alertLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize
    }),
    db.alertLog.count({ where })
  ])
  
  return {
    alerts,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.ceil(total / pagination.pageSize)
  }
}
```

**CSV Export**:
```typescript
async function exportAlerts(filters: AlertFilters, userId: string): Promise<string> {
  const alerts = await db.alertLog.findMany({
    where: buildWhereClause(filters, userId),
    orderBy: { createdAt: 'desc' }
  })
  
  const headers = ['Timestamp', 'Symbol', 'Exchange', 'Timeframe', 'Condition', 'Value', 'Threshold', 'Priority']
  const rows = alerts.map(alert => [
    alert.createdAt.toISOString(),
    alert.symbol,
    alert.exchange,
    alert.timeframe,
    alert.conditionType,
    alert.value.toString(),
    alert.threshold.toString(),
    alert.priority
  ])
  
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')
  
  return csv
}
```

**Statistics Calculation**:
```typescript
async function getStatistics(filters: AlertFilters, userId: string): Promise<AlertStatistics> {
  const alerts = await db.alertLog.findMany({
    where: buildWhereClause(filters, userId),
    orderBy: { createdAt: 'asc' }
  })
  
  const byCondition: Record<string, number> = {}
  const byPriority: Record<string, number> = {}
  const bySymbol: Record<string, number> = {}
  
  for (const alert of alerts) {
    byCondition[alert.conditionType] = (byCondition[alert.conditionType] || 0) + 1
    byPriority[alert.priority] = (byPriority[alert.priority] || 0) + 1
    bySymbol[alert.symbol] = (bySymbol[alert.symbol] || 0) + 1
  }
  
  // Calculate average time between alerts
  let totalTimeDiff = 0
  for (let i = 1; i < alerts.length; i++) {
    totalTimeDiff += alerts[i].createdAt.getTime() - alerts[i - 1].createdAt.getTime()
  }
  const avgTimeBetweenAlerts = alerts.length > 1 ? totalTimeDiff / (alerts.length - 1) : 0
  
  return {
    totalAlerts: alerts.length,
    byCondition,
    byPriority,
    bySymbol,
    avgTimeBetweenAlerts,
    successRate: 100  // Placeholder - would need success tracking
  }
}
```


## Data Models

### Database Schema Extensions

**AlertTemplate** (New):
```prisma
model AlertTemplate {
  id              String   @id @default(cuid())
  userId          String
  name            String
  description     String?
  rsiPeriod       Int?
  rsiOversold     Float?
  rsiOverbought   Float?
  priority        String   @default("medium")
  sound           String   @default("default-chime.mp3")
  conditionalLogic Json?
  quietHours      Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
}
```

**CoinConfig** (Extended):
```prisma
model CoinConfig {
  id              String   @id @default(cuid())
  userId          String
  symbol          String
  exchange        String
  rsiPeriod       Int      @default(14)
  rsiOversold     Float    @default(30)
  rsiOverbought   Float    @default(70)
  priority        String   @default("medium")  // NEW
  sound           String   @default("default-chime.mp3")  // NEW
  conditionalLogic Json?   // NEW
  quietHours      Json?    // NEW
  enabled         Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, symbol, exchange])
  @@index([userId])
  @@index([symbol])
}
```

**AlertLog** (Extended):
```prisma
model AlertLog {
  id              String   @id @default(cuid())
  userId          String
  symbol          String
  exchange        String
  timeframe       String
  conditionType   String
  value           Float
  threshold       Float
  priority        String   @default("medium")  // NEW
  metadata        Json?    // NEW
  createdAt       DateTime @default(now())
  
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, symbol, exchange, timeframe, conditionType, createdAt])
  @@index([createdAt])
}
```

### Migration Strategy

**Backward Compatibility**:
```typescript
// Migration: Add new fields with defaults
await prisma.$executeRaw`
  ALTER TABLE "CoinConfig" 
  ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS "sound" TEXT DEFAULT 'default-chime.mp3',
  ADD COLUMN IF NOT EXISTS "conditionalLogic" JSONB,
  ADD COLUMN IF NOT EXISTS "quietHours" JSONB;
`

await prisma.$executeRaw`
  ALTER TABLE "AlertLog"
  ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;
`

// Create new table
await prisma.$executeRaw`
  CREATE TABLE IF NOT EXISTS "AlertTemplate" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rsiPeriod" INTEGER,
    "rsiOversold" DOUBLE PRECISION,
    "rsiOverbought" DOUBLE PRECISION,
    "priority" TEXT DEFAULT 'medium',
    "sound" TEXT DEFAULT 'default-chime.mp3',
    "conditionalLogic" JSONB,
    "quietHours" JSONB,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
  );
`
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property Reflection

After analyzing all acceptance criteria, I identified several redundancies:

- **5.1 and 5.3** are logically equivalent (confluence requires 2+ valid timeframes)
- **7.4 and 7.5** can be combined into a single property about quiet hours behavior
- Several properties about metrics collection (11.2, 11.3, 11.4, 11.5) follow the same pattern and can be generalized

The following properties represent the unique, non-redundant validation requirements:


### Data Accuracy Properties

Property 1: Delta merge completeness
*For any* ticker state and valid delta update containing symbol and lastPrice, merging the delta should produce a complete ticker state with all required fields (symbol, lastPrice, volume, high, low, open, lastUpdate, isStale) present and valid.
**Validates: Requirements 1.1, 1.6**

Property 2: Staleness detection accuracy
*For any* ticker state with lastUpdate timestamp, if the current time minus lastUpdate exceeds 60 seconds, the state should be marked as stale.
**Validates: Requirements 1.2**

Property 3: Exchange isolation
*For any* set of zone states associated with an exchange, when switching to a different exchange, all zone states should be reset to their initial values.
**Validates: Requirements 1.3**

Property 4: Baseline-aware RSI calculation
*For any* baseline open price and sequence of price updates, the calculated RSI should use the baseline as the starting point for the first candle's gain/loss calculation.
**Validates: Requirements 1.5**

Property 5: Update timestamping
*For any* price update processed by the ticker worker, the resulting ticker state should have a lastUpdate timestamp equal to the processing time.
**Validates: Requirements 1.7**

### Data Validation Properties

Property 6: OHLC relationship validation
*For any* kline data, if the data is valid, it must satisfy: Low ≤ Open ≤ High AND Low ≤ Close ≤ High AND Low ≤ High.
**Validates: Requirements 13.1**

Property 7: Invalid data rejection
*For any* kline containing NaN, Infinity, or negative volume, the validation should reject the kline and return an error.
**Validates: Requirements 2.6, 13.3**

Property 8: Outlier detection
*For any* sequence of klines, if consecutive candles have a price change exceeding 50%, the outlier detector should flag those candles.
**Validates: Requirements 13.4**

Property 9: Gap interpolation
*For any* sequence of klines with missing timestamps, the interpolation function should fill gaps with candles using the last known close price for OHLC values and 0 for volume.
**Validates: Requirements 13.5**

Property 10: Stale data exclusion
*For any* data source returning timestamps older than 1 hour, the screener service should exclude those symbols from results.
**Validates: Requirements 2.5, 13.6**

Property 11: Zero volume handling
*For any* kline with volume = 0, the validation should accept the kline but include a warning that volume-based indicators may be unreliable.
**Validates: Requirements 13.2**

### Alert Coordination Properties

Property 12: Cooldown key format consistency
*For any* alert event with symbol, exchange, timeframe, and conditionType, the generated cooldown key should follow the format "{symbol}:{exchange}:{timeframe}:{conditionType}".
**Validates: Requirements 3.1**

Property 13: Alert record completeness
*For any* alert that fires, the database record should contain all required fields: symbol, exchange, timeframe, conditionType, value, threshold, priority, timestamp.
**Validates: Requirements 3.6**

Property 14: Atomic cooldown check
*For any* alert event, checking and recording the alert should be atomic—either the alert is in cooldown (returns false) or it's recorded and returns true, never both.
**Validates: Requirements 3.1, 3.4**

### Confluence Validation Properties

Property 15: Confluence minimum timeframes
*For any* set of timeframes with indicator values, confluence should only be detected when at least 2 timeframes have non-null indicator values that meet the threshold condition.
**Validates: Requirements 5.1, 5.3**

Property 16: Null value exclusion
*For any* timeframe with null or undefined indicator values, that timeframe should be excluded from confluence calculation.
**Validates: Requirements 5.2**

Property 17: Confluence metadata completeness
*For any* confluence alert, the metadata should include the list of agreeing timeframes and the total number of timeframes checked.
**Validates: Requirements 5.4**

Property 18: Custom period respect
*For any* symbol with a custom RSI period configured, the confluence evaluation should use that custom period for calculations on all timeframes for that symbol.
**Validates: Requirements 5.5**

### Performance Properties

Property 19: LRU cache eviction
*For any* LRU cache at maximum capacity (1000 entries), adding a new entry should evict the least recently used entry.
**Validates: Requirements 6.1**

Property 20: Zone state cleanup
*For any* symbol removed from monitoring, all associated zone state entries should be deleted from memory.
**Validates: Requirements 6.2**

Property 21: Batch processing
*For any* set of 600+ ticker updates, the worker should process them in batches of 50 or fewer to prevent event loop blocking.
**Validates: Requirements 6.4**

Property 22: API weight tracking
*For any* sequence of API calls, the total tracked weight should equal the sum of individual call weights.
**Validates: Requirements 2.4**

Property 23: Exponential backoff
*For any* sequence of rate limit failures, the backoff delay should increase exponentially (e.g., 1s, 2s, 4s, 8s).
**Validates: Requirements 2.3**

### Alert Reliability Properties

Property 24: Push notification retry
*For any* failed push notification send, the system should retry up to 3 times with exponential backoff delays (1s, 2s, 4s).
**Validates: Requirements 4.2**

Property 25: Priority-based notification behavior
*For any* alert with priority "high" or "critical", the notification should have persistent=true and a prominent sound file.
**Validates: Requirements 7.3**

Property 26: Quiet hours suppression
*For any* alert during quiet hours, if the priority is "low" or "medium", the alert should be suppressed; if priority is "high" or "critical", the alert should fire.
**Validates: Requirements 7.4, 7.5**

### Conditional Alert Properties

Property 27: AND logic evaluation
*For any* conditional alert with AND logic and N conditions, the alert should only fire when all N conditions evaluate to true.
**Validates: Requirements 9.1**

Property 28: OR logic evaluation
*For any* conditional alert with OR logic and N conditions, the alert should fire when at least one condition evaluates to true.
**Validates: Requirements 9.2**

Property 29: Conditional validation
*For any* conditional alert configuration, if any referenced indicator is not available for the selected timeframe, the configuration should be rejected with a validation error.
**Validates: Requirements 9.4**

Property 30: Conditional metadata
*For any* conditional alert that fires, the alert message should include which specific conditions were met.
**Validates: Requirements 9.5**

Property 31: Conditional cooldown consistency
*For any* conditional alert, the cooldown and hysteresis rules should be applied identically to simple alerts.
**Validates: Requirements 9.6**

### Configuration Management Properties

Property 32: Template application
*For any* alert template and list of symbols, applying the template should create or update CoinConfig entries for all symbols with the template's settings.
**Validates: Requirements 7.7, 10.3**

Property 33: Bulk operation atomicity
*For any* bulk operation (enable, disable, delete), either all selected entries should be updated successfully, or all updates should be rolled back on any failure.
**Validates: Requirements 10.2, 10.6**

Property 34: Bulk operation result reporting
*For any* bulk operation, the result should include success count, failure count, and error details for each failed symbol.
**Validates: Requirements 10.5**

### Alert History Properties

Property 35: Filter correctness
*For any* alert history filter (symbol, exchange, timeframe, condition, date range), the returned alerts should match all specified filter criteria.
**Validates: Requirements 8.1**

Property 36: Search correctness
*For any* full-text search query, all returned alerts should contain the query text in their message or metadata fields.
**Validates: Requirements 8.2**

Property 37: Pagination correctness
*For any* page request with pageSize=50, the returned page should contain at most 50 alerts, and the total pages should equal ceil(totalAlerts / 50).
**Validates: Requirements 8.3**

Property 38: CSV export completeness
*For any* set of alerts exported to CSV, each row should contain all alert fields: timestamp, symbol, exchange, timeframe, condition, value, threshold, priority.
**Validates: Requirements 8.4**

Property 39: Statistics accuracy
*For any* set of alerts, the calculated statistics (counts by condition, by priority, average time between alerts) should accurately reflect the alert data.
**Validates: Requirements 8.5**

Property 40: Bulk delete completeness
*For any* set of alert IDs selected for deletion, all corresponding AlertLog entries should be removed from the database.
**Validates: Requirements 8.6**

### Infrastructure Properties

Property 41: Error reporting completeness
*For any* error occurring in the ticker worker, an error report should be sent to the tracking service with context including symbol, exchange, error type, and timestamp.
**Validates: Requirements 11.1**

Property 42: Metrics collection
*For any* operation (screener fetch, indicator calculation, alert evaluation), metrics should be recorded including operation type, duration, and outcome.
**Validates: Requirements 11.2, 11.3, 11.4, 11.5**

Property 43: VAPID key reuse
*For any* sequence of push notification sends, the same VAPID key instance should be used across all sends (no recreation per request).
**Validates: Requirements 12.2**

### Backward Compatibility Properties

Property 44: Legacy configuration defaults
*For any* CoinConfig entry with missing priority or sound fields, the alert engine should treat priority as "medium" and sound as "default-chime.mp3".
**Validates: Requirements 14.2**

Property 45: Cache key instance isolation
*For any* cache key generated, it should include an instance identifier to prevent conflicts across multiple running instances.
**Validates: Requirements 15.3**


## Error Handling

### Error Categories

1. **Data Validation Errors**
   - Invalid kline data (NaN, Infinity, OHLC violations)
   - Missing required fields in delta updates
   - Stale data from external sources
   - Outlier detection (>50% price changes)

2. **Network Errors**
   - WebSocket disconnections
   - REST API failures
   - Rate limit violations
   - Push notification send failures

3. **State Management Errors**
   - Cache eviction failures
   - Zone state corruption
   - Cooldown tracking inconsistencies
   - Database transaction failures

4. **Configuration Errors**
   - Invalid conditional alert logic
   - Missing VAPID keys
   - Invalid template configurations
   - Unavailable indicators for timeframe

### Error Handling Strategies

**Data Validation Errors**:
```typescript
try {
  const validation = validateKline(kline)
  if (!validation.isValid) {
    logger.warn('Invalid kline data', {
      symbol: kline.symbol,
      errors: validation.errors,
      kline
    })
    // Exclude symbol from results, continue processing others
    return null
  }
} catch (error) {
  logger.error('Kline validation exception', {
    symbol: kline.symbol,
    error: error.message,
    stack: error.stack
  })
  // Exclude symbol, continue processing
  return null
}
```

**Network Errors**:
```typescript
async function fetchWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const isLastAttempt = attempt === maxRetries
      
      if (isLastAttempt) {
        logger.error('Operation failed after retries', {
          attempts: maxRetries,
          error: error.message
        })
        throw error
      }
      
      // Exponential backoff with jitter
      const baseDelay = Math.pow(2, attempt - 1) * 1000
      const jitter = Math.random() * 1000
      await sleep(baseDelay + jitter)
    }
  }
  
  throw new Error('Unreachable')
}
```

**State Management Errors**:
```typescript
try {
  await db.$transaction(async (tx) => {
    // Atomic operations
  })
} catch (error) {
  logger.error('Transaction failed', {
    operation: 'bulk_update',
    error: error.message
  })
  
  // Return error to user with rollback confirmation
  return {
    success: false,
    error: 'Operation failed and was rolled back',
    details: error.message
  }
}
```

**Configuration Errors**:
```typescript
function validateConditionalConfig(config: ConditionalAlertConfig): ValidationResult {
  const errors: string[] = []
  
  if (config.conditions.length === 0) {
    errors.push('At least one condition is required')
  }
  
  if (config.conditions.length > 5) {
    errors.push('Maximum 5 conditions allowed')
  }
  
  for (const condition of config.conditions) {
    if (!isIndicatorAvailable(condition.type, config.timeframe)) {
      errors.push(`Indicator ${condition.type} not available for timeframe ${config.timeframe}`)
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}
```

### Error Recovery

**WebSocket Reconnection**:
- Exponential backoff with jitter (1s, 2s, 4s, 8s, 16s, max 60s)
- Zombie connection detection (60s no-data timeout)
- Automatic resubscription to all symbols on reconnect
- State reset on exchange switch

**Cache Recovery**:
- LRU eviction prevents memory exhaustion
- Cache miss triggers fresh calculation
- Periodic cache cleanup (remove expired entries)
- Cache clear on critical errors

**Database Recovery**:
- Connection pool with automatic reconnection
- Transaction rollback on failures
- Retry logic for transient errors
- Health check monitoring

**Push Notification Recovery**:
- 3 retry attempts with exponential backoff
- Failure logging with subscription details
- Automatic subscription cleanup for invalid endpoints
- AudioContext resume on mobile


## Testing Strategy

### Dual Testing Approach

This system requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** focus on:
- Specific examples demonstrating correct behavior
- Edge cases (empty inputs, boundary values, null handling)
- Error conditions and exception handling
- Integration points between components
- Mock-based testing of external dependencies

**Property-Based Tests** focus on:
- Universal properties that hold for all inputs
- Comprehensive input coverage through randomization
- Invariants that must be maintained
- Round-trip properties (serialize/deserialize, encode/decode)
- Metamorphic properties (relationships between operations)

Together, unit tests catch concrete bugs while property tests verify general correctness across the input space.

### Property-Based Testing Configuration

**Library Selection**: Use `fast-check` for TypeScript/JavaScript property-based testing

**Test Configuration**:
- Minimum 100 iterations per property test (due to randomization)
- Each property test must reference its design document property
- Tag format: `// Feature: rsi-screener-improvements, Property {number}: {property_text}`

**Example Property Test**:
```typescript
import fc from 'fast-check'

// Feature: rsi-screener-improvements, Property 1: Delta merge completeness
test('delta merge produces complete ticker state', () => {
  fc.assert(
    fc.property(
      fc.record({
        symbol: fc.string({ minLength: 1 }),
        lastPrice: fc.double({ min: 0.01, max: 100000 }),
        volume: fc.double({ min: 0, max: 1000000 }),
        open: fc.double({ min: 0.01, max: 100000 }),
        high: fc.double({ min: 0.01, max: 100000 }),
        low: fc.double({ min: 0.01, max: 100000 }),
        lastUpdate: fc.integer({ min: 0 }),
        isStale: fc.boolean()
      }),
      fc.record({
        symbol: fc.string({ minLength: 1 }),
        lastPrice: fc.double({ min: 0.01, max: 100000 }),
        volume: fc.option(fc.double({ min: 0, max: 1000000 }))
      }),
      (currentState, delta) => {
        const merged = mergeDeltaUpdate(currentState, delta)
        
        // Verify all required fields are present
        expect(merged).toHaveProperty('symbol')
        expect(merged).toHaveProperty('lastPrice')
        expect(merged).toHaveProperty('volume')
        expect(merged).toHaveProperty('high')
        expect(merged).toHaveProperty('low')
        expect(merged).toHaveProperty('open')
        expect(merged).toHaveProperty('lastUpdate')
        expect(merged).toHaveProperty('isStale')
        
        // Verify values are valid
        expect(isFinite(merged.lastPrice)).toBe(true)
        expect(merged.isStale).toBe(false)
      }
    ),
    { numRuns: 100 }
  )
})
```

### Unit Test Examples

**Edge Case Testing**:
```typescript
describe('Data Validation', () => {
  test('should reject kline with NaN values', () => {
    const kline = {
      timestamp: Date.now(),
      open: NaN,
      high: 100,
      low: 90,
      close: 95,
      volume: 1000
    }
    
    const result = validateKline(kline)
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Kline contains NaN or Infinity values')
  })
  
  test('should accept kline with zero volume but warn', () => {
    const kline = {
      timestamp: Date.now(),
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 0
    }
    
    const result = validateKline(kline)
    expect(result.isValid).toBe(true)
    expect(result.warnings).toContain('Volume is zero - volume-based indicators may be unreliable')
  })
})
```

**Integration Testing**:
```typescript
describe('Alert Coordination', () => {
  test('should prevent duplicate alerts within cooldown period', async () => {
    const alert: AlertEvent = {
      symbol: 'BTCUSDT',
      exchange: 'binance',
      timeframe: '5m',
      conditionType: 'rsi_oversold',
      value: 25,
      threshold: 30,
      priority: 'medium'
    }
    
    // First alert should fire
    const first = await coordinator.checkAndRecordAlert(alert)
    expect(first).toBe(true)
    
    // Second alert within cooldown should not fire
    const second = await coordinator.checkAndRecordAlert(alert)
    expect(second).toBe(false)
    
    // Verify only one record in database
    const logs = await db.alertLog.findMany({
      where: {
        symbol: alert.symbol,
        exchange: alert.exchange,
        timeframe: alert.timeframe,
        conditionType: alert.conditionType
      }
    })
    expect(logs).toHaveLength(1)
  })
})
```

### Test Coverage Goals

- **Unit Test Coverage**: 80% line coverage minimum
- **Property Test Coverage**: All 45 correctness properties implemented
- **Integration Test Coverage**: All critical paths (alert flow, data pipeline, configuration management)
- **E2E Test Coverage**: Key user workflows (configure alert, receive notification, view history)

### Testing Tools

- **Unit Testing**: Jest or Vitest
- **Property-Based Testing**: fast-check
- **Integration Testing**: Jest with test database
- **E2E Testing**: Playwright or Cypress
- **Mocking**: MSW (Mock Service Worker) for API mocking
- **Database Testing**: Prisma with SQLite test database

### Continuous Testing

- Run unit tests on every commit
- Run property tests on every PR
- Run integration tests on every PR
- Run E2E tests before deployment
- Monitor test execution time (target: <5 minutes for unit+property tests)
