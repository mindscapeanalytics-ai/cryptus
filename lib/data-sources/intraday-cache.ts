/**
 * Intraday Data Cache
 * Caches Alpha Vantage and Twelve Data responses for 15min
 * Reduces API calls by 80%+ to stay within free tier limits
 * 
 * Copyright © 2024-2026 Mindscape Analytics LLC. All rights reserved.
 */

interface CachedData {
  symbol: string;
  interval: string;
  candles: any[];
  source: 'alphavantage' | 'twelvedata' | 'yahoo';
  cachedAt: number;
  expiresAt: number;
}

class IntradayCache {
  private cache = new Map<string, CachedData>();
  private cacheLifetime = 15 * 60 * 1000; // 15 minutes
  private hits = 0;
  private misses = 0;
  
  getCacheKey(symbol: string, interval: string): string {
    return `${symbol}:${interval}`;
  }
  
  get(symbol: string, interval: string): any[] | null {
    const key = this.getCacheKey(symbol, interval);
    const cached = this.cache.get(key);
    
    if (!cached) {
      this.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    this.hits++;
    return cached.candles;
  }
  
  set(
    symbol: string,
    interval: string,
    candles: any[],
    source: 'alphavantage' | 'twelvedata' | 'yahoo' = 'alphavantage'
  ): void {
    const key = this.getCacheKey(symbol, interval);
    this.cache.set(key, {
      symbol,
      interval,
      candles,
      source,
      cachedAt: Date.now(),
      expiresAt: Date.now() + this.cacheLifetime,
    });
  }
  
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    console.log('[IntradayCache] Cache cleared');
  }
  
  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, data] of this.cache.entries()) {
      if (now > data.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[IntradayCache] Cleaned ${cleaned} expired entries`);
    }
  }
  
  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;
    
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: hitRate.toFixed(1) + '%',
      entries: Array.from(this.cache.keys()),
    };
  }
  
  // Get cache entry with metadata
  getWithMetadata(symbol: string, interval: string): CachedData | null {
    const key = this.getCacheKey(symbol, interval);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return cached;
  }
}

// Singleton instance
export const intradayCache = new IntradayCache();

// Cleanup every 5 minutes (server-side only)
if (typeof window === 'undefined') {
  setInterval(() => {
    intradayCache.cleanup();
  }, 5 * 60 * 1000);
}

// Log stats every 30 minutes (development only)
if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
  setInterval(() => {
    const stats = intradayCache.getStats();
    if (stats.size > 0) {
      console.log('[IntradayCache] Stats:', stats);
    }
  }, 30 * 60 * 1000);
}
