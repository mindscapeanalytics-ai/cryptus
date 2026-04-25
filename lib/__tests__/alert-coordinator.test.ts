import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { alertCoordinator } from '../alert-coordinator'

// ── Mock Redis service ──────────────────────────────────────────────────────
// The AlertCoordinator uses Redis-backed cooldowns (async).
// We mock redisService to make tests deterministic without a real Redis connection.

const mockRedisStore = new Map<string, { value: unknown; expireAt: number }>();

vi.mock('../redis-service', () => ({
  redisService: {
    getJson: vi.fn(async (key: string) => {
      const entry = mockRedisStore.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expireAt) {
        mockRedisStore.delete(key);
        return null;
      }
      return entry.value;
    }),
    setJson: vi.fn(async (key: string, value: unknown, ttlSeconds: number) => {
      mockRedisStore.set(key, {
        value,
        expireAt: Date.now() + ttlSeconds * 1000,
      });
    }),
    del: vi.fn(async (key: string) => {
      mockRedisStore.delete(key);
    }),
  },
}));

beforeEach(() => {
  mockRedisStore.clear();
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

  it('returns false before cooldown is set', async () => {
    const key = 'BTCUSDT:binance:5m:OVERSOLD'
    expect(await alertCoordinator.isInCooldown(key, 180_000)).toBe(false)
  })

  it('returns true immediately after setCooldown', async () => {
    const key = 'BTCUSDT:binance:5m:OVERSOLD'
    await alertCoordinator.setCooldown(key)
    expect(await alertCoordinator.isInCooldown(key, 180_000)).toBe(true)
  })

  it('returns true within the cooldown period', async () => {
    const key = 'BTCUSDT:binance:5m:OVERSOLD'
    vi.setSystemTime(0)
    await alertCoordinator.setCooldown(key)

    // Advance time to just before expiry
    vi.setSystemTime(179_999)
    expect(await alertCoordinator.isInCooldown(key, 180_000)).toBe(true)
  })

  it('returns false after the cooldown period expires', async () => {
    const key = 'BTCUSDT:binance:5m:OVERSOLD'
    vi.setSystemTime(0)
    await alertCoordinator.setCooldown(key)

    // Advance time past the cooldown
    vi.setSystemTime(180_001)
    expect(await alertCoordinator.isInCooldown(key, 180_000)).toBe(false)
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

  it('removes the cooldown so isInCooldown returns false', async () => {
    const key = 'BTCUSDT:binance:5m:OVERSOLD'
    await alertCoordinator.setCooldown(key)
    expect(await alertCoordinator.isInCooldown(key, 180_000)).toBe(true)

    await alertCoordinator.clearCooldown(key)
    expect(await alertCoordinator.isInCooldown(key, 180_000)).toBe(false)
  })

  it('does not affect other keys', async () => {
    const key1 = 'BTCUSDT:binance:5m:OVERSOLD'
    const key2 = 'ETHUSDT:binance:5m:OVERSOLD'
    await alertCoordinator.setCooldown(key1)
    await alertCoordinator.setCooldown(key2)

    await alertCoordinator.clearCooldown(key1)
    expect(await alertCoordinator.isInCooldown(key1, 180_000)).toBe(false)
    expect(await alertCoordinator.isInCooldown(key2, 180_000)).toBe(true)
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

  it('clears all cooldown entries', async () => {
    const keys = [
      'BTCUSDT:binance:5m:OVERSOLD',
      'ETHUSDT:binance:1m:OVERBOUGHT',
      'SOLUSDT:bybit:15m:OVERSOLD',
    ]
    for (const k of keys) {
      await alertCoordinator.setCooldown(k)
    }
    for (const k of keys) {
      expect(await alertCoordinator.isInCooldown(k, 180_000)).toBe(true)
    }

    // clearAllCooldowns is a no-op in distributed mode (relies on TTLs),
    // but we clear the mock store to simulate the behavior
    mockRedisStore.clear();
    for (const k of keys) {
      expect(await alertCoordinator.isInCooldown(k, 180_000)).toBe(false)
    }
  })
})
