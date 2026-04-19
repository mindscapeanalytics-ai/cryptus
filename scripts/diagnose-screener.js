#!/usr/bin/env node

/**
 * Screener Diagnostic Script
 * Tests the complete data pipeline to identify why columns show no data
 * 
 * Usage: node scripts/diagnose-screener.js
 */

const https = require('https');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'bright');
  console.log('='.repeat(80));
}

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function testBinanceAPI() {
  section('Test 1: Binance API Accessibility');
  
  try {
    const url = 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=1000';
    log(`Fetching: ${url}`, 'cyan');
    
    const klines = await fetchJSON(url);
    
    if (klines.length === 0) {
      log('✗ CRITICAL: Binance returned empty array', 'red');
      log('  Possible causes:', 'yellow');
      log('    1. Geo-blocking (most likely)', 'yellow');
      log('    2. API rate limit', 'yellow');
      log('    3. Network issues', 'yellow');
      log('  Solution: Use VPN or switch to Bybit exchange', 'cyan');
      return false;
    }
    
    log(`✓ Successfully fetched ${klines.length} klines`, 'green');
    
    if (klines.length < 1000) {
      log(`⚠ WARNING: Expected 1000 klines, got ${klines.length}`, 'yellow');
    }
    
    const latest = klines[klines.length - 1];
    log(`Latest candle: ${new Date(latest[0]).toISOString()}`, 'blue');
    log(`  OHLC: ${latest[1]} / ${latest[2]} / ${latest[3]} / ${latest[4]}`, 'blue');
    log(`  Volume: ${latest[5]}`, 'blue');
    
    return true;
  } catch (error) {
    log(`✗ CRITICAL: Failed to fetch Binance API: ${error.message}`, 'red');
    log('  This is the root cause of your issue!', 'red');
    log('  Solution: Use VPN or switch to Bybit exchange', 'cyan');
    return false;
  }
}

async function testAggregation() {
  section('Test 2: Candle Aggregation Math');
  
  const klines1m = 1000;
  const candles5m = Math.floor(klines1m / 5);
  const candles15m = Math.floor(klines1m / 15);
  const candles1h = Math.floor(klines1m / 60);
  
  log(`With ${klines1m} 1m klines:`, 'cyan');
  log(`  5m candles: ${candles5m} (need 15 for RSI)`, candles5m >= 15 ? 'green' : 'red');
  log(`  15m candles: ${candles15m} (need 15 for RSI)`, candles15m >= 15 ? 'green' : 'red');
  log(`  1h candles: ${candles1h} (need 15 for RSI)`, candles1h >= 15 ? 'green' : 'red');
  
  if (candles5m >= 15 && candles15m >= 15 && candles1h >= 15) {
    log('✓ Math checks out - aggregation should work', 'green');
    return true;
  } else {
    log('✗ Not enough candles for all timeframes', 'red');
    return false;
  }
}

async function testScreenerAPI() {
  section('Test 3: Screener API Endpoint');
  
  log('Note: Make sure your dev server is running on port 3000', 'yellow');
  log('Run: npm run dev', 'cyan');
  
  try {
    const url = 'http://localhost:3000/api/screener?exchange=binance&limit=5';
    log(`\nFetching: ${url}`, 'cyan');
    
    const data = await fetchJSON(url);
    
    if (!data.data || data.data.length === 0) {
      log('✗ CRITICAL: Screener API returned no data', 'red');
      log('  Check server logs for errors', 'yellow');
      return false;
    }
    
    log(`✓ Successfully fetched ${data.data.length} entries`, 'green');
    
    // Analyze first entry
    const entry = data.data[0];
    log(`\nFirst Entry: ${entry.symbol}`, 'cyan');
    log(`  Price: ${entry.price}`, 'blue');
    
    const indicators = [
      'rsi1m', 'rsi5m', 'rsi15m', 'rsi1h',
      'ema9', 'ema21',
      'macdLine', 'macdSignal', 'macdHistogram',
      'bbUpper', 'bbMiddle', 'bbLower',
      'stochK', 'stochD',
      'atr', 'adx',
      'curCandleSize', 'curCandleVol', 'candleDirection', 'longCandle',
    ];
    
    let nullCount = 0;
    let validCount = 0;
    
    indicators.forEach(ind => {
      const value = entry[ind];
      if (value === null || value === undefined || value === '-') {
        nullCount++;
        log(`  ${ind}: NULL`, 'red');
      } else {
        validCount++;
        log(`  ${ind}: ${value}`, 'green');
      }
    });
    
    log(`\nIndicator Coverage: ${validCount}/${indicators.length} (${Math.round(validCount/indicators.length*100)}%)`, 
        validCount > indicators.length / 2 ? 'green' : 'red');
    
    if (nullCount === indicators.length) {
      log('✗ CRITICAL: ALL indicators are null', 'red');
      log('  This means buildEntry is returning ticker-only entries', 'yellow');
      log('  Root cause: Kline fetch is failing or returning < 20 candles', 'yellow');
      return false;
    } else if (nullCount > indicators.length / 2) {
      log('⚠ WARNING: Most indicators are null', 'yellow');
      log('  Partial data available - some timeframes working', 'yellow');
      return true;
    } else {
      log('✓ Good indicator coverage', 'green');
      return true;
    }
  } catch (error) {
    log(`✗ Failed to fetch screener API: ${error.message}`, 'red');
    log('  Make sure your Next.js dev server is running', 'yellow');
    log('  Run: npm run dev', 'cyan');
    return false;
  }
}

