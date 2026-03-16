import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScreenerData } from '@/lib/screener-service';
import { sendPushNotification } from '@/lib/push-service';
import { getSymbolAlias } from '@/lib/symbol-utils';
import type { ScreenerEntry } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minute max for deeper scans

export async function POST(request: Request) {
  try {
    // 1. Authenticate the Cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch all alert-enabled coin configurations
    const configs = await prisma.coinConfig.findMany({
      where: {
        OR: [
          { alertOn1m: true },
          { alertOn5m: true },
          { alertOn15m: true },
          { alertOn1h: true },
          { alertConfluence: true },
        ],
      },
    });

    if (configs.length === 0) {
      return NextResponse.json({ success: true, message: 'No active alerts to monitor.' });
    }

    const alertSymbols = configs.map(c => c.symbol);
    
    // 3. Fetch current market data for these symbols
    // Using prioritySymbols to ensure full indicator calculation for these alert symbols
    const screenerResponse = await getScreenerData(alertSymbols.length, { 
      smartMode: false, 
      prioritySymbols: alertSymbols 
    });
    const dataMap = new Map<string, ScreenerEntry>(
      screenerResponse.data.map((d: ScreenerEntry) => [d.symbol, d])
    );

    const triggeredAlerts: any[] = [];

    // 4. Evaluate Alert Logic (Matches logic in use-alert-engine.ts)
    for (const config of configs) {
      const entry = dataMap.get(config.symbol);
      if (!entry) continue;

      const alias = getSymbolAlias(config.symbol);
      const ob = config.overboughtThreshold;
      const os = config.oversoldThreshold;

      const checkTrigger = (val: number | null, tf: string) => {
        if (val === null) return null;
        if (val >= ob) return { type: 'Overbought', timeframe: tf, value: val };
        if (val <= os) return { type: 'Oversold', timeframe: tf, value: val };
        return null;
      };

      const alerts: any[] = [];
      if (config.alertOn1m) {
        const t = checkTrigger(entry.rsi1m, '1M');
        if (t) alerts.push(t);
      }
      if (config.alertOn5m) {
        const t = checkTrigger(entry.rsi5m, '5M');
        if (t) alerts.push(t);
      }
      if (config.alertOn15m) {
        const t = checkTrigger(entry.rsi15m, '15M');
        if (t) alerts.push(t);
      }
      if (config.alertOn1h) {
        const t = checkTrigger(entry.rsi1h, '1H');
        if (t) alerts.push(t);
      }

      if (alerts.length > 0) {
        triggeredAlerts.push({
          symbol: config.symbol,
          alias,
          alerts,
        });
      }
    }

    if (triggeredAlerts.length === 0) {
      return NextResponse.json({ success: true, message: 'No alerts triggered.' });
    }

    // 5. Fetch Subscriptions and Send Pushes
    const subscriptions = await prisma.pushSubscription.findMany();
    
    for (const alertInfo of triggeredAlerts) {
      for (const alert of alertInfo.alerts) {
        const payload = {
          title: `${alertInfo.alias} ${alert.type} (${alert.timeframe})`,
          body: `RSI is currently ${alert.value.toFixed(1)}. Trade opportunity identified on RSIQ PRO.`,
          exchange: 'Multi', // Or detect from config if stored
          symbol: alertInfo.symbol,
        };

        // Send to all registered subscriptions
        // In a real app, you might only send to the user who owns the config if ownership is implemented
        // For now, we send to all global subscriptions as this is a "PRO" feature
        for (const sub of subscriptions) {
          const res = await sendPushNotification(sub, payload);
          if (res.expired) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
          }
        }

        // Log the alert to DB so it shows up in history
        await prisma.alertLog.create({
          data: {
            symbol: alertInfo.symbol,
            timeframe: alert.timeframe,
            value: alert.value,
            type: alert.type,
            exchange: 'Multi-Scan',
          },
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      triggeredCount: triggeredAlerts.length,
      notificationsSent: subscriptions.length * triggeredAlerts.reduce((acc, a) => acc + a.alerts.length, 0)
    });

  } catch (err) {
    console.error('[cron-alerts] Fatal error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
