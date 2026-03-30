/**
 * LRU (Least Recently Used) Cache implementation using JavaScript Map insertion order.
 *
 * O(1) get and set operations:
 * - Map preserves insertion order
 * - On get: delete and re-insert to move to "most recently used" position
 * - On set: if at capacity, delete the first entry (Map.keys().next().value = LRU item)
 */

export interface CacheEntry<V> {
  value: V
  timestamp: number
}

export class LRUCache<K, V> {
  private readonly maxSize: number
  private readonly cache: Map<K, CacheEntry<V>>

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize
    this.cache = new Map()
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    // Move to MRU position: delete and re-insert
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.value
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing: delete first so re-insert moves it to MRU
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // Evict LRU: first key in Map is least recently used
      const lruKey = this.cache.keys().next().value as K
      this.cache.delete(lruKey)
    }

    this.cache.set(key, { value, timestamp: Date.now() })
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }

  keys(): IterableIterator<K> {
    return this.cache.keys()
  }

  entries(): IterableIterator<[K, CacheEntry<V>]> {
    return this.cache.entries()
  }
}

/**
 * Build a cache key for indicator results.
 */
export function getIndicatorCacheKey(
  symbol: string,
  exchange: string,
  timeframe: string,
  indicator: string,
): string {
  return `${symbol}:${exchange}:${timeframe}:${indicator}`
}