async function checkEnvironment() {
  section('Test 4: Environment Configuration');
  
  const fs = require('fs');
  const path = require('path');
  
  const envFiles = ['.env', '.env.local'];
  let foundDebug = false;
  
  for (const file of envFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('SCREENER_DEBUG=1')) {
        foundDebug = true;
        log(`✓ Found SCREENER_DEBUG=1 in ${file}`, 'green');
      }
    }
  }
  
  if (!foundDebug) {
    log('⚠ SCREENER_DEBUG not enabled', 'yellow');
    log('  Add this to .env.local:', 'cyan');
    log('  SCREENER_DEBUG=1', 'cyan');
    log('  This will enable detailed logging', 'cyan');
  }
}

async function main() {
  log('╔════════════════════════════════════════════════════════════════════════════╗', 'bright');
  log('║                    Screener Data Diagnostic Tool                           ║', 'bright');
  log('║                                                                            ║', 'bright');
  log('║  This script tests the complete data pipeline to identify why columns     ║', 'bright');
  log('║  are showing no data (dashes).                                            ║', 'bright');
  log('╚════════════════════════════════════════════════════════════════════════════╝', 'bright');
  
  const results = {
    binanceAPI: false,
    aggregation: false,
    screenerAPI: false,
  };
  
  // Test 1: Binance API
  results.binanceAPI = await testBinanceAPI();
  
  // Test 2: Aggregation Math
  results.aggregation = await testAggregation();
  
  // Test 3: Environment
  await checkEnvironment();
  
  // Test 4: Screener API (only if Binance works)
  if (results.binanceAPI) {
    results.screenerAPI = await testScreenerAPI();
  } else {
    log('\nSkipping screener API test since Binance API is not accessible', 'yellow');
  }
  
  // Final Summary
  section('Diagnostic Summary');
  
  if (!results.binanceAPI) {
    log('ROOT CAUSE IDENTIFIED:', 'red');
    log('  Binance API is not accessible from your location', 'red');
    log('', 'reset');
    log('SOLUTIONS:', 'cyan');
    log('  1. Use a VPN to access Binance API', 'cyan');
    log('  2. Switch to Bybit exchange:', 'cyan');
    log('     - Update UI to use: ?exchange=bybit', 'cyan');
    log('  3. Use Yahoo Finance for stocks/forex (already implemented)', 'cyan');
  } else if (!results.screenerAPI) {
    log('ROOT CAUSE IDENTIFIED:', 'red');
    log('  Binance API works, but screener API is failing', 'red');
    log('', 'reset');
    log('NEXT STEPS:', 'cyan');
    log('  1. Check server logs for errors', 'cyan');
    log('  2. Look for "Insufficient klines" messages', 'cyan');
    log('  3. Look for "buildEntry returned null" messages', 'cyan');
    log('  4. Enable SCREENER_DEBUG=1 for detailed logs', 'cyan');
  } else {
    log('✓ All tests passed!', 'green');
    log('', 'reset');
    log('If you still see dashes in the UI:', 'cyan');
    log('  1. Check browser console for errors', 'cyan');
    log('  2. Check if data is being filtered out by UI logic', 'cyan');
    log('  3. Verify WebSocket connection is working', 'cyan');
  }
  
  section('Recommended Actions');
  log('1. Enable debug logging:', 'cyan');
  log('   echo "SCREENER_DEBUG=1" >> .env.local', 'blue');
  log('', 'reset');
  log('2. Restart dev server:', 'cyan');
  log('   npm run dev', 'blue');
  log('', 'reset');
  log('3. Check server logs for:', 'cyan');
  log('   - "[screener] ${sym}: Fetched X 1m klines"', 'blue');
  log('   - "[screener] ${sym}: Successfully built entry"', 'blue');
  log('   - Any error messages', 'blue');
  log('', 'reset');
  log('4. If Binance is blocked, switch to Bybit:', 'cyan');
  log('   - Update exchange selector in UI', 'blue');
  log('   - Or use: http://localhost:3000/?exchange=bybit', 'blue');
}

main().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
