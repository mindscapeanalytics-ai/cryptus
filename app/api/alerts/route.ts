import { NextResponse } from 'next/server';
import { createAlertLog, getRecentAlerts } from '@/lib/alert-log';
import { auth } from '@/lib/auth';

export async function GET() {
  const alerts = await getRecentAlerts();
  return NextResponse.json(alerts);
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.symbol || !body.timeframe || body.value === undefined || !body.type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const alert = await createAlertLog(body);
    return NextResponse.json(alert);
  } catch (err) {
    console.error('[alerts-api] POST error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
