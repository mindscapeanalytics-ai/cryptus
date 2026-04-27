/**
 * RSIQ Pro - SUPER_SIGNAL Fusion Engine
 * Copyright © 2024-2026 Mindscape Analytics LLC. All rights reserved.
 *
 * Fuses all component scores into a single composite SUPER_SIGNAL.
 * Implements weighted formula with per-asset-class weight overrides.
 */

import type { ComponentScores, SuperSignalResult, SuperSignalCategory, SuperSignalInput } from './types';
import { getConfig, getWeightsForAsset } from './config';
import { detectRegime } from './regime-detector';
import { analyzeLiquidity } from './liquidity-analyzer';
import { filterEntropy } from './entropy-filter';
import { validateCrossAsset } from './cross-asset-validator';
import { computeRisk } from './risk-engine';
import { auditLogger } from './audit-logger';
import { createHash } from 'crypto';

// ── Algorithm Version ─────────────────────────────────────────────

const ALGORITHM_VERSION = '1.0.0';

// ── Input Hashing ─────────────────────────────────────────────────

/**
 * Compute SHA-256 hash of input parameters for deterministic replay.
 * 
 * @param input - SuperSignalInput
 * @returns Hex-encoded SHA-256 hash
 */
function hashInput(input: SuperSignalInput): string {
  const serialized = JSON.stringify({
    symbol: input.symbol,
    price: input.price,
    assetClass: input.assetClass,
    rsi1m: input.rsi1m,
    rsi5m: input.rsi5m,
    rsi15m: input.rsi15m,
    rsi1h: input.rsi1h,
    rsi4h: input.rsi4h,
    rsi1d: input.rsi1d,
    atr: input.atr,
    adx: input.adx,
    vwap: input.vwap,
    vwapDiff: input.vwapDiff,
    volume24h: input.volume24h,
    avgVolume1m: input.avgVolume1m,
    curCandleVol: input.curCandleVol,
    change24h: input.change24h,
    strategySignal: input.strategySignal,
  });
  
  return createHash('sha256').update(serialized).digest('hex');
}

// ── Category Mapping ──────────────────────────────────────────────

/**
 * Map SUPER_SIGNAL value to category.
 * 
 * Thresholds (configurable):
 * - Strong Buy: > 75
 * - Buy: 60-75
 * - Neutral: 40-60
 * - Sell: 25-40
 * - Strong Sell: < 25
 */
function mapValueToCategory(value: number): SuperSignalCategory {
  const config = getConfig();
  const { strongBuy, buy, neutral, sell } = config.thresholds;
  
  if (value > strongBuy) return 'Strong Buy';
  if (value > buy) return 'Buy';
  if (value > neutral) return 'Neutral';
  if (value > sell) return 'Sell';
  return 'Strong Sell';
}

// ── Weighted Fusion ───────────────────────────────────────────────

/**
 * Compute weighted SUPER_SIGNAL from component scores.
 * 
 * Formula:
 * SUPER_SIGNAL = w1·RegimeScore + w2·LiquidityScore + w3·EntropyScore + w4·CrossAssetScore + w5·RiskScore
 * 
 * Note: Entropy score is already inverted (low entropy = high score) in the entropy filter.
 * 
 * @param components - Component scores
 * @param assetClass - Asset class for weight selection
 * @returns SUPER_SIGNAL value (0-100)
 */
function fuseComponents(components: ComponentScores, assetClass: string): number {
  const weights = getWeightsForAsset(assetClass as any);
  
  const value =
    weights.regime * components.regime.score +
    weights.liquidity * components.liquidity.score +
    weights.entropy * components.entropy.score +
    weights.crossAsset * components.crossAsset.score +
    weights.risk * components.risk.score;
  
  // Clamp to [0, 100]
  return Math.round(Math.max(0, Math.min(100, value)));
}

// ── Parallel Component Computation ───────────────────────────────

/**
 * Compute all 5 components in parallel using Promise.allSettled().
 * 
 * Failed components use neutral score (50) and log errors.
 * If >2 components fail, returns null (system-level failure).
 * 
 * @param input - SuperSignalInput
 * @returns ComponentScores or null if too many failures
 */
