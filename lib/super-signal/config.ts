/**
 * RSIQ Pro - SUPER_SIGNAL Configuration Loader
 * Copyright © 2024-2026 Mindscape Analytics LLC. All rights reserved.
 *
 * Loads and validates SUPER_SIGNAL configuration with hot-reload support.
 * Provides per-asset-class weight overrides and fail-safe defaults.
 */

import type { SuperSignalConfig, ComponentWeights, AssetClass } from './types';
import { readFileSync } from 'fs';
import { join } from 'path';

// ── Default Configuration ─────────────────────────────────────────

const DEFAULT_CONFIG: SuperSignalConfig = {
  version: '1.0.0',
  enabled: true,
  defaultWeights: {
    regime: 0.25,
    liquidity: 0.25,
    entropy: 0.20,
    crossAsset: 0.20,
    risk: 0.10,
  },
  assetClassWeights: {
    Crypto: {
      regime: 0.25,
      liquidity: 0.25,
      entropy: 0.20,
      crossAsset: 0.20,
      risk: 0.10,
    },
    Metal: {
      regime: 0.20,
      liquidity: 0.30,
      entropy: 0.15,
      crossAsset: 0.25,
      risk: 0.10,
    },
    Forex: {
      regime: 0.30,
      liquidity: 0.25,
      entropy: 0.15,
      crossAsset: 0.20,
      risk: 0.10,
    },
    Stocks: {
      regime: 0.25,
      liquidity: 0.25,
      entropy: 0.20,
      crossAsset: 0.20,
      risk: 0.10,
    },
    Index: {
      regime: 0.30,
      liquidity: 0.20,
      entropy: 0.20,
      crossAsset: 0.20,
      risk: 0.10,
    },
  },
  thresholds: {
    strongBuy: 75,
    buy: 60,
    neutral: 40,
    sell: 25,
  },
  regime: {
    algorithm: 'volatility-clustering',
    hmmMinBars: 200,
    hmmSeed: 42,
  },
  cache: {
    componentTtlMs: 15000,
    crossAssetTtlMs: 60000,
    entropyTtlMs: 10000,
  },
  entropy: {
    windowSize: 20,
    minWindowSize: 5,
    maxWindowSize: 50,
    numBuckets: 10,
  },
  liquidity: {
    vwapDeviationThreshold: 2.0,
    volumeImbalanceThreshold: 0.6,
  },
  crossAsset: {
    agreementThreshold: 0.7,
    disagreementThreshold: 0.4,
  },
  risk: {
    atrMultipliers: {
      Crypto: 1.5,
      Forex: 1.0,
      Metal: 1.2,
      Stocks: 1.3,
      Index: 1.1,
    },
    maxPositionPct: 0.10,
    defaultRiskPct: 0.01,
  },
  performance: {
    timeoutMs: 60000,
    maxComponentFailures: 2,
  },
  audit: {
    enabled: true,
    retentionDays: 90,
    failureAlertThreshold: 0.05,
  },
};

// ── Configuration State ───────────────────────────────────────────

let cachedConfig: SuperSignalConfig = DEFAULT_CONFIG;
let lastLoadTime = 0;
const CONFIG_RELOAD_INTERVAL_MS = 60000; // 1 minute

// ── Validation ────────────────────────────────────────────────────

function validateWeights(weights: ComponentWeights, label: string): boolean {
  const sum = weights.regime + weights.liquidity + weights.entropy + weights.crossAsset + weights.risk;
  const tolerance = 0.01;
  
  if (Math.abs(sum - 1.0) > tolerance) {
    console.warn(`[super-signal] Invalid weights for ${label}: sum=${sum.toFixed(3)} (expected 1.0 ±${tolerance})`);
    return false;
  }
  
  // Check all weights are non-negative
  if (Object.values(weights).some(w => w < 0 || w > 1)) {
    console.warn(`[super-signal] Invalid weight values for ${label}: weights must be in [0, 1]`);
    return false;
  }
  
  return true;
}

function validateConfig(config: SuperSignalConfig): boolean {
  // Validate default weights
  if (!validateWeights(config.defaultWeights, 'defaultWeights')) {
    return false;
  }
  
  // Validate asset-class weight overrides
  if (config.assetClassWeights) {
    for (const [assetClass, weights] of Object.entries(config.assetClassWeights)) {
      if (weights) {
        const fullWeights = { ...config.defaultWeights, ...weights };
        if (!validateWeights(fullWeights, `assetClassWeights.${assetClass}`)) {
          return false;
        }
      }
    }
  }
  
  // Validate thresholds are in ascending order
  const { strongBuy, buy, neutral, sell } = config.thresholds;
  if (!(sell < neutral && neutral < buy && buy < strongBuy)) {
    console.warn(`[super-signal] Invalid thresholds: must be in ascending order (sell < neutral < buy < strongBuy)`);
    return false;
  }
  
  return true;
}

// ── Configuration Loading ─────────────────────────────────────────

function loadConfigFromFile(): SuperSignalConfig | null {
  try {
    const configPath = join(process.cwd(), 'lib', 'super-signal-config.json');
    const raw = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as SuperSignalConfig;
    
    if (!validateConfig(config)) {
      console.warn('[super-signal] Config validation failed, using defaults');
      return null;
    }
    
    console.log('[super-signal] Configuration loaded successfully');
    return config;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('[super-signal] Config file not found, using defaults');
    } else {
      console.error('[super-signal] Error loading config:', err);
    }
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Get the current SUPER_SIGNAL configuration.
 * Automatically reloads from file if cache is stale (hot-reload).
 */
export function getConfig(): SuperSignalConfig {
  const now = Date.now();
  
  // Hot-reload: check if config file has been updated
  if (now - lastLoadTime > CONFIG_RELOAD_INTERVAL_MS) {
    const loaded = loadConfigFromFile();
    if (loaded) {
      cachedConfig = loaded;
    }
    lastLoadTime = now;
  }
  
  return cachedConfig;
}

/**
 * Get component weights for a specific asset class.
 * Merges default weights with asset-class overrides.
 */
export function getWeightsForAsset(assetClass: AssetClass): ComponentWeights {
  const config = getConfig();
  const defaults = config.defaultWeights;
  const overrides = config.assetClassWeights?.[assetClass];
  
  if (!overrides) {
    return defaults;
  }
  
  return {
    regime: overrides.regime ?? defaults.regime,
    liquidity: overrides.liquidity ?? defaults.liquidity,
    entropy: overrides.entropy ?? defaults.entropy,
    crossAsset: overrides.crossAsset ?? defaults.crossAsset,
    risk: overrides.risk ?? defaults.risk,
  };
}

/**
 * Force reload configuration from file (for testing or manual refresh).
 */
export function reloadConfig(): void {
  const loaded = loadConfigFromFile();
  if (loaded) {
    cachedConfig = loaded;
  }
  lastLoadTime = Date.now();
}

/**
 * Reset configuration to defaults (for testing).
 */
export function resetToDefaults(): void {
  cachedConfig = DEFAULT_CONFIG;
  lastLoadTime = Date.now();
}
