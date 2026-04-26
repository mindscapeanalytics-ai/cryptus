/**
 * Default Settings Validation Script
 * Copyright © 2024-2026 Mindscape Analytics LLC. All rights reserved.
 *
 * Validates that default settings are consistent across:
 * - Database schema (Prisma)
 * - Code defaults (lib/defaults.ts)
 * - Feature flags (lib/feature-flags.ts)
 * - User preferences interface (lib/user-preferences.ts)
 */

import { prisma } from '@/lib/prisma';
import { DASHBOARD_DEFAULTS, INDICATOR_DEFAULTS, RSI_DEFAULTS } from '@/lib/defaults';
import { getFeatureFlags } from '@/lib/feature-flags';

interface ValidationResult {
  passed: boolean;
  category: string;
  check: string;
  expected: any;
  actual: any;
  message: string;
}

export class DefaultsValidator {
  private results: ValidationResult[] = [];

  /**
   * Run all validation checks
   */
  async validate(): Promise<{
    passed: boolean;
    results: ValidationResult[];
    summary: {
      total: number;
      passed: number;
      failed: number;
    };
  }> {
    console.log('🔍 Starting default settings validation...\n');

    await this.validateDatabaseSchema();
    await this.validateFeatureFlags();
    await this.validateCodeDefaults();
    await this.validateUserPreferences();

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    console.log('\n📊 Validation Summary:');
    console.log(`   Total Checks: ${this.results.length}`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);

    return {
      passed: failed === 0,
      results: this.results,
      summary: {
        total: this.results.length,
        passed,
        failed,
      },
    };
  }

