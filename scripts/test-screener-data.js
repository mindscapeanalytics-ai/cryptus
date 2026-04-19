#!/usr/bin/env node

/**
 * Screener Data Diagnostic Script
 * Tests the complete data pipeline to identify why columns show no data
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
  magenta: '\x1b[35m',
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

async function testBinanceKlines(symbol = 'BTCUSDT') {
  section(`Testing Binance Klines API for ${symbol}`);
  
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=1000`;
    log(`Fetching: ${url}`, 'cyan');
    
    const klines = await fetchJSON(url);
    
    log(`✓ Successfully fetched ${klines.length} klines`, 'green');
    
    if (klines.length > 0) {
      const latest = klines[klines.length - 1];
      log(`Latest candle: ${new Date(latest[0]).toISOString()}`, 'blue');
      log(`  Open: ${latest[1]}, High: ${latest[2]}, Low: ${latest[3]}, Close: ${latest[4]}`, 'blue');
      log(`  Volume: ${latest[5]}`, 'blue');
    }
    
    return klines;
  } catch (error) {
    log(`✗ Failed to fetch Binance klines: ${error.message}`, 'red');
    return null;
  }
}

async function testScreenerAPI() {
  section('Testing Screener API Endpoint');
  
  try {
    // Test with localhost - adjust port if needed
    const url = 'http://localhost:3000/api/screener?exchange=binance&limit=10';
    log(`Fetching: ${url}`, 'cyan');
    log('Note: Make sure your dev server is running on port 3000', 'yellow');
    
    const data = await fetchJSON(url);
    
    log(`✓ Successfully fetched screener data`, 'green');
    log(`  Total entries: ${data.data?.length || 0}`, 'blue');
    
    if (data.data && data.data.length > 0) {
      analyzeScreenerData(data.data);
    } else {
      log('✗ No data entries returned', 'red');
    }
    
    return data;
  } catch (error) {
    log(`✗ Failed to fetch screener API: ${error.message}`, 'red');
    log('  Make sure your Next.js dev server is running', 'yellow');
    return null;
  }
}

function analyzeScreenerData(entries) {
  section('Analyzing Screener Data Quality');
  
  const indicators = [
    'rsi', 'rsi5m', 'rsi15m', 'rsi1h', 'rsi4h',
    'ema9', 'ema21', 'ema50', 'ema100', 'ema200',
    'macd', 'macdSignal', 'macdHist',
    'bbUpper', 'bbMiddle', 'bbLower',
    'stochK', 'stochD',
    'atr', 'adx',
    'curCandleSize', 'curCandleVol', 'candleDirection', 'longCandle',
    'vol24h', 'volSpike'
  ];
  
  const stats = {};
  indicators.forEach(ind => {
    stats[ind] = { null: 0, valid: 0, total: entries.length };
  });
  
  entries.forEach((entry, idx) => {
    if (idx === 0) {
      log(`\nFirst Entry Analysis: ${entry.symbol}`, 'cyan');
      log(`  Price: ${entry.price}`, 'blue');
    }
    
    indicators.forEach(ind => {
      const value = entry[ind];
      if (value === null || value === undefined || value === '-') {
        stats[ind].null++;
        if (idx === 0) {
          log(`  ${ind}: NULL`, 'red');
        }
      } else {
        stats[ind].valid++;
        if (idx === 0) {
          log(`  ${ind}: ${value}`, 'green');
        }
      }
    });
  });
  
  section('Data Completeness Summary');
  
  const critical = [];
  const warnings = [];
  const good = [];
  
  indicators.forEach(ind => {
    const pct = ((stats[ind].valid / stats[ind].total) * 100).toFixed(1);
    const status = `${ind.padEnd(20)} ${stats[ind].valid}/${stats[ind].total} (${pct}%)`;
    
    if (stats[ind].valid === 0) {
      critical.push(ind);
      log(`✗ ${status}`, 'red');
    } else if (pct < 50) {
      warnings.push(ind);
      log(`⚠ ${status}`, 'yellow');
    } else {
      good.push(ind);
      log(`✓ ${status}`, 'green');
    }
  });
  
  section('Recommendations');
  
  if (critical.length > 0) {
    log('CRITICAL - Zero data for:', 'red');
    critical.forEach(ind => log(`  • ${ind}`, 'red'));
    log('\nPossible causes:', 'yellow');
    log('  1. Kline fetch is failing (check server logs)', 'yellow');
    log('  2. aggregateKlines not producing enough candles', 'yellow');
    log('  3. Indicator calculation functions have bugs', 'yellow');
    log('  4. klineCountThreshold (50) is too high', 'yellow');
  }
  
  if (warnings.length > 0) {
    log('\nWARNING - Partial data for:', 'yellow');
    warnings.forEach(ind => log(`  • ${ind}`, 'yellow'));
  }
  
  if (good.length > 0) {
    log('\nGOOD - Complete data for:', 'green');
    good.forEach(ind => log(`  • ${ind}`, 'green'));
  }
}

async function main() {
  log('Screener Data Diagnostic Tool', 'bright');
  log('Testing complete data pipeline from API to indicators\n', 'cyan');
  
  // Test 1: Direct Binance API
  const klines = await testBinanceKlines('BTCUSDT');
  
  if (klines && klines.length === 1000) {
    log('\n✓ Binance API is working correctly', 'green');
  } else {
    log('\n✗ Binance API issue detected', 'red');
  }
  
  // Test 2: Screener API
  await testScreenerAPI();
  
  section('Next Steps');
  log('1. Check server logs for kline fetch errors', 'cyan');
  log('2. Verify aggregateKlines is producing enough candles for each timeframe', 'cyan');
  log('3. Test indicator calculation functions with sample data', 'cyan');
  log('4. Consider lowering klineCountThreshold from 50 to allow progressive display', 'cyan');
}

main().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
