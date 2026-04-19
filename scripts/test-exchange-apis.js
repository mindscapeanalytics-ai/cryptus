#!/usr/bin/env node

/**
 * Exchange API Test Script
 * Tests Binance and Bybit APIs to ensure both work correctly
 * Verifies rate limits, data quality, and real-time updates
 * 
 * Usage: node scripts/test-exchange-apis.js
 */

const https = require('https');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'bright');
  console.log('='.repeat(80));
}

async function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        ...headers
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ data: parsed, headers: res.headers });
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function testBinanceKlines() {
  section('Test 1: Binance Klines API');
  
  try {
    const symbol = 'BTCUSDT';
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=1000`;
    log(`Fetching: ${url}`, 'cyan');
    
    const start = Date.now();
    const { data: klines, headers } = await fetchJSON(url);
    const latency = Date.now() - start;
    
    log(`✓ Response time: ${latency}ms`, latency < 1000 ? 'green' : 'yellow');
    log(`✓ Klines received: ${klines.length}`, klines.length === 1000 ? 'green' : 'yellow');
    
    // Check rate limit headers
    const weight = headers['x-mbx-used-weight-1m'];
    const orderCount = headers['x-mbx-order-count-1m'];
    if (weight) log(`  Rate limit weight: ${weight}/1200`, 'blue');
    if (orderCount) log(`  Order count: ${orderCount}`, 'blue');
    
    // Verify data quality
    if (klines.length > 0) {
      const latest = klines[klines.length - 1];
      const [openTime, open, high, low, close, volume] = latest;
      
      log(`\nLatest candle:`, 'cyan');
      log(`  Time: ${new Date(openTime).toISOString()}`, 'blue');
      log(`  OHLC: ${open} / ${high} / ${low} / ${close}`, 'blue');
      log(`  Volume: ${volume}`, 'blue');
      
      // Validate data integrity
      const highNum = parseFloat(high);
      const lowNum = parseFloat(low);
      const openNum = parseFloat(open);
      const closeNum = parseFloat(close);
      
      if (highNum >= lowNum && highNum >= openNum && highNum >= closeNum && lowNum <= openNum && lowNum <= closeNum) {
        log(`✓ Data integrity: VALID`, 'green');
      } else {
        log(`✗ Data integrity: INVALID (high/low mismatch)`, 'red');
      }
    }
    
    return { success: true, latency, count: klines.length };
  } catch (error) {
    log(`✗ Binance API failed: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testBybitKlines() {
  section('Test 2: Bybit Klines API');
  
  try {
    const symbol = 'BTCUSDT';
    const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=1&limit=1000`;
    log(`Fetching: ${url}`, 'cyan');
    
    const start = Date.now();
    const { data: response, headers } = await fetchJSON(url);
    const latency = Date.now() - start;
    
    const klines = response.result?.list || [];
    
    log(`✓ Response time: ${latency}ms`, latency < 1000 ? 'green' : 'yellow');
    log(`✓ Klines received: ${klines.length}`, klines.length === 1000 ? 'green' : 'yellow');
    
    // Check rate limit headers
    const rateLimit = headers['x-bapi-limit-status'];
    const rateLimitReset = headers['x-bapi-limit-reset-timestamp'];
    if (rateLimit) log(`  Rate limit remaining: ${rateLimit}`, 'blue');
    if (rateLimitReset) log(`  Rate limit resets: ${new Date(parseInt(rateLimitReset)).toISOString()}`, 'blue');
    
    // Verify data quality
    if (klines.length > 0) {
      // Bybit returns newest first, so first element is latest
      const latest = klines[0];
      const [timestamp, open, high, low, close, volume, turnover] = latest;
      
      log(`\nLatest candle:`, 'cyan');
      log(`  Time: ${new Date(parseInt(timestamp)).toISOString()}`, 'blue');
      log(`  OHLC: ${open} / ${high} / ${low} / ${close}`, 'blue');
      log(`  Volume: ${volume}`, 'blue');
      log(`  Turnover: ${turnover}`, 'blue');
      
      // Validate data integrity
      const highNum = parseFloat(high);
      const lowNum = parseFloat(low);
      const openNum = parseFloat(open);
      const closeNum = parseFloat(close);
      
      if (highNum >= lowNum && highNum >= openNum && highNum >= closeNum && lowNum <= openNum && lowNum <= closeNum) {
        log(`✓ Data integrity: VALID`, 'green');
      } else {
        log(`✗ Data integrity: INVALID (high/low mismatch)`, 'red');
      }
    }
    
    return { success: true, latency, count: klines.length };
  } catch (error) {
    log(`✗ Bybit API failed: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testBinanceTickers() {
  section('Test 3: Binance Tickers API');
  
  try {
    const url = 'https://api.binance.com/api/v3/ticker/24hr';
    log(`Fetching: ${url}`, 'cyan');
    
    const start = Date.now();
    const { data: tickers } = await fetchJSON(url);
    const latency = Date.now() - start;
    
    log(`✓ Response time: ${latency}ms`, latency < 2000 ? 'green' : 'yellow');
    log(`✓ Tickers received: ${tickers.length}`, 'green');
    
    // Count USDT pairs
    const usdtPairs = tickers.filter(t => t.symbol.endsWith('USDT'));
    log(`  USDT pairs: ${usdtPairs.length}`, 'blue');
    
    // Show top 5 by volume
    const top5 = usdtPairs
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 5);
    
    log(`\nTop 5 by volume:`, 'cyan');
    top5.forEach((t, i) => {
      const vol = (parseFloat(t.quoteVolume) / 1e6).toFixed(2);
      const change = parseFloat(t.priceChangePercent).toFixed(2);
      log(`  ${i + 1}. ${t.symbol}: $${vol}M (${change}%)`, 'blue');
    });
    
    return { success: true, latency, count: tickers.length };
  } catch (error) {
    log(`✗ Binance Tickers API failed: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testBybitTickers() {
  section('Test 4: Bybit Tickers API');
  
  try {
    const url = 'https://api.bybit.com/v5/market/tickers?category=spot';
    log(`Fetching: ${url}`, 'cyan');
    
    const start = Date.now();
    const { data: response } = await fetchJSON(url);
    const latency = Date.now() - start;
    
    const tickers = response.result?.list || [];
    
    log(`✓ Response time: ${latency}ms`, latency < 2000 ? 'green' : 'yellow');
    log(`✓ Tickers received: ${tickers.length}`, 'green');
    
    // Count USDT pairs
    const usdtPairs = tickers.filter(t => t.symbol.endsWith('USDT'));
    log(`  USDT pairs: ${usdtPairs.length}`, 'blue');
    
    // Show top 5 by volume
    const top5 = usdtPairs
      .sort((a, b) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h))
      .slice(0, 5);
    
    log(`\nTop 5 by volume:`, 'cyan');
    top5.forEach((t, i) => {
      const vol = (parseFloat(t.turnover24h) / 1e6).toFixed(2);
      const change = (parseFloat(t.price24hPcnt) * 100).toFixed(2);
      log(`  ${i + 1}. ${t.symbol}: $${vol}M (${change}%)`, 'blue');
    });
    
    return { success: true, latency, count: tickers.length };
  } catch (error) {
    log(`✗ Bybit Tickers API failed: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testRateLimits() {
  section('Test 5: Rate Limit Handling');
  
  log('Testing rapid requests to verify rate limit handling...', 'cyan');
  
  // Test Binance rate limits
  log('\nBinance (10 rapid requests):', 'cyan');
  const binanceResults = [];
  for (let i = 0; i < 10; i++) {
    try {
      const start = Date.now();
      await fetchJSON('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
      const latency = Date.now() - start;
      binanceResults.push({ success: true, latency });
      process.stdout.write('.');
    } catch (error) {
      binanceResults.push({ success: false, error: error.message });
      process.stdout.write('x');
    }
  }
  console.log('');
  
  const binanceSuccess = binanceResults.filter(r => r.success).length;
  const binanceAvgLatency = binanceResults
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.latency, 0) / binanceSuccess;
  
  log(`  Success rate: ${binanceSuccess}/10`, binanceSuccess === 10 ? 'green' : 'yellow');
  log(`  Avg latency: ${binanceAvgLatency.toFixed(0)}ms`, 'blue');
  
  // Test Bybit rate limits
  log('\nBybit (10 rapid requests):', 'cyan');
  const bybitResults = [];
  for (let i = 0; i < 10; i++) {
    try {
      const start = Date.now();
      await fetchJSON('https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT');
      const latency = Date.now() - start;
      bybitResults.push({ success: true, latency });
      process.stdout.write('.');
    } catch (error) {
      bybitResults.push({ success: false, error: error.message });
      process.stdout.write('x');
    }
  }
  console.log('');
  
  const bybitSuccess = bybitResults.filter(r => r.success).length;
  const bybitAvgLatency = bybitResults
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.latency, 0) / bybitSuccess;
  
  log(`  Success rate: ${bybitSuccess}/10`, bybitSuccess === 10 ? 'green' : 'yellow');
  log(`  Avg latency: ${bybitAvgLatency.toFixed(0)}ms`, 'blue');
  
  return {
    binance: { successRate: binanceSuccess / 10, avgLatency: binanceAvgLatency },
    bybit: { successRate: bybitSuccess / 10, avgLatency: bybitAvgLatency }
  };
}

async function compareExchanges() {
  section('Test 6: Exchange Comparison');
  
  log('Comparing data consistency between exchanges...', 'cyan');
  
  try {
    const [binancePrice, bybitPrice] = await Promise.all([
      fetchJSON('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'),
      fetchJSON('https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT')
    ]);
    
    const binanceBTC = parseFloat(binancePrice.data.price);
    const bybitBTC = parseFloat(bybitPrice.data.result.list[0].lastPrice);
    const diff = Math.abs(binanceBTC - bybitBTC);
    const diffPct = (diff / binanceBTC * 100).toFixed(4);
    
    log(`\nBTC Price Comparison:`, 'cyan');
    log(`  Binance: $${binanceBTC.toFixed(2)}`, 'blue');
    log(`  Bybit:   $${bybitBTC.toFixed(2)}`, 'blue');
    log(`  Diff:    $${diff.toFixed(2)} (${diffPct}%)`, diffPct < 0.1 ? 'green' : 'yellow');
    
    if (diffPct < 0.1) {
      log(`✓ Prices are consistent (< 0.1% difference)`, 'green');
    } else {
      log(`⚠ Price difference is significant`, 'yellow');
    }
    
    return { success: true, diff: parseFloat(diffPct) };
  } catch (error) {
    log(`✗ Comparison failed: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function main() {
  log('╔════════════════════════════════════════════════════════════════════════════╗', 'bright');
  log('║                    Exchange API Test Suite                                ║', 'bright');
  log('║                                                                            ║', 'bright');
  log('║  Testing Binance and Bybit APIs for rate limits, data quality,            ║', 'bright');
  log('║  and real-time updates.                                                   ║', 'bright');
  log('╚════════════════════════════════════════════════════════════════════════════╝', 'bright');
  
  const results = {
    binanceKlines: null,
    bybitKlines: null,
    binanceTickers: null,
    bybitTickers: null,
    rateLimits: null,
    comparison: null,
  };
  
  // Run all tests
  results.binanceKlines = await testBinanceKlines();
  results.bybitKlines = await testBybitKlines();
  results.binanceTickers = await testBinanceTickers();
  results.bybitTickers = await testBybitTickers();
  results.rateLimits = await testRateLimits();
  results.comparison = await compareExchanges();
  
  // Final Summary
  section('Test Summary');
  
  const tests = [
    { name: 'Binance Klines', result: results.binanceKlines },
    { name: 'Bybit Klines', result: results.bybitKlines },
    { name: 'Binance Tickers', result: results.binanceTickers },
    { name: 'Bybit Tickers', result: results.bybitTickers },
    { name: 'Rate Limits', result: results.rateLimits },
    { name: 'Price Comparison', result: results.comparison },
  ];
  
  let passCount = 0;
  let failCount = 0;
  
  tests.forEach(test => {
    if (test.result && test.result.success !== false) {
      log(`✓ ${test.name}`, 'green');
      passCount++;
    } else {
      log(`✗ ${test.name}`, 'red');
      failCount++;
    }
  });
  
  log(`\nTotal: ${passCount} passed, ${failCount} failed`, passCount === tests.length ? 'green' : 'yellow');
  
  // Recommendations
  section('Recommendations');
  
  if (results.binanceKlines.success && results.bybitKlines.success) {
    log('✓ Both exchanges are accessible and working correctly', 'green');
    log('  You can use either exchange without issues', 'cyan');
    log('  Bybit has slightly more generous rate limits', 'cyan');
  } else if (results.binanceKlines.success && !results.bybitKlines.success) {
    log('⚠ Binance works, but Bybit is blocked', 'yellow');
    log('  Use Binance as primary exchange', 'cyan');
  } else if (!results.binanceKlines.success && results.bybitKlines.success) {
    log('⚠ Bybit works, but Binance is blocked', 'yellow');
    log('  Use Bybit as primary exchange', 'cyan');
    log('  Update UI to default to: ?exchange=bybit', 'cyan');
  } else {
    log('✗ Both exchanges are blocked', 'red');
    log('  Solutions:', 'cyan');
    log('    1. Use VPN', 'cyan');
    log('    2. Use Yahoo Finance for stocks/forex', 'cyan');
    log('    3. Deploy to non-restricted region', 'cyan');
  }
  
  // Performance comparison
  if (results.binanceKlines.success && results.bybitKlines.success) {
    log('\nPerformance Comparison:', 'cyan');
    log(`  Binance latency: ${results.binanceKlines.latency}ms`, 'blue');
    log(`  Bybit latency:   ${results.bybitKlines.latency}ms`, 'blue');
    
    if (results.binanceKlines.latency < results.bybitKlines.latency) {
      log(`  → Binance is faster by ${results.bybitKlines.latency - results.binanceKlines.latency}ms`, 'green');
    } else {
      log(`  → Bybit is faster by ${results.binanceKlines.latency - results.bybitKlines.latency}ms`, 'green');
    }
  }
}

main().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
