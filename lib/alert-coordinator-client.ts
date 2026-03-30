/**
 * Client-safe alert coordinator with in-memory cooldown tracking.
 * This module contains no database dependencies and can be safely imported in client components.
 */

class AlertCoordinatorClient {
  /** In-memory cooldown cache: key → last trigger timestamp (ms) */
  private cooldownCache: Map<string, number> = new Map()

  // ── Cooldown key ────────────────────────────────────────────────────────────

  /**
   * Returns a standardized cooldown key.
   * Format: `{symbol}:{exchange}:{timeframe}:{conditionType}`
   * Example: "BTCUSDT:binance:5m:OVERSOLD"
   */
  getCooldownKey(
    symbol: string,
    exchange: string,
    timeframe: string,
    conditionType: string,
  ): string {
    return `${symbol}:${exchange}:${timeframe}:${conditionType}`
  }

  // ── In-memory cooldown cache ────────────────────────────────────────────────

  /**
   * Returns true if the key is still within its cooldown window.
   */
  isInCooldown(key: string, cooldownMs: number): boolean {
    const lastTrigger = this.cooldownCache.get(key)
    if (lastTrigger === undefined) return false
    return Date.now() - lastTrigger < cooldownMs
  }

  /**
   * Records the current timestamp for the given key.
   */
  setCooldown(key: string): void {
    this.cooldownCache.set(key, Date.now())
  }

  /**
   * Removes the cooldown entry for the given key.
   */
  clearCooldown(key: string): void {
    this.cooldownCache.delete(key)
  }

  /**
   * Clears all in-memory cooldown entries.
   */
  clearAllCooldowns(): void {
    this.cooldownCache.clear()
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

export const alertCoordinator = new AlertCoordinatorClient()