  /**
   * Validate database schema has all required fields
   */
  private async validateDatabaseSchema(): Promise<void> {
    console.log('📋 Validating database schema...');

    try {
      // Check if user_preference table has all required indicator fields
      const requiredFields = [
        'globalUseRsi',
        'globalUseMacd',
        'globalUseBb',
        'globalUseStoch',
        'globalUseEma',
        'globalUseVwap',
        'globalUseConfluence',
        'globalUseDivergence',
        'globalUseMomentum',
        'globalUseObv',
        'globalUseWilliamsR',
        'globalUseCci',
        'globalShowSignalTags',
        'tradingStyle',
      ];

      const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'user_preference'
          AND column_name = ANY(${requiredFields})
      `;

      const foundColumns = columns.map(c => c.column_name);
      const missingColumns = requiredFields.filter(f => !foundColumns.includes(f));

      this.addResult({
        passed: missingColumns.length === 0,
        category: 'Database Schema',
        check: 'All indicator fields exist',
        expected: requiredFields,
        actual: foundColumns,
        message: missingColumns.length === 0
          ? 'All required fields present'
          : `Missing fields: ${missingColumns.join(', ')}`,
      });

      // Check default values
      const defaultCheck = await prisma.$queryRaw<Array<{
        column_name: string;
        column_default: string;
      }>>`
        SELECT column_name, column_default
        FROM information_schema.columns
        WHERE table_name = 'user_preference'
          AND column_name IN ('globalUseObv', 'globalUseWilliamsR', 'globalUseCci')
      `;

      const allDefaultTrue = defaultCheck.every(c => c.column_default === 'true');

      this.addResult({
        passed: allDefaultTrue,
        category: 'Database Schema',
        check: 'New indicator fields default to true',
        expected: 'true',
        actual: defaultCheck.map(c => `${c.column_name}: ${c.column_default}`),
        message: allDefaultTrue
          ? 'All new indicators default to enabled'
          : 'Some indicators have incorrect defaults',
      });

    } catch (error) {
      this.addResult({
        passed: false,
        category: 'Database Schema',
        check: 'Schema validation',
        expected: 'Success',
        actual: error,
        message: `Error validating schema: ${error}`,
      });
    }
  }

  /**
   * Validate feature flags
   */
  private async validateFeatureFlags(): Promise<void> {
    console.log('🚩 Validating feature flags...');

    try {
      const flags = await getFeatureFlags();

      // Check trial alerts enabled
      this.addResult({
        passed: flags.allowTrialAlerts === true,
        category: 'Feature Flags',
        check: 'Trial users can access alerts',
        expected: true,
        actual: flags.allowTrialAlerts,
        message: flags.allowTrialAlerts
          ? 'Trial alerts enabled'
          : 'Trial alerts disabled (should be enabled)',
      });

      // Check trial advanced indicators enabled
      this.addResult({
        passed: flags.allowTrialAdvancedIndicators === true,
        category: 'Feature Flags',
        check: 'Trial users can access advanced indicators',
        expected: true,
        actual: flags.allowTrialAdvancedIndicators,
        message: flags.allowTrialAdvancedIndicators
          ? 'Trial advanced indicators enabled'
          : 'Trial advanced indicators disabled (should be enabled)',
      });

      // Check record limits are reasonable
      this.addResult({
        passed: flags.maxTrialRecords === 100 && flags.maxSubscribedRecords === 500,
        category: 'Feature Flags',
        check: 'Record limits are optimal',
        expected: { trial: 100, subscribed: 500 },
        actual: { trial: flags.maxTrialRecords, subscribed: flags.maxSubscribedRecords },
        message: 'Record limits configured correctly',
      });

    } catch (error) {
      this.addResult({
        passed: false,
        category: 'Feature Flags',
        check: 'Feature flags validation',
        expected: 'Success',
        actual: error,
        message: `Error validating feature flags: ${error}`,
      });
    }
  }

  /**
   * Validate code defaults
   */
  private async validateCodeDefaults(): Promise<void> {
    console.log('💻 Validating code defaults...');

    // Check RSI defaults
    this.addResult({
      passed: RSI_DEFAULTS.overbought === 80 && RSI_DEFAULTS.oversold === 20,
      category: 'Code Defaults',
      check: 'RSI thresholds are institutional standard (80/20)',
      expected: { overbought: 80, oversold: 20 },
      actual: { overbought: RSI_DEFAULTS.overbought, oversold: RSI_DEFAULTS.oversold },
      message: 'RSI thresholds configured correctly',
    });

    // Check all indicators enabled
    const allIndicatorsEnabled = Object.values(INDICATOR_DEFAULTS).every(v => v === true);
    this.addResult({
      passed: allIndicatorsEnabled,
      category: 'Code Defaults',
      check: 'All 12 indicators enabled by default',
      expected: 'All true',
      actual: INDICATOR_DEFAULTS,
      message: allIndicatorsEnabled
        ? 'All indicators enabled'
        : 'Some indicators disabled (should all be enabled)',
    });

    // Check visible columns count
    const columnCount = DASHBOARD_DEFAULTS.visibleColumns.length;
    this.addResult({
      passed: columnCount >= 15,
      category: 'Code Defaults',
      check: 'Default visible columns (institutional set)',
      expected: '15+ columns',
      actual: `${columnCount} columns`,
      message: columnCount >= 15
        ? `Optimal column count: ${columnCount}`
        : `Too few columns: ${columnCount} (should be 15+)`,
    });

    // Check refresh interval
    this.addResult({
      passed: DASHBOARD_DEFAULTS.refreshInterval === 30,
      category: 'Code Defaults',
      check: 'Refresh interval is 30 seconds',
      expected: 30,
      actual: DASHBOARD_DEFAULTS.refreshInterval,
      message: 'Refresh interval configured correctly',
    });

    // Check trading style default
    this.addResult({
      passed: DASHBOARD_DEFAULTS.tradingStyle === 'intraday',
      category: 'Code Defaults',
      check: 'Default trading style is intraday',
      expected: 'intraday',
      actual: DASHBOARD_DEFAULTS.tradingStyle,
      message: 'Trading style default configured correctly',
    });
  }

  /**
   * Validate user preferences consistency
   */
  private async validateUserPreferences(): Promise<void> {
    console.log('👤 Validating user preferences...');

    try {
      // Check if any users exist
      const userCount = await prisma.user.count();

      if (userCount === 0) {
        this.addResult({
          passed: true,
          category: 'User Preferences',
          check: 'User preferences validation',
          expected: 'No users to validate',
          actual: 'No users',
          message: 'No users in database (skipping user preference checks)',
        });
        return;
      }

      // Check a sample user's preferences
      const sampleUser = await prisma.user.findFirst({
        include: {
          preferences: true,
        },
      });

      if (!sampleUser?.preferences) {
        this.addResult({
          passed: true,
          category: 'User Preferences',
          check: 'Sample user preferences',
          expected: 'User has no preferences yet',
          actual: 'No preferences',
          message: 'Sample user has no preferences (will use defaults)',
        });
        return;
      }

      const prefs = sampleUser.preferences as any;

      // Check if new fields exist
      const hasNewFields = 
        'globalUseObv' in prefs &&
        'globalUseWilliamsR' in prefs &&
        'globalUseCci' in prefs &&
        'tradingStyle' in prefs;

      this.addResult({
        passed: hasNewFields,
        category: 'User Preferences',
        check: 'New fields present in user preferences',
        expected: 'All new fields present',
        actual: {
          globalUseObv: 'globalUseObv' in prefs,
          globalUseWilliamsR: 'globalUseWilliamsR' in prefs,
          globalUseCci: 'globalUseCci' in prefs,
          tradingStyle: 'tradingStyle' in prefs,
        },
        message: hasNewFields
          ? 'All new fields present'
          : 'Some new fields missing',
      });

    } catch (error) {
      this.addResult({
        passed: false,
        category: 'User Preferences',
        check: 'User preferences validation',
        expected: 'Success',
        actual: error,
        message: `Error validating user preferences: ${error}`,
      });
    }
  }

  /**
   * Add validation result
   */
  private addResult(result: ValidationResult): void {
    this.results.push(result);
    const icon = result.passed ? '✅' : '❌';
    console.log(`   ${icon} ${result.check}: ${result.message}`);
  }

  /**
   * Generate detailed report
   */
  generateReport(): string {
    let report = '# Default Settings Validation Report\n\n';
    report += `**Date**: ${new Date().toISOString()}\n`;
    report += `**Status**: ${this.results.every(r => r.passed) ? '✅ PASSED' : '❌ FAILED'}\n\n`;

    const categories = [...new Set(this.results.map(r => r.category))];

    for (const category of categories) {
      report += `## ${category}\n\n`;
      const categoryResults = this.results.filter(r => r.category === category);

      for (const result of categoryResults) {
        const icon = result.passed ? '✅' : '❌';
        report += `### ${icon} ${result.check}\n`;
        report += `- **Expected**: ${JSON.stringify(result.expected)}\n`;
        report += `- **Actual**: ${JSON.stringify(result.actual)}\n`;
        report += `- **Message**: ${result.message}\n\n`;
      }
    }

    return report;
  }
}

/**
 * Run validation from command line
 */
export async function runValidation(): Promise<void> {
  const validator = new DefaultsValidator();
  const result = await validator.validate();

  if (!result.passed) {
    console.error('\n❌ Validation failed!');
    console.error('See details above for specific failures.');
    process.exit(1);
  }

  console.log('\n✅ All validation checks passed!');
  console.log('\n📄 Generating detailed report...');
  
  const report = validator.generateReport();
  console.log(report);
}

// Run if executed directly
if (require.main === module) {
  runValidation().catch(error => {
    console.error('Fatal error during validation:', error);
    process.exit(1);
  });
}
