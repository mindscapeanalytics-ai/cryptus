import { NextResponse } from 'next/server';
import { getAllCoinConfigs, updateCoinConfig } from '@/lib/coin-config';
import { auth } from '@/lib/auth';

export async function GET() {
  const configs = await getAllCoinConfigs();
  return NextResponse.json(Object.fromEntries(configs));
}

export async function POST(request: Request) {
  try {
    // Basic auth check
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const updated = await updateCoinConfig(body);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[config-api] POST error:', err);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
