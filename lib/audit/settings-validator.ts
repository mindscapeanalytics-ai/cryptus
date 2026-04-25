/**
 * RSIQ Pro - Settings Validator
 * Copyright © 2024-2026 Mindscape Analytics LLC. All rights reserved.
 *
 * Validates default settings and global options across all modules.
 * Ensures consistent configuration and detects hardcoded values.
 */

import type { SettingsValidationReport } from './types';
import { RSI_DEFAULTS, RSI_ZONES, INDICATOR_DEFAULTS, STRATEGY_DEFAULTS, VOLATILITY_DEFAULTS } from '../defaults';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export class SettingsValidator {
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  /**
   * Validate all settings and configuration
   */
  async validate(): Promise<SettingsValidationReport> {
    this.log('🔍 Validating settings and configuration...');

    const report: SettingsValidationReport = {
      rsiDefaults: await this.validateRsiDefaults(),
      indicatorDefaults: await this.validateIndicatorDefaults(),
      assetSpecificZones: await this.validateAssetSpecificZones(),
      inconsistencies: [],
    };

    // Check for inconsistencies
    report.inconsistencies = this.detectInconsistencies(report);

    return report;
  }

  /**
   * Validate RSI_DEFAULTS usage across all modules
   */
  private async validateRsiDefaults(): Promise<SettingsValidationReport['rsiDefaults']> {
    this.log('  Validating RSI_DEFAULTS...');

    const configured = {
      period: RSI_DEFAULTS.period,
      overbought: RSI_DEFAULTS.overbought,
      oversold: RSI_DEFAULTS.oversold,
    };

    const usage: SettingsValidationReport['rsiDefaults']['usage'] = [];

    // Check indicators.ts for RSI_DEFAULTS usage
    const indicatorsFile = this.readFile('lib/indicators.ts');
    if (indicatorsFile) {
      // Check for deriveSignal function using RSI_DEFAULTS
      if (indicatorsFile.includes('RSI_DEFAULTS.overbought') && indicatorsFile.includes('RSI_DEFAULTS.oversold')) {
        usage.push({
          location: 'lib/indicators.ts:deriveSignal',
          value: { overbought: 80, oversold: 20 },
          matches: true,
        });
        this.log('    ✓ RSI_DEFAULTS correctly used in deriveSignal');
      }

      // Check for hardcoded RSI thresholds (70/30 or other values)
      const hardcodedPattern = /rsi\s*[<>]=?\s*(\d+)/gi;
      const matches = indicatorsFile.matchAll(hardcodedPattern);
      for (const match of matches) {
        const value = parseInt(match[1]);
        if (value !== 80 && value !== 20 && value !== 45 && value !== 55) {
          usage.push({
            location: `lib/indicators.ts:line_unknown`,
            value: { threshold: value },
            matches: false,
          });
          this.log(`    ⚠️  Potential hardcoded RSI threshold: ${value}`);
        }
      }
    }

    return {
      configured,
      usage,
    };
  }

  /**
   * Validate INDICATOR_DEFAULTS usage
   */
  private async validateIndicatorDefaults(): Promise<SettingsValidationReport['indicatorDefaults']> {
    this.log('  Validating INDICATOR_DEFAULTS...');

    const configured = { ...INDICATOR_DEFAULTS };
    const usage: SettingsValidationReport['indicatorDefaults']['usage'] = [];

    // Check indicators.ts for INDICATOR_DEFAULTS usage
    const indicatorsFile = this.readFile('lib/indicators.ts');
    if (indicatorsFile) {
      if (indicatorsFile.includes('INDICATOR_DEFAULTS')) {
        usage.push({
          location: 'lib/indicators.ts:computeStrategyScore',
          value: configured,
          matches: true,
        });
        this.log('    ✓ INDICATOR_DEFAULTS correctly imported and used');
      }
    }

    return {
      configured,
      usage,
    };
  }

  /**
   * Validate asset-specific RSI zones
   */
  private async validateAssetSpecificZones(): Promise<SettingsValidationReport['assetSpecificZones']> {
    this.log('  Validating asset-specific RSI zones...');

    const zones: SettingsValidationReport['assetSpecificZones'] = [];

    for (const [market, config] of Object.entries(RSI_ZONES)) {
      const locations: string[] = [];

      // Check indicators.ts for RSI_ZONES usage
      const indicatorsFile = this.readFile('lib/indicators.ts');
      if (indicatorsFile && indicatorsFile.includes('RSI_ZONES')) {
        locations.push('lib/indicators.ts:computeStrategyScore');
      }

      // Check signal-narration.ts for RSI_ZONES usage
      const narrationFile = this.readFile('lib/signal-narration.ts');
      if (narrationFile && narrationFile.includes('RSI_ZONES')) {
        locations.push('lib/signal-narration.ts:rsiZone');
      }

      zones.push({
        market,
        configured: config,
        applied: locations.length > 0,
        locations,
      });

      if (locations.length > 0) {
        this.log(`    ✓ ${market} zones applied in ${locations.length} location(s)`);
      } else {
        this.log(`    ⚠️  ${market} zones configured but not applied`);
      }
    }

    return zones;
  }

  /**
   * Detect inconsistencies in configuration
   */
  private detectInconsistencies(report: SettingsValidationReport): SettingsValidationReport['inconsistencies'] {
    const inconsistencies: SettingsValidationReport['inconsistencies'] = [];

    // Check for RSI defaults mismatches
    for (const usage of report.rsiDefaults.usage) {
      if (!usage.matches) {
        inconsistencies.push({
          setting: 'RSI_DEFAULTS',
          expected: report.rsiDefaults.configured,
          actual: usage.value,
          location: usage.location,
        });
      }
    }

    // Check for unapplied asset zones
    for (const zone of report.assetSpecificZones) {
      if (!zone.applied) {
        inconsistencies.push({
          setting: `RSI_ZONES.${zone.market}`,
          expected: zone.configured,
          actual: null,
          location: 'Not applied in any module',
        });
      }
    }

    if (inconsistencies.length === 0) {
      this.log('  ✓ No configuration inconsistencies detected');
    } else {
      this.log(`  ⚠️  Found ${inconsistencies.length} configuration inconsistencies`);
    }

    return inconsistencies;
  }

  /**
   * Read file content safely
   */
  private readFile(relativePath: string): string | null {
    try {
      const filePath = resolve(process.cwd(), relativePath);
      return readFileSync(filePath, 'utf-8');
    } catch (error) {
      this.log(`    ⚠️  Could not read ${relativePath}`);
      return null;
    }
  }

  /**
   * Log message (respects verbose flag)
   */
  private log(message: string): void {
    if (this.verbose) {
      console.log(message);
    }
  }
}
