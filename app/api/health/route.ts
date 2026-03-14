import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Check DB connectivity with manual timeout
    const dbCheck = await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), 2000))
    ]);
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  } catch (err) {
    console.error('[health-check] Failed:', err);
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        error: err instanceof Error ? err.message : 'Database connection failed' 
      },
      { status: 503 }
    );
  }
}
