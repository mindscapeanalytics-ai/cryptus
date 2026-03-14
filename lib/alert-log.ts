import { prisma } from './prisma';

export interface AlertLogEntry {
  symbol: string;
  timeframe: string;
  value: number;
  type: string;
}

export async function createAlertLog(entry: AlertLogEntry) {
  try {
    return await prisma.alertLog.create({
      data: {
        symbol: entry.symbol,
        timeframe: entry.timeframe,
        value: entry.value,
        type: entry.type,
      },
    });
  } catch (err) {
    console.error('[alert-log] Failed to create log:', err);
    throw err;
  }
}

export async function getRecentAlerts(limit = 50) {
  try {
    return await prisma.alertLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  } catch (err) {
    console.error('[alert-log] Failed to fetch alerts:', err);
    return [];
  }
}
