/**
 * RSIQ Pro - Audit System Types
 * Copyright © 2024-2026 Mindscape Analytics LLC. All rights reserved.
 *
 * Type definitions for the comprehensive audit and validation system.
 */

// ── Audit Configuration ──────────────────────────────────────────

export interface AuditOptions {
  /** Run in read-only mode (no fixes applied) */
  readOnly: boolean;
  /** Specific modules to audit (empty = all) */
  modules: AuditModule[];
  /** Enable verbose logging */
  verbose: boolean;
  /** Generate property-based tests */
  generateTests: boolean;
}

export type AuditModule = 
  | 'workflow'
  | 'settings'
  | 'accuracy'
  | 'narrator'
  | 'gaps'
  | 'performance'
  | 'realtime'
  | 'strategy'
  | 'calibration'
  | 'sync';

// ── Audit Results ────────────────────────────────────────────────

export interface AuditResult {
  timestamp: number;
  duration: number;
  modules: ModuleResult[];
  gaps: Gap[];
  fixes: Fix[];
  overallStatus: 'pass' | 'warning' | 'fail';
  summary: string;
}

export interface ModuleResult {
  module: AuditModule;
  status: 'pass' | 'warning' | 'fail';
  duration: number;
  details: string;
  issues: Issue[];
}

export interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  location?: string;
  suggestion?: string;
}

// ── Gap Detection ────────────────────────────────────────────────

export interface Gap {
  id: string;
  module: string;
  type: GapType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location: CodeLocation;
  suggestedFix: string;
}

export type GapType =
  | 'missing_calculation'
  | 'inconsistent_weighting'
  | 'missing_error_handling'
  | 'incomplete_realtime_logic'
  | 'missing_test_coverage'
  | 'configuration_mismatch';

export interface CodeLocation {
  file: string;
  line?: number;
  column?: number;
  function?: string;
}

// ── Fix Management ───────────────────────────────────────────────

export interface Fix {
  id: string;
  gapId: string;
  type: 'code' | 'config' | 'test';
  changes: FileChange[];
  rationale: string;
  impactAnalysis: string;
  reversible: boolean;
}

export interface FileChange {
  file: string;
  type: 'create' | 'modify' | 'delete';
  before?: string;
  after?: string;
}

export interface FixResult {
  success: boolean;
  fixId: string;
  message: string;
  appliedChanges: FileChange[];
}

export interface VerificationResult {
  verified: boolean;
  fixId: string;
  message: string;
  testResults?: PropertyTestResult[];
}

export interface RollbackResult {
  success: boolean;
  fixId: string;
  message: string;
}

// ── Property-Based Testing ───────────────────────────────────────

export interface PropertyTestResult {
  propertyName: string;
  passed: boolean;
  iterations: number;
  counterexample?: unknown;
  shrunkExample?: unknown;
  error?: string;
}

// ── Workflow Verification ────────────────────────────────────────

export interface WorkflowVerificationReport {
  dataFlow: {
    stage: string;
    verified: boolean;
    issues: string[];
  }[];
  components: {
    name: string;
    status: 'verified' | 'warning' | 'failed';
    details: string;
  }[];
  integrationPoints: {
    from: string;
    to: string;
    verified: boolean;
    dataIntegrity: boolean;
  }[];
}

// ── Settings Validation ──────────────────────────────────────────

export interface SettingsValidationReport {
  rsiDefaults: {
    configured: {
      period: number;
      overbought: number;
      oversold: number;
    };
    usage: {
      location: string;
      value: unknown;
      matches: boolean;
    }[];
  };
  indicatorDefaults: {
    configured: Record<string, boolean>;
    usage: {
      location: string;
      value: unknown;
      matches: boolean;
    }[];
  };
  assetSpecificZones: {
    market: string;
    configured: {
      deepOS: number;
      os: number;
      ob: number;
      deepOB: number;
    };
    applied: boolean;
    locations: string[];
  }[];
  inconsistencies: {
    setting: string;
    expected: unknown;
    actual: unknown;
    location: string;
  }[];
}

// ── Signal Accuracy ──────────────────────────────────────────────

export interface SignalAccuracyReport {
  indicatorTests: {
    indicator: string;
    rangeTests: {
      name: string;
      passed: boolean;
      details: string;
    }[];
    edgeCaseTests: {
      case: string;
      passed: boolean;
      details: string;
    }[];
  }[];
  strategyScoreTests: {
    clampingVerified: boolean;
    consistencyVerified: boolean;
    examples: {
      input: unknown;
      output: number;
      signal: string;
      valid: boolean;
    }[];
  };
  realtimeConsistency: {
    approximationAccuracy: number;
    maxDeviation: number;
    verified: boolean;
  };
}

// ── Narrator Validation ──────────────────────────────────────────

export interface NarratorValidationReport {
  convictionAlgorithm: {
    verified: boolean;
    formula: string;
    testCases: {
      input: unknown;
      expectedConviction: number;
      actualConviction: number;
      passed: boolean;
    }[];
  };
  pillarConfluence: {
    verified: boolean;
    bonusCalculation: string;
    examples: {
      pillars: string[];
      bonus: number;
      correct: boolean;
    }[];
  };
  assetSpecificContext: {
    market: string;
    contextGenerated: boolean;
    appropriate: boolean;
    examples: string[];
  }[];
  formattingValidation: {
    numericPrecision: boolean;
    emojiPresence: boolean;
    shareLineFormat: boolean;
  };
}

// ── Error Handling ───────────────────────────────────────────────

export enum AuditErrorType {
  VALIDATION_ERROR = 'validation_error',
  EXECUTION_ERROR = 'execution_error',
  CONFIGURATION_ERROR = 'configuration_error',
  TEST_FAILURE = 'test_failure',
  GAP_DETECTION_ERROR = 'gap_detection_error',
  FIX_APPLICATION_ERROR = 'fix_application_error',
}

export interface AuditError {
  type: AuditErrorType;
  module: string;
  message: string;
  stack?: string;
  recoverable: boolean;
  context: Record<string, unknown>;
}
