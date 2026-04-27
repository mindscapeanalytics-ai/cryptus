/**
 * SUPER_SIGNAL Backtest API
 * 
 * POST: Trigger backtest on historical data
 */

import { NextRequest, NextResponse } from 'next/server';
import { runBacktest, compareSignals } from '@/lib/super-signal/backtester';
import type { ScreenerEntry } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// POST: Run Backtest
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
    const {
      snapshots,
      holdingPeriodBars = 20,
      minTradesPerCategory = 5,
      riskFreeRate = 0.02,
      compareWithStrategy = true,
    } = body;

    if (!snapshots || !Array.isArray(snapshots) || snapshots.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid or empty snapshots array' },
        { status: 400 }
      );
    }

    const options = {
      holdingPeriodBars,
      minTradesPerCategory,
      riskFreeRate,
    };

    if (compareWithStrategy) {
      // Compare SUPER_SIGNAL vs existing strategySignal
      const comparison = await compareSignals(snapshots as ScreenerEntry[], options);
      
      return NextResponse.json({
        success: true,
        comparison,
        message: `Backtest completed: ${comparison.superSignal.overall.totalTrades} trades analyzed`,
      });
    } else {
      // Run SUPER_SIGNAL backtest only
      const result = await runBacktest(snapshots as ScreenerEntry[], options);
      
      return NextResponse.json({
        success: true,
        result,
        message: `Backtest completed: ${result.overall.totalTrades} trades analyzed`,
      });
    }
    
  } catch (error) {
    console.error('[super-signal] Backtest error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Backtest failed',
      },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET: Get Sample Backtest Data (for testing)
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    // TODO: Add admin authentication check
    
    // Return sample data structure for documentation
    return NextResponse.json({
      success: true,
      sampleRequest: {
        snapshots: [
          {
            symbol: 'BTCUSDT',
            price: 45000,
            rsi1m: 55,
            rsi5m: 58,
            rsi15m: 60,
            rsi1h: 62,
            rsi4h: 65,
            rsi1d: 68,
            atr: 500,
            adx: 25,
            vwap: 44900,
            vwapDiff: 0.22,
            volume24h: 1000000000,
            avgVolume1m: 50000000,
            curCandleVol: 55000000,
            change24h: 2.5,
            strategySignal: 'buy',
            strategyScore: 75,
            market: 'Crypto',
            updatedAt: Date.now(),
          },
          // ... more snapshots
        ],
        holdingPeriodBars: 20,
        minTradesPerCategory: 5,
        riskFreeRate: 0.02,
        compareWithStrategy: true,
      },
      instructions: 'POST historical ScreenerEntry snapshots to run backtest',
    });
  } catch (error) {
    console.error('[super-signal] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get sample data' },
      { status: 500 }
    );
  }
}
