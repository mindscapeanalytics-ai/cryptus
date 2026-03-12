import { calculateRsi } from '../lib/rsi';
import { calculateMacd, calculateStochRsi, calculateBollinger } from '../lib/indicators';

/**
 * Accuracy Validation Suite
 * Runs indicators against known patterns to ensure mathematical precision.
 */

function testIndicators() {
  console.log('--- RSIQ PRO Accuracy Audit ---');

  // Test 1: Trend Stability
  const clashingTrend = Array.from({ length: 100 }, (_, i) => 100 + i); // Strong uptrend
  const rsiValue = calculateRsi(clashingTrend, 14);
  console.log(`RSI Uptrend (Expected high): ${rsiValue}`);
  if (rsiValue && rsiValue > 80) console.log('✅ RSI Accuracy: OK');
  else console.error('❌ RSI Accuracy: Failed');

  // Test 2: MACD Depth Guard
  const shortData = [100, 101, 102, 101, 100];
  const macdShort = calculateMacd(shortData);
  console.log(`MACD Short Data (Expected null): ${macdShort}`);
  if (macdShort === null) console.log('✅ MACD Guard: OK');
  else console.error('❌ MACD Guard: Failed');

  // Test 3: MACD Stability (35+ bars)
  const longData = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i) * 5);
  const macdLong = calculateMacd(longData);
  console.log(`MACD Stable Data (Expected object):`, macdLong ? 'Success' : 'Null');
  if (macdLong !== null) console.log('✅ MACD Stability: OK');
  else console.error('❌ MACD Stability: Failed');

  // Test 4: Bollinger Position
  const bbData = [100, 100, 100, 100, 100, 110]; // Price spike at end
  const bb = calculateBollinger(bbData, 5);
  console.log(`BB Position at top (Expected ≈ 1): ${bb?.position}`);
  if (bb && bb.position >= 0.9) console.log('✅ BB Accuracy: OK');
  else console.error('❌ BB Accuracy: Failed');

  console.log('--- Audit Complete ---');
}

// Simple execution trigger
try {
  testIndicators();
} catch (err) {
  console.error('Audit failed to execute:', err);
}
