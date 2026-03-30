import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { alertCoordinator } from '../alert-coordinator'

beforeEach(() => {
  alertCoordinator.clearAllCooldowns()
})

// ── getCooldownKey ─────────────────────────────────────────────────────────────

describe('getCooldownKey', () => {
  it('produces the correct format', () => {
    const key = alertCoordinator.getCooldownKey('BTCUSDT', 'binance', '5m', 'OVERSOLD')
    expect(key).toBe('BTCUSDT:binance:5m:OVERSOLD')
  })

  it('handles different values correctly', () => {
    expect(alertCoordinator.getCooldownKey('ETHUSDT', 'bybit', '1h', 'OVERBOUGHT'))
      .toBe('ETHUSDT:bybit:1h:OVERBOUGHT')
  })
})

// ── isInCooldown / setCooldown ─────────────────────────────────────────────────

describe('isInCooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns false before cooldown is set', () => {
    const key = 'BTCUSDT:binance:5m:OVERSOLD'
    expect(alertCoordinator.isInCooldown(key, 180_000)).toBe(false)
  })

  it('returns true immediately after setCooldown', () => {
    const key = 'BTCUSDT:binance:5m:OVERSOLD'
    alertCoordinator.setCooldown(key)
    expect(alertCoordinator.isInCooldown(key, 180_000)).toBe(true)
  })

  it('returns true within the cooldown period', () => {
    const key = 'BTCUSDT:binance:5m:OVERSOLD'
    vi.setSystemTime(0)
    alertCoordinator.setCooldown(key)

    // Advance time to just before expiry
    vi.setSystemTime(179_999)
    expect(alertCoordinator.isInCooldown(key, 180_000)).toBe(true)
  })

  it('returns false after the cooldown period expires', () => {
    const key = 'BTCUSDT:binance:5m:OVERSOLD'
    vi.setSystemTime(0)
    alertCoordinator.setCooldown(key)

    // Advance time past the cooldown
    vi.setSystemTime(180_001)
    expect(alertCoordinator.isInCooldown(key, 180_000)).toBe(false)
  })
})

// ── clearCooldown ──────────────────────────────────────────────────────────────

describe('clearCooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('removes the cooldown so isInCooldown returns false', () => {
    const key = 'BTCUSDT:binance:5m:OVERSOLD'
    alertCoordinator.setCooldown(key)
    expect(alertCoordinator.isInCooldown(key, 180_000)).toBe(true)

    alertCoordinator.clearCooldown(key)
    expect(alertCoordinator.isInCooldown(key, 180_000)).toBe(false)
  })

  it('does not affect other keys', () => {
    const key1 = 'BTCUSDT:binance:5m:OVERSOLD'
    const key2 = 'ETHUSDT:binance:5m:OVERSOLD'
    alertCoordinator.setCooldown(key1)
    alertCoordinator.setCooldown(key2)

    alertCoordinator.clearCooldown(key1)
    expect(alertCoordinator.isInCooldown(key1, 180_000)).toBe(false)
    expect(alertCoordinator.isInCooldown(key2, 180_000)).toBe(true)
  })
})

// ── clearAllCooldowns ──────────────────────────────────────────────────────────

describe('clearAllCooldowns', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('clears all cooldown entries', () => {
    const keys = [
      'BTCUSDT:binance:5m:OVERSOLD',
      'ETHUSDT:binance:1m:OVERBOUGHT',
      'SOLUSDT:bybit:15m:OVERSOLD',
    ]
    keys.forEach((k) => alertCoordinator.setCooldown(k))
    keys.forEach((k) => expect(alertCoordinator.isInCooldown(k, 180_000)).toBe(true))

    alertCoordinator.clearAllCooldowns()
    keys.forEach((k) => expect(alertCoordinator.isInCooldown(k, 180_000)).toBe(false))
  })
})