async function computeAllComponents(input: SuperSignalInput): Promise<ComponentScores | null> {
  const config = getConfig();
  
  // Create abort controller for timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), config.performance.timeoutMs);
  
  try {
    // Compute all components in parallel
    const results = await Promise.allSettled([
      detectRegime(input),
      analyzeLiquidity(input),
      filterEntropy(input),
      validateCrossAsset(input),
      computeRisk(input),
    ]);
    
    clearTimeout(timeoutId);
    
    // Extract component scores
    const [regimeResult, liquidityResult, entropyResult, crossAssetResult, riskResult] = results;
    
    const components: ComponentScores = {
      regime: regimeResult.status === 'fulfilled' ? regimeResult.value : { score: 50, error: 'Component failed' },
      liquidity: liquidityResult.status === 'fulfilled' ? liquidityResult.value : { score: 50, error: 'Component failed' },
      entropy: entropyResult.status === 'fulfilled' ? entropyResult.value : { score: 50, error: 'Component failed' },
      crossAsset: crossAssetResult.status === 'fulfilled' ? crossAssetResult.value : { score: 50, error: 'Component failed' },
      risk: riskResult.status === 'fulfilled' ? riskResult.value : { score: 50, error: 'Component failed' },
    };
    
    // Log component failures
    if (regimeResult.status === 'rejected') {
      auditLogger.logFailure(input.symbol, 'regime', String(regimeResult.reason), true);
    }
    if (liquidityResult.status === 'rejected') {
      auditLogger.logFailure(input.symbol, 'liquidity', String(liquidityResult.reason), true);
    }
    if (entropyResult.status === 'rejected') {
      auditLogger.logFailure(input.symbol, 'entropy', String(entropyResult.reason), true);
    }
    if (crossAssetResult.status === 'rejected') {
      auditLogger.logFailure(input.symbol, 'crossAsset', String(crossAssetResult.reason), true);
    }
    if (riskResult.status === 'rejected') {
      auditLogger.logFailure(input.symbol, 'risk', String(riskResult.reason), true);
    }
    
    // Count failures
    const failures = [
      regimeResult.status === 'rejected',
      liquidityResult.status === 'rejected',
      entropyResult.status === 'rejected',
      crossAssetResult.status === 'rejected',
      riskResult.status === 'rejected',
    ].filter(Boolean).length;
    
    // Check failure threshold
    if (failures > config.performance.maxComponentFailures) {
      console.error('[super-signal] Too many component failures:', failures);
      auditLogger.logFailure(input.symbol, 'fusion', `Too many component failures: ${failures}`, false);
      return null;
    }
    
    return components;
    
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('[super-signal] Component computation error:', error);
    auditLogger.logFailure(input.symbol, 'fusion', String(error), false);
    return null;
  }
}

// ── SUPER_SIGNAL Fusion ───────────────────────────────────────────

/**
 * Compute SUPER_SIGNAL by fusing all component scores.
 * 
 * Main orchestration function that:
 * 1. Computes all 5 components in parallel
 * 2. Applies weighted fusion formula
 * 3. Maps value to category
 * 4. Returns complete SuperSignalResult
 * 
 * @param input - SuperSignalInput containing all required data
 * @returns SuperSignalResult or null if computation fails
 */
export async function computeSuperSignal(input: SuperSignalInput): Promise<SuperSignalResult | null> {
  const startTime = Date.now();
  
  try {
    const config = getConfig();
    
    // Check if SUPER_SIGNAL is enabled
    if (!config.enabled) {
      return null;
    }
    
    // Compute all components
    const components = await computeAllComponents(input);
    
    if (!components) {
      // Too many component failures
      return null;
    }
    
    // Fuse components into final value
    const value = fuseComponents(components, input.assetClass);
    
    // Map to category
    const category = mapValueToCategory(value);
    
    // Compute input hash for deterministic replay
    const inputHash = hashInput(input);
    
    const computeTimeMs = Date.now() - startTime;
    
    const result: SuperSignalResult = {
      value,
      category,
      components,
      algorithmVersion: ALGORITHM_VERSION,
      computeTimeMs,
      timestamp: Date.now(),
      inputHash,
    };
    
    // Log successful computation
    auditLogger.logComputation(input.symbol, result, inputHash, computeTimeMs);
    
    return result;
    
  } catch (error) {
    console.error('[super-signal] Fusion engine error:', error);
    auditLogger.logFailure(input.symbol, 'fusion', String(error), false);
    return null;
  }
}
