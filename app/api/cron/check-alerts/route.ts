import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScreenerData } from '@/lib/screener-service';
import { sendPushNotification } from '@/lib/push-service';
import { getSymbolAlias } from '@/lib/symbol-utils';
import type { ScreenerEntry } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minute max for deeper scans

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[cron-alerts:${requestId}] Starting background check...`);

  try {
    // 1. Authenticate the Cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn(`[cron-alerts:${requestId}] Unauthorized attempt.`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check VAPID presence for debugging
    const hasVapid = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
    console.log(`[cron-alerts:${requestId}] VAPID keys present: ${hasVapid}`);

    // 2. Fetch all alert-enabled coin configurations
    const configs = await prisma.coinConfig.findMany({
      where: {
        OR: [
          { alertOn1m: true },
          { alertOn5m: true },
          { alertOn15m: true },
          { alertOn1h: true },
          { alertOnCustom: true },
          { alertConfluence: true },
          { alertOnStrategyShift: true },
        ],
      },
    });

    console.log(`[cron-alerts:${requestId}] Active configurations: ${configs.length}`);
    if (configs.length === 0) {
      return NextResponse.json({ success: true, message: 'No active alerts to monitor.' });
    }

    const alertSymbols = configs.map(c => c.symbol);
    
    // 3. Fetch current market data (Force fresh scan by using classic mode and high count)
    console.log(`[cron-alerts:${requestId}] Fetching fresh data for ${alertSymbols.length} indicators...`);
    const screenerResponse = await getScreenerData(500, { 
      smartMode: false, 
      prioritySymbols: alertSymbols 
    });
    
    const dataMap = new Map<string, ScreenerEntry>(
      screenerResponse.data.map((d: ScreenerEntry) => [d.symbol, d])
    );

    const triggeredAlerts: any[] = [];
    const now = Date.now();
    const THREE_MINUTES_AGO = new Date(now - 3 * 60 * 1000);

    // 4. Fetch recent alerts to enforce cooldown
    const recentAlerts = await prisma.alertLog.findMany({
      where: {
        createdAt: { gte: THREE_MINUTES_AGO }
      }
    });

    const cooldownMap = new Map<string, boolean>();
    recentAlerts.forEach(a => {
      cooldownMap.set(`${a.symbol}-${a.timeframe}`, true);
    });

    console.log(`[cron-alerts:${requestId}] Recent alerts in cooldown: ${recentAlerts.length}`);

    // 5. Evaluate Alert Logic
    for (const config of configs) {
      const entry = dataMap.get(config.symbol);
      if (!entry) continue;

      const alias = getSymbolAlias(config.symbol);
      const ob = config.overboughtThreshold;
      const os = config.oversoldThreshold;
      const NEAR_BUFFER = 0.3;

      const checkTrigger = (val: number | null, tf: string) => {
        if (val === null) return null;
        const cooldownKey = `${config.symbol}-${tf === 'STRATEGY' ? 'STRAT' : tf}`;
        if (cooldownMap.has(cooldownKey)) return null;

        if (val >= ob - NEAR_BUFFER) return { type: 'OVERBOUGHT', timeframe: tf, value: val };
        if (val <= os + NEAR_BUFFER) return { type: 'OVERSOLD', timeframe: tf, value: val };
        return null;
      };

      const alerts: any[] = [];
      if (config.alertOn1m) { const t = checkTrigger(entry.rsi1m, '1M'); if (t) alerts.push(t); }
      if (config.alertOn5m) { const t = checkTrigger(entry.rsi5m, '5M'); if (t) alerts.push(t); }
      if (config.alertOn15m) { const t = checkTrigger(entry.rsi15m, '15M'); if (t) alerts.push(t); }
      if (config.alertOn1h) { const t = checkTrigger(entry.rsi1h, '1H'); if (t) alerts.push(t); }
      if (config.alertOnCustom) { const t = checkTrigger(entry.rsiCustom, 'CUST'); if (t) alerts.push(t); }

      if (config.alertOnStrategyShift && (entry.strategySignal === 'strong-buy' || entry.strategySignal === 'strong-sell')) {
        const cooldownKey = `${config.symbol}-STRAT`;
        if (!cooldownMap.has(cooldownKey)) {
          alerts.push({
            type: entry.strategySignal === 'strong-buy' ? 'STRATEGY_STRONG_BUY' : 'STRATEGY_STRONG_SELL',
            timeframe: 'STRATEGY',
            value: entry.strategyScore
          });
        }
      }

      if (alerts.length > 0) {
        triggeredAlerts.push({ symbol: config.symbol, alias, alerts });
      }
    }

    console.log(`[cron-alerts:${requestId}] Triggered alerts: ${triggeredAlerts.length}`);

    if (triggeredAlerts.length === 0) {
      return NextResponse.json({ success: true, message: `Scan complete. No new alerts triggered for ${configs.length} configs.`, staleCoverage: screenerResponse.meta.indicatorCoveragePct });
    }

    // 6. Fetch Subscriptions and Send Pushes
    const subscriptions = await prisma.pushSubscription.findMany();
    console.log(`[cron-alerts:${requestId}] Found ${subscriptions.length} push subscriptions.`);
    
    let pushCount = 0;
    for (const alertInfo of triggeredAlerts) {
      for (const alert of alertInfo.alerts) {
        const isBuy = alert.type === 'OVERSOLD' || alert.type === 'STRATEGY_STRONG_BUY';
        const typeLabel = isBuy ? 'BUY' : 'SELL';
        const payload = {
          title: `${alertInfo.alias} ${typeLabel} (${alert.timeframe})`,
          body: alert.timeframe === 'STRATEGY' 
            ? `Strategy score reached ${alert.value.toFixed(0)}. Opportunity identified!`
            : `RSI is currently ${alert.value.toFixed(1)}. Opportunity identified!`,
          exchange: 'Multi-Scan',
          symbol: alertInfo.symbol,
        };

        await prisma.alertLog.create({
          data: {
            symbol: alertInfo.symbol,
            exchange: 'Multi-Scan',
            timeframe: alert.timeframe === 'STRATEGY' ? 'STRATEGY' : alert.timeframe,
            value: alert.value,
            type: alert.type,
          }
        });

        for (const sub of subscriptions) {
          try {
            const res = await sendPushNotification(sub, payload);
            if (res.success) pushCount++;
            if (res.expired) {
              await prisma.pushSubscription.delete({ where: { id: sub.id } });
            }
          } catch (e) {
            console.error(`[cron-alerts:${requestId}] Individual push error:`, e);
          }
        }
      }
    }

    console.log(`[cron-alerts:${requestId}] Finished. Sent ${pushCount} notifications.`);
    return NextResponse.json({ 
      success: true, 
      triggeredCount: triggeredAlerts.length,
      notificationsSent: pushCount,
      hasVapid
    });

  } catch (err: any) {
    console.error(`[cron-alerts:${requestId}] Fatal error:`, err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
