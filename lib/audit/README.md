# RSIQ Pro - Signal Generation Workflow Audit System

**Institutional-Grade Validation & Gap Detection**

## Overview

The Audit System provides comprehensive validation of the signal generation workflow, ensuring institutional-grade accuracy, consistency, and robustness across all components.

## Features

✅ **End-to-End Workflow Verification** - Traces complete data flow from market data fetch through terminal display  
✅ **Settings Validation** - Ensures consistent configuration across all modules  
✅ **Signal Accuracy Verification** - Property-based testing for all indicator calculations  
✅ **Narrator Validation** - Verifies conviction calculation and narrative quality  
✅ **Gap Detection** - Identifies missing implementations and inconsistencies  
✅ **Performance Validation** - Ensures efficient operation under high load  
✅ **Multi-Asset Calibration** - Verifies proper calibration for Crypto, Forex, Metals, Indices, Stocks  

## Quick Start

### Run Full Audit

```bash
npx tsx lib/audit/cli.ts --verbose
```

### Audit Specific Modules

```bash
npx tsx lib/audit/cli.ts --modules workflow,settings,accuracy
```

### Generate Report File

```bash
npx tsx lib/audit/cli.ts --output audit-report.md
```

### Enable Fix Mode (Applies Fixes)

```bash
npx tsx lib/audit/cli.ts --fix --verbose
```

## Available Modules

- **workflow** - End-to-end workflow verification
- **settings** - Configuration validation
- **accuracy** - Signal accuracy verification
- **narrator** - Narrative generation validation
- **gaps** - Implementation gap detection
- **performance** - Performance and scalability validation
- **realtime** - Real-time data flow validation
- **strategy** - Strategy strengthening validation
- **calibration** - Multi-asset class calibration
- **sync** - Signal synchronization validation

## Architecture

```
lib/audit/
├── cli.ts                    # Command-line interface
├── audit-engine.ts           # Core orchestration
├── workflow-verifier.ts      # Workflow verification
├── settings-validator.ts     # Settings validation
├── types.ts                  # Type definitions
├── tests/                    # Property-based tests
├── reports/                  # Generated reports
└── templates/                # Report templates
```

## Property-Based Testing

The audit system uses [fast-check](https://github.com/dubzzz/fast-check) for property-based testing, validating 15 correctness properties:

1. **RSI Range Invariant** - RSI always in [0, 100]
2. **MACD Histogram Normalization** - Finite numeric values
3. **Bollinger Band Position Clamping** - Position in [0, 1]
4. **Strategy Score Clamping** - Score in [-100, 100]
5. **Signal Classification Consistency** - Deterministic classification
6. **Real-Time Approximation Consistency** - Approximation accuracy
7. **Narrator Conviction Calculation** - Conviction formula correctness
8. **Narrator Pillar Confluence Bonus** - Bonus calculation correctness
9. **Asset-Specific RSI Zone Application** - Correct zones per asset
10. **Default Settings Consistency** - Centralized defaults usage
11. **Indicator Edge Case Handling** - Graceful error handling
12. **Strategy Strengthening Rules** - Multiplier application
13. **Signal Sync Increment Atomicity** - Atomic Redis operations
14. **Win Rate Calculation Correctness** - Percentage calculation
15. **Narrator Numeric Formatting** - Precision correctness

## Configuration

The audit system respects the following options:

- `--modules` - Comma-separated list of modules to audit
- `--verbose` - Enable detailed logging
- `--read-only` - Run without applying fixes (default)
- `--fix` - Enable fix mode (applies detected fixes)
- `--output` - Write report to file

## Exit Codes

- `0` - Audit passed (all modules verified)
- `1` - Audit failed (one or more modules failed)

## Integration with CI/CD

Add to your CI pipeline:

```yaml
# .github/workflows/audit.yml
name: Signal Workflow Audit

on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npx tsx lib/audit/cli.ts --output audit-report.md
      - uses: actions/upload-artifact@v3
        with:
          name: audit-report
          path: audit-report.md
```

## Development

### Adding New Validators

1. Create validator class in `lib/audit/`
2. Implement validation logic
3. Add to `AuditEngine.runModule()`
4. Add tests in `lib/audit/tests/`

### Adding Property Tests

1. Create test file in `lib/audit/tests/`
2. Use fast-check generators
3. Define property with 100+ iterations
4. Tag with property number and requirement

## Best Practices

✅ **Run audit before deployment** - Catch issues early  
✅ **Review audit reports** - Understand system health  
✅ **Fix critical gaps immediately** - Maintain institutional standards  
✅ **Monitor performance metrics** - Ensure scalability  
✅ **Validate after changes** - Prevent regressions  

## Support

For issues or questions:
- Review the audit report for detailed diagnostics
- Check property test failures for specific issues
- Consult the design document for architecture details

---

**Copyright © 2024-2026 Mindscape Analytics LLC. All rights reserved.**
