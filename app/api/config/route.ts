import { NextResponse } from 'next/server';
import { getAllCoinConfigs, updateCoinConfig } from '@/lib/coin-config';
import { invalidateSymbolCache } from '@/lib/screener-service';
import { auth } from '@/lib/auth';

// GAP-F1 FIX: GET now requires authentication
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const configs = await getAllCoinConfigs(session.user.id);
    return NextResponse.json(Object.fromEntries(configs));
  } catch (err) {
    console.error('[config-api] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    // Inject authenticated userId and current exchange
    const updated = await updateCoinConfig({
      ...body,
      userId: session.user.id,
    });
    
    // Invalidate caches so the next fetch uses the fresh config
    invalidateSymbolCache(body.symbol);
    
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[config-api] POST error:', err);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
