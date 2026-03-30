/**
 * Bulk Configuration Operations — Task 10.4
 * POST /api/config/bulk
 * Requirements: 10.2, 10.3, 10.5, 10.6
 *
 * Body:
 *   action: 'enable' | 'disable' | 'delete' | 'update'
 *   symbols: string[]
 *   updates?: Partial<CoinConfig>  (for 'update' action)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export interface BulkOperationResult {
  success: boolean;
  action: string;
  processed: number;
  failed: number;
  errors: string[];
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action, symbols, updates } = body as {
      action: 'enable' | 'disable' | 'delete' | 'update';
      symbols: string[];
      updates?: Record<string, any>;
    };

    if (!action || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ error: 'action and symbols[] are required' }, { status: 400 });
    }

    const userId = session.user.id;
    const errors: string[] = [];
    let processed = 0;

    // ── Execute in a single transaction for atomicity (Requirement 10.2, 10.6) ──
    try {
      await prisma.$transaction(async (tx) => {
        switch (action) {
          case 'enable': {
            // Enable all timeframe alerts for selected symbols
            const result = await tx.coinConfig.updateMany({
              where: { userId, symbol: { in: symbols } },
              data: {
                alertOn1m: true,
                alertOn5m: true,
                alertOn15m: true,
                alertOn1h: true,
              },
            });
            processed = result.count;
            break;
          }

          case 'disable': {
            // Disable all alerts for selected symbols
            const result = await tx.coinConfig.updateMany({
              where: { userId, symbol: { in: symbols } },
              data: {
                alertOn1m: false,
                alertOn5m: false,
                alertOn15m: false,
                alertOn1h: false,
                alertOnCustom: false,
                alertOnStrategyShift: false,
                alertOnLongCandle: false,
                alertOnVolumeSpike: false,
              },
            });
            processed = result.count;
            break;
          }

          case 'delete': {
            // Delete configs for selected symbols
            const result = await tx.coinConfig.deleteMany({
              where: { userId, symbol: { in: symbols } },
            });
            processed = result.count;
            break;
          }

          case 'update': {
            if (!updates || Object.keys(updates).length === 0) {
              throw new Error('updates object is required for update action');
            }
            // Strip any fields that shouldn't be bulk-updated
            const safeUpdates = { ...updates };
            delete safeUpdates.id;
            delete safeUpdates.userId;
            delete safeUpdates.symbol;
            delete safeUpdates.createdAt;

            const result = await tx.coinConfig.updateMany({
              where: { userId, symbol: { in: symbols } },
              data: safeUpdates,
            });
            processed = result.count;
            break;
          }

          default:
            throw new Error(`Unknown action: ${action}`);
        }
      });
    } catch (txErr: any) {
      // Transaction failed — report as partial failure (Requirement 10.6)
      errors.push(txErr.message ?? 'Transaction failed');
      return NextResponse.json({
        success: false,
        action,
        processed: 0,
        failed: symbols.length,
        errors,
      } satisfies BulkOperationResult, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action,
      processed,
      failed: symbols.length - processed,
      errors,
    } satisfies BulkOperationResult);
  } catch (err) {
    console.error('[bulk-config-api] error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
