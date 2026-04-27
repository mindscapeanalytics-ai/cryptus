/**
 * SUPER_SIGNAL Audit Logs API
 * 
 * GET: Query audit logs with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { auditLogger } from '@/lib/super-signal/audit-logger';

// ─────────────────────────────────────────────────────────────────────────────
// GET: Query Audit Logs
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    // TODO: Add admin authentication check
    // const session = await getServerSession(authOptions);
    // if (!session?.user?.isAdmin) {
    //   return NextResponse.json(
    //     { success: false, error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }
    
    const { searchParams } = new URL(req.url);
    
    const symbol = searchParams.get('symbol') || undefined;
    const fromTs = searchParams.get('fromTs') ? parseInt(searchParams.get('fromTs')!) : undefined;
    const toTs = searchParams.get('toTs') ? parseInt(searchParams.get('toTs')!) : undefined;
    const minScore = searchParams.get('minScore') ? parseFloat(searchParams.get('minScore')!) : undefined;
    const maxScore = searchParams.get('maxScore') ? parseFloat(searchParams.get('maxScore')!) : undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    
    const logs = auditLogger.getAuditLogs({
      symbol,
      fromTs,
      toTs,
      minScore,
      maxScore,
      limit,
    });
    
    const failures = auditLogger.getFailureEvents(fromTs, toTs);
    const metrics = auditLogger.getPerformanceMetrics(fromTs, toTs);
    const stats = auditLogger.getStats();
    
    return NextResponse.json({
      success: true,
      logs,
      failures,
      metrics,
      stats,
    });
  } catch (error) {
    console.error('[super-signal] Error querying audit logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to query audit logs' },
      { status: 500 }
    );
  }
}
