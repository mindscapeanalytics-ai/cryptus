import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/api-auth';
import { getUserPreferences, updateUserPreferences } from '@/lib/user-preferences';

export async function GET(request: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const prefs = await getUserPreferences(user.id);
    return NextResponse.json(prefs || {}, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
      },
    });
  } catch (err) {
    console.error('[preferences-api] GET error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user: sessionUser } = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // ── Institutional SaaS Enforcement: Validation against Entitlements ──
    const { resolveEntitlementsForUser } = await import('@/lib/entitlements');
    const entitlements = await resolveEntitlementsForUser(sessionUser as any);

    // 1. Record Limit Enforcement
    if (body.pairCount !== undefined && body.pairCount > entitlements.maxRecords) {
      body.pairCount = entitlements.maxRecords; // Silently cap to tier limit
    }

    // 2. Feature Gating (Advanced Indicators)
    if (!entitlements.features.enableAdvancedIndicators) {
      const indicators = [
        'globalUseMacd', 'globalUseBb', 'globalUseStoch', 'globalUseEma', 
        'globalUseVwap', 'globalUseConfluence', 'globalUseDivergence', 'globalUseMomentum'
      ];
      indicators.forEach(key => {
        if ((body as any)[key] === true) (body as any)[key] = false;
      });
    }

    // 3. Feature Gating (Custom Settings / Extreme Alerts Fallback)
    if (!entitlements.features.enableCustomSettings && body.globalThresholdsEnabled === true) {
      body.globalThresholdsEnabled = false;
    }

    const updated = await updateUserPreferences(sessionUser.id, body);

    return NextResponse.json(updated, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
      },
    });
  } catch (err) {
    console.error('[preferences-api] POST error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
