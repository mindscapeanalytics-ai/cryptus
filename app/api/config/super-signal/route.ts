/**
 * SUPER_SIGNAL Configuration API
 * 
 * GET: Read current configuration
 * POST: Update weights and thresholds (admin-only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfig, reloadConfig } from '@/lib/super-signal/config';
import { auditLogger } from '@/lib/super-signal/audit-logger';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// GET: Read Current Configuration
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const config = getConfig();
    const stats = auditLogger.getStats();
    
    return NextResponse.json({
      success: true,
      config,
      stats,
    });
  } catch (error) {
    console.error('[super-signal] Error reading config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read configuration' },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST: Update Configuration (Admin-Only)
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // TODO: Add admin authentication check
    // const session = await getServerSession(authOptions);
    // if (!session?.user?.isAdmin) {
    //   return NextResponse.json(
    //     { success: false, error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }
    
    const body = await req.json();
    const { weights, thresholds, enabled, assetClassWeights } = body;
    
    // Validate weights sum to 1.0
    if (weights) {
      const sum = Object.values(weights as Record<string, number>).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1.0) > 0.01) {
        return NextResponse.json(
          { success: false, error: 'Weights must sum to 1.0' },
          { status: 400 }
        );
      }
    }
    
    // Read current config
    const configPath = join(process.cwd(), 'lib', 'super-signal-config.json');
    const currentConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    
    // Update config
    const updatedConfig = {
      ...currentConfig,
      ...(enabled !== undefined && { enabled }),
      ...(weights && { weights }),
      ...(thresholds && { thresholds }),
      ...(assetClassWeights && { assetClassWeights }),
    };
    
    // Write updated config
    writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8');
    
    // Reload config
    reloadConfig();
    
    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully',
      config: updatedConfig,
    });
    
  } catch (error) {
    console.error('[super-signal] Error updating config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}
