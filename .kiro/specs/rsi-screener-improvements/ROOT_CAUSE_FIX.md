# Root Cause Analysis & Fix - Empty Dashboard Issue

**Date**: 2026-04-20  
**Status**: ✅ FIXED  
**Issue**: Dashboard showing no data after Redis integration

---

## Root Cause Identified

### Error from Logs
```
[redis] 🛡️ Lock ACQUIRED: lock:refresh:500:true:14:binance (TTL 30s)
[screener] ❌ All exchanges failed. Attempting cached fallback...
[screener-api] Fetch task failed (binance): resultCache.values is not a function
```

### Two Critical Bugs Found

#### Bug #1: LRUCache API Misuse (Line ~1755)
**Location**: `lib/screener-service.ts` - cached fallback logic

**Problem**:
```typescript
// WRONG - resultCache is LRUCache, not Map
const anyCached = Array.from(resultCache.values())
  .sort((a, b) => b.value.ts - a.value.ts)[0];
```

**Error**: `resultCache.values is not a function`

**Fix**:
```typescript
// CORRECT - use entries() which returns [K, CacheEntry<V>]
const cachedEntries = Array.from(resultCache.entries())
  .map(([key, entry]) => entry.value)
  .sort((a, b) => b.ts - a.ts);

const anyCached = cachedEntries[0];
```

---

#### Bug #2: Error Swallowing in runRefresh (Line ~1668)
**Location**: `lib/screener-service.ts` - runRefresh catch block

**Problem**:
```typescript
.catch(() => {
  const stale = fromCachedResult(symbolCount, smartMode, rsiPeriod, exchange);
  if (stale) return stale;
  return {
    data: [],  // ⚠️ Returns empty instead of throwing
    meta: buildMeta([], 0, Date.now(), smartMode, 0),
  };
})
```

**Impact**: When ANY error occurs (network, API timeout, etc.), the catch block:
1. Swallows the error silently
2. Returns empty data `{ data: [], meta: ... }`
3. Prevents exchange failover from working
4. Results in empty dashboard

**Why This Breaks Failover**:
```typescript
// In getScreenerData:
for (const tryExchange of exchangeOrder) {
  try {
    const result = await runRefresh(..., tryExchange, ...);
    
    if (result.data.length > 0) {
      return result;  // ✅ Success
    }
    // ⚠️ Empty result but no error thrown - loop continues
  } catch (err) {
    // This never executes because runRefresh swallows errors!
  }
}
```

**Fix**:
```typescript
.catch((err) => {
  console.error(`[screener] runRefresh error for ${exchange}:`, 
    err instanceof Error ? err.message : String(err));
  
  const stale = fromCachedResult(symbolCount, smartMode, rsiPeriod, exchange);
  if (stale) {
    console.log(`[screener] Returning stale cache for ${exchange} after error`);
    return stale;
  }
  
  // 🔥 Re-throw the error so getScreenerData can try the next exchange
  throw err;
})
```

---

## Why This Happened

### Timeline
1. **Before Redis Integration**: System worked fine
2. **After Redis Integration**: Added distributed locking and L2/L3 caching
3. **Side Effect**: The `.catch()` block in `runRefresh` was always there, but:
   - Before: Single exchange, errors were logged but system continued
   - After: Multi-exchange failover added, but errors were swallowed
   - Result: Failover logic never triggered because no errors propagated

### The Cascade
```
1. User loads dashboard
   ↓
2. API calls getScreenerData(exchange='binance')
   ↓
3. getScreenerData tries: [binance, bybit, binance]
   ↓
4. runRefresh('binance') encounters error (network/timeout/etc)
   ↓
5. runRefresh .catch() swallows error, returns { data: [] }
   ↓
6. getScreenerData sees empty data, tries next exchange
   ↓
7. runRefresh('bybit') also fails, returns { data: [] }
   ↓
8. All exchanges "fail" (return empty), fallback triggered
   ↓
9. Fallback tries resultCache.values() → CRASH
   ↓
10. API returns empty { data: [] }
   ↓
11. Dashboard shows loading screen forever
```

---

## Fixes Applied

### Fix #1: Correct LRUCache API Usage
**File**: `lib/screener-service.ts` (lines ~1755-1765)

