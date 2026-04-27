/**
 * RSIQ Pro - SUPER_SIGNAL Caching Layer
 * Copyright © 2024-2026 Mindscape Analytics LLC. All rights reserved.
 *
 * LRU-based caching for component scores, cross-asset prices, and entropy values.
 * Reduces redundant computation and improves performance for high-frequency requests.
 */

import { LRUCache } from '../lru-cache';
import type { ComponentScore, CachedComponentScore } from './types';
import { getConfig } from './config';

// ── Cache Instances ───────────────────────────────────────────────

const CACHE_MAX_SIZE = 5000;

// Component score cache: stores all 5 component scores per symbol
const componentCache = new LRUCache<string, CachedComponentScore>(CACHE_MAX_SIZE);

// Cross-asset price cache: stores prices of correlated assets (BTC, ETH, Gold, Silver, DXY, etc.)
const crossAssetCache = new LRUCache<string, { price: number; timestamp: number }>(500);

// Entropy cache: stores computed entropy values per symbol
const entropyCache = new LRUCache<string, { entropy: number; timestamp: number }>(CACHE_MAX_SIZE);

// ── Cache Statistics ──────────────────────────────────────────────

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
}

const stats = {
  component: { hits: 0, misses: 0, evictions: 0 } as CacheStats,
  crossAsset: { hits: 0, misses: 0, evictions: 0 } as CacheStats,
  entropy: { hits: 0, misses: 0, evictions: 0 } as CacheStats,
};

// ── Component Score Cache ─────────────────────────────────────────

export function getCachedComponentScore(
  symbol: string,
  component: 'regime' | 'liquidity' | 'entropy' | 'crossAsset' | 'risk'
): ComponentScore | null {
  const config = getConfig();
  const key = `${symbol}:${component}`;
  const cached = componentCache.get(key);
  
  if (!cached) {
    stats.component.misses++;
    return null;
  }
  
  const now = Date.now();
  const ttl = config.cache.componentTtlMs;
  
  if (now - cached.timestamp > ttl) {
    componentCache.delete(key);
    stats.component.misses++;
    return null;
  }
  
  stats.component.hits++;
  return cached.score;
}

export function setCachedComponentScore(
  symbol: string,
  component: 'regime' | 'liquidity' | 'entropy' | 'crossAsset' | 'risk',
  score: ComponentScore
): void {
  const key = `${symbol}:${component}`;
  componentCache.set(key, {
    score,
    timestamp: Date.now(),
  });
}

// ── Cross-Asset Price Cache ───────────────────────────────────────

export function getCachedCrossAssetPrice(symbol: string): number | null {
  const config = getConfig();
  const cached = crossAssetCache.get(symbol);
  
  if (!cached) {
    stats.crossAsset.misses++;
    return null;
  }
  
  const now = Date.now();
  const ttl = config.cache.crossAssetTtlMs;
  
  if (now - cached.timestamp > ttl) {
    crossAssetCache.delete(symbol);
    stats.crossAsset.misses++;
    return null;
  }
  
  stats.crossAsset.hits++;
  return cached.price;
}

export function setCachedCrossAssetPrice(symbol: string, price: number): void {
  crossAssetCache.set(symbol, {
    price,
    timestamp: Date.now(),
  });
}

// ── Entropy Cache ─────────────────────────────────────────────────

export function getCachedEntropy(symbol: string): number | null {
  const config = getConfig();
  const cached = entropyCache.get(symbol);
  
  if (!cached) {
    stats.entropy.misses++;
    return null;
  }
  
  const now = Date.now();
  const ttl = config.cache.entropyTtlMs;
  
  if (now - cached.timestamp > ttl) {
    entropyCache.delete(symbol);
    stats.entropy.misses++;
    return null;
  }
  
  stats.entropy.hits++;
  return cached.entropy;
}

export function setCachedEntropy(symbol: string, entropy: number): void {
  entropyCache.set(symbol, {
    entropy,
    timestamp: Date.now(),
  });
}

// ── Cache Management ──────────────────────────────────────────────

/**
 * Clear all caches (for testing or manual refresh).
 */
export function clearAllCaches(): void {
  componentCache.clear();
  crossAssetCache.clear();
  entropyCache.clear();
  
  // Reset stats
  stats.component = { hits: 0, misses: 0, evictions: 0 };
  stats.crossAsset = { hits: 0, misses: 0, evictions: 0 };
  stats.entropy = { hits: 0, misses: 0, evictions: 0 };
}

/**
 * Invalidate cache for a specific symbol (all components).
 */
export function invalidateSymbolCache(symbol: string): void {
  const components = ['regime', 'liquidity', 'entropy', 'crossAsset', 'risk'] as const;
  
  for (const component of components) {
    const key = `${symbol}:${component}`;
    componentCache.delete(key);
  }
  
  entropyCache.delete(symbol);
  crossAssetCache.delete(symbol);
}

/**
 * Get cache statistics for monitoring.
 */
export function getCacheStats() {
  return {
    component: {
      ...stats.component,
      hitRate: stats.component.hits + stats.component.misses > 0
        ? stats.component.hits / (stats.component.hits + stats.component.misses)
        : 0,
      size: componentCache.size,
    },
    crossAsset: {
      ...stats.crossAsset,
      hitRate: stats.crossAsset.hits + stats.crossAsset.misses > 0
        ? stats.crossAsset.hits / (stats.crossAsset.hits + stats.crossAsset.misses)
        : 0,
      size: crossAssetCache.size,
    },
    entropy: {
      ...stats.entropy,
      hitRate: stats.entropy.hits + stats.entropy.misses > 0
        ? stats.entropy.hits / (stats.entropy.hits + stats.entropy.misses)
        : 0,
      size: entropyCache.size,
    },
  };
}

/**
 * Log cache statistics (for debugging).
 */
export function logCacheStats(): void {
  const cacheStats = getCacheStats();
  console.log('[super-signal] Cache Statistics:', {
    component: {
      hitRate: `${(cacheStats.component.hitRate * 100).toFixed(1)}%`,
      hits: cacheStats.component.hits,
      misses: cacheStats.component.misses,
      size: cacheStats.component.size,
    },
    crossAsset: {
      hitRate: `${(cacheStats.crossAsset.hitRate * 100).toFixed(1)}%`,
      hits: cacheStats.crossAsset.hits,
      misses: cacheStats.crossAsset.misses,
      size: cacheStats.crossAsset.size,
    },
    entropy: {
      hitRate: `${(cacheStats.entropy.hitRate * 100).toFixed(1)}%`,
      hits: cacheStats.entropy.hits,
      misses: cacheStats.entropy.misses,
      size: cacheStats.entropy.size,
    },
  });
}
