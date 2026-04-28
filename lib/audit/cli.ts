#!/usr/bin/env node
/**
 * RSIQ Pro - Audit CLI
 * Copyright © 2024-2026 Mindscape Analytics LLC. All rights reserved.
 *
 * Command-line interface for executing comprehensive signal generation workflow audits.
 *
 * Usage:
 *   npx tsx lib/audit/cli.ts [options]
 *
 * Options:
 *   --modules <list>    Comma-separated list of modules to audit (default: all)
 *   --verbose           Enable verbose logging
 *   --read-only         Run in read-only mode (no fixes applied)
 *   --output <file>     Write report to file (default: console)
 */

import { AuditEngine } from './audit-engine';
import { WorkflowVerifier } from './workflow-verifier';
import { SettingsValidator } from './settings-validator';
import type { AuditModule } from './types';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

interface CLIOptions {
  modules: AuditModule[];
  verbose: boolean;
  readOnly: boolean;
  output?: string;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    modules: [],
    verbose: false,
    readOnly: true,
    output: undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--modules':
        if (i + 1 < args.length) {
          options.modules = args[++i].split(',') as AuditModule[];
        }
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--read-only':
        options.readOnly = true;
        break;
      case '--fix':
        options.readOnly = false;
        break;
      case '--output':
        if (i + 1 < args.length) {
          options.output = args[++i];
        }
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
RSIQ Pro - Signal Generation Workflow Audit

Usage:
  npx tsx lib/audit/cli.ts [options]

Options:
  --modules <list>    Comma-separated list of modules to audit
                      Available: workflow, settings, accuracy, narrator, gaps,
                                performance, realtime, strategy, calibration, sync
                      Default: all modules

  --verbose           Enable verbose logging
  --read-only         Run in read-only mode (no fixes applied) [default]
  --fix               Enable fix mode (applies fixes to detected gaps)
  --output <file>     Write report to file (default: console output)
  --help, -h          Show this help message

Examples:
  # Run full audit with verbose output
  npx tsx lib/audit/cli.ts --verbose

  # Audit specific modules only
  npx tsx lib/audit/cli.ts --modules workflow,settings,accuracy

  # Run audit and save report to file
  npx tsx lib/audit/cli.ts --output audit-report.md

  # Run audit with fix mode enabled
  npx tsx lib/audit/cli.ts --fix --verbose
`);
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   RSIQ Pro - Signal Generation Workflow Audit                 ║');
  console.log('║   Institutional-Grade Validation & Gap Detection              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  try {
    // Initialize audit engine
    const engine = new AuditEngine({
      readOnly: options.readOnly,
      modules: options.modules,
      verbose: options.verbose,
      generateTests: false,
    });

    // Execute audit
    const result = await engine.executeAudit();

    // Generate report
    const report = generateReport(result);

    // Output report
    if (options.output) {
      const outputPath = resolve(process.cwd(), options.output);
      writeFileSync(outputPath, report, 'utf-8');
      console.log(`\n📄 Report saved to: ${outputPath}`);
    } else {
      console.log('\n' + report);
    }

    // Exit with appropriate code
    const exitCode = result.overallStatus === 'fail' ? 1 : 0;
    process.exit(exitCode);
  } catch (error) {
    console.error('\n❌ Audit failed with error:');
    console.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function generateReport(result: any): string {
  const lines: string[] = [];

  lines.push('# Signal Generation Workflow Audit Report');
  lines.push('');
  lines.push(`**Generated**: ${new Date(result.timestamp).toISOString()}`);
  lines.push(`**Duration**: ${(result.duration / 1000).toFixed(2)}s`);
  lines.push(`**Overall Status**: ${result.overallStatus.toUpperCase()}`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push(result.summary);
  lines.push('');

  lines.push('## Module Results');
  lines.push('');

  for (const moduleResult of result.modules) {
    const statusEmoji = moduleResult.status === 'pass' ? '✅' : moduleResult.status === 'warning' ? '⚠️' : '❌';
    lines.push(`### ${statusEmoji} ${moduleResult.module}`);
    lines.push('');
    lines.push(`**Status**: ${moduleResult.status.toUpperCase()}`);
    lines.push(`**Duration**: ${(moduleResult.duration / 1000).toFixed(2)}s`);
    lines.push('');
    lines.push(moduleResult.details);
    lines.push('');

    if (moduleResult.issues.length > 0) {
      lines.push('**Issues**:');
      lines.push('');
      for (const issue of moduleResult.issues) {
        lines.push(`- [${issue.severity.toUpperCase()}] ${issue.message}`);
        if (issue.location) {
          lines.push(`  Location: ${issue.location}`);
        }
        if (issue.suggestion) {
          lines.push(`  Suggestion: ${issue.suggestion}`);
        }
      }
      lines.push('');
    }
  }

  if (result.gaps && result.gaps.length > 0) {
    lines.push('## Detected Gaps');
    lines.push('');
    for (const gap of result.gaps) {
      lines.push(`### ${gap.type} (${gap.severity})`);
      lines.push('');
      lines.push(gap.description);
      lines.push('');
      lines.push(`**Location**: ${gap.location.file}`);
      if (gap.location.line) {
        lines.push(`**Line**: ${gap.location.line}`);
      }
      lines.push('');
      lines.push(`**Suggested Fix**: ${gap.suggestedFix}`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('*Generated by RSIQ Pro Audit System*');
  lines.push('*Copyright © 2024-2026 Mindscape Analytics LLC*');

  return lines.join('\n');
}

// Run CLI
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main, parseArgs, generateReport };