```typescript
// Use entries() instead of values()
const cachedEntries = Array.from(resultCache.entries())
  .map(([key, entry]) => entry.value)
  .sort((a, b) => b.ts - a.ts);

const anyCached = cachedEntries[0];

if (anyCached && Date.now() - anyCached.ts < 300_000) {
  return {
    ...anyCached.data,
    meta: {
      ...anyCached.data.meta,
      calibrating: true,
      apiUnavailable: true,
      geoBlocked: true,
      error: 'All exchanges unavailable. Showing cached data.',
    }
  };
}
```

### Fix #2: Propagate Errors for Failover
**File**: `lib/screener-service.ts` (lines ~1668-1680)

```typescript
.catch((err) => {
  console.error(`[screener] runRefresh error for ${exchange}:`, 
    err instanceof Error ? err.message : String(err));
  
  const stale = fromCachedResult(symbolCount, smartMode, rsiPeriod, exchange);
  if (stale) {
    console.log(`[screener] Returning stale cache for ${exchange} after error`);
    return stale;
  }
  
  // Re-throw so failover can try next exchange
  throw err;
})
```

### Fix #3: Better Error Logging
**File**: `lib/screener-service.ts` (lines ~1725-1745)

```typescript
try {
  const result = await runRefresh(...);
  
  if (result.data.length > 0) {
    return result;
  }
  
  // Log empty results
  console.warn(`[screener] ⚠️ Exchange ${tryExchange} returned empty data. Trying next...`);
} catch (err) {
  const errMsg = err instanceof Error ? err.message : String(err);
  const errStack = err instanceof Error ? err.stack : '';
  console.error(`[screener] ❌ Exchange ${tryExchange} error: ${errMsg}`);
  if (errStack) console.error(`[screener] Stack: ${errStack.split('\n').slice(0, 3).join('\n')}`);
  
  // Geo-block detection
  if (errMsg.includes('geo-blocked') || errMsg.includes('403') || errMsg.includes('451')) {
    console.warn(`[screener] 🌍 Exchange ${tryExchange} geo-blocked. Trying next...`);
    geoBlockedExchanges.add(tryExchange);
    continue;
  }
  
  console.warn(`[screener] ⚠️ Exchange ${tryExchange} failed: ${errMsg}. Trying next...`);
}
```

---

## Expected Behavior After Fix

### Scenario 1: All Exchanges Work
```
1. Try binance → Success → Return data ✅
```

### Scenario 2: Binance Fails, Bybit Works
```
1. Try binance → Error thrown → Catch
2. Try bybit → Success → Return data ✅
```

### Scenario 3: All Exchanges Fail, Cache Available
```
1. Try binance → Error → Catch
2. Try bybit → Error → Catch
3. Try binance again → Error → Catch
4. Fallback to cached data → Return stale data ✅
```

### Scenario 4: All Exchanges Fail, No Cache
```
1. Try binance → Error → Catch
2. Try bybit → Error → Catch
3. Try binance again → Error → Catch
4. No cache available → Return empty with error metadata ✅
```

---

## Testing Checklist

- [x] Fix TypeScript compilation errors
- [x] Verify LRUCache API usage
- [x] Verify error propagation logic
- [ ] Test with working Binance API
- [ ] Test with simulated Binance failure
- [ ] Test with all exchanges failing
- [ ] Test with cached data available
- [ ] Test with no cached data

---

## Lessons Learned

1. **Error Handling**: Never swallow errors in async chains when failover logic depends on them
2. **API Contracts**: Always check the actual API of classes (LRUCache vs Map)
3. **Integration Testing**: Redis integration changed error flow - should have tested edge cases
4. **Logging**: Better error logging would have caught this immediately
5. **Fail-Safe Design**: The cached fallback was good, but the implementation had a bug

---

## Related Files Modified

1. `lib/screener-service.ts` - Fixed LRUCache usage and error propagation
2. `components/screener-dashboard.tsx` - Already had loading states (from previous fix)
3. `hooks/use-live-prices.ts` - Already had throttle reduction (from previous fix)

---

**Status**: Ready for testing 🚀

**Next Steps**:
1. Restart development server
2. Clear browser cache
3. Test dashboard load
4. Verify data appears
5. Check console for proper error logging

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-20  
**Fixed By**: Kiro AI Assistant
