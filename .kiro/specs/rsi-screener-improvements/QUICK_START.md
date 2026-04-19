# Quick Start - Fix Column Data Issues

## TL;DR

Run this command to diagnose the issue:

```bash
node scripts/diagnose-screener.js
```

Then follow the on-screen instructions.

---

## What Was Fixed

1. ✅ **Lowered threshold** from 50 to 20 candles - shows partial data instead of all dashes
2. ✅ **Added comprehensive logging** - see exactly what's happening
3. ✅ **Created diagnostic tool** - identifies root cause in seconds
4. ✅ **Fixed TypeScript errors** - all types properly defined

---

## Quick Diagnostic

### Step 1: Run Diagnostic Script
```bash
node scripts/diagnose-screener.js
```

### Step 2: Follow the Output

**If you see:**
```
✓ Successfully fetched 1000 klines
✓ Math checks out
✓ Good indicator coverage
```
→ **Everything works!** Check your UI.

**If you see:**
```
✗ CRITICAL: Binance returned empty array
```
→ **You're geo-blocked.** Use VPN or switch to Bybit.

**If you see:**
```
✗ Failed to fetch screener API
```
→ **Dev server not running.** Run `npm run dev`.

---

## Common Issues & Solutions

### Issue: Binance API Blocked 🌍

**Solution 1: Use VPN**
- Install VPN
- Connect to non-restricted region
- Restart dev server

**Solution 2: Switch to Bybit**
```
http://localhost:3000/?exchange=bybit
```

**Solution 3: Use Yahoo Finance**
- Already works for stocks/forex
- No changes needed

### Issue: Still Seeing Dashes

**Solution: Enable Debug Logging**
```bash
echo "SCREENER_DEBUG=1" >> .env.local
npm run dev
```

Then check server logs for:
- `[screener] ${sym}: Fetched X 1m klines`
- `[screener] ${sym}: ✅ Entry built successfully`

---

## What to Expect

### Before Fixes:
- Columns show dashes (-)
- No visibility into what's wrong
- Hard to diagnose

### After Fixes:
- Columns show data (even partial)
- Clear diagnostic output
- Easy to identify root cause

---

## Need More Help?

1. Read `FINAL_DIAGNOSTIC_SUMMARY.md` for complete details
2. Read `DIAGNOSTIC_FIXES_APPLIED.md` for technical details
3. Read `COLUMN_DATA_ROOT_CAUSE.md` for deep analysis

---

## Quick Commands

```bash
# Diagnose issue
node scripts/diagnose-screener.js

# Enable debug logging
echo "SCREENER_DEBUG=1" >> .env.local

# Start dev server
npm run dev

# Test Binance API directly
curl "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=1000"

# Test screener API
curl "http://localhost:3000/api/screener?exchange=binance&limit=5"
```

---

**That's it!** The diagnostic script will guide you through the rest.
