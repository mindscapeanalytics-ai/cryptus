import webpush from 'web-push';

// ── VAPID Singleton (Task 7.1) ────────────────────────────────────────────────
// Module-level initialization - called once, reused for every push request.
let vapidInitialized = false;

function ensureVapidInitialized(): boolean {
  if (vapidInitialized) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    console.error('[push-service] CRITICAL: VAPID keys missing. Push notifications disabled.');
    return false;
  }

  webpush.setVapidDetails(
    'mailto:noreply@rsiq.pro',
    publicKey,
    privateKey,
  );
  vapidInitialized = true;
  return true;
}

/**
 * Returns the current VAPID initialization status.
 * Useful for health checks.
 */
export function getVapidStatus(): { initialized: boolean; hasKeys: boolean } {
  const hasKeys =
    !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
  return { initialized: vapidInitialized, hasKeys };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildWebPushSubscription(subscription: any) {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

// ── Core send (no retry) ──────────────────────────────────────────────────────

export async function sendPushNotification(
  subscription: any,
  payload: any,
): Promise<{ success: boolean; expired?: boolean; error?: any }> {
  try {
    if (!ensureVapidInitialized()) {
      return { success: false, error: 'MISSING_KEYS' };
    }

    await webpush.sendNotification(
      buildWebPushSubscription(subscription),
      JSON.stringify({ type: 'ALERT_NOTIFICATION', payload }),
      { TTL: 60, urgency: 'high' },
    );
    return { success: true };
  } catch (error: any) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      return { success: false, expired: true };
    }
    console.error('[push-service] Push error:', error);
    return { success: false, error };
  }
}

// ── Retry with exponential backoff (Task 7.3) ─────────────────────────────────

/**
 * Sends a push notification with up to `maxRetries` attempts.
 *
 * Retry delays: 1 s → 2 s → 4 s (exponential backoff).
 * Expired subscriptions (410/404) are returned immediately without retrying.
 * Rate-limited responses (429) are retried with a longer delay (next backoff × 2).
 */
export async function sendPushNotificationWithRetry(
  subscription: any,
  payload: any,
  maxRetries = 3,
): Promise<{ success: boolean; expired?: boolean; error?: any }> {
  if (!ensureVapidInitialized()) {
    return { success: false, error: 'MISSING_KEYS' };
  }

  const endpointSnippet = typeof subscription?.endpoint === 'string'
    ? subscription.endpoint.slice(-20)
    : 'unknown';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await webpush.sendNotification(
        buildWebPushSubscription(subscription),
        JSON.stringify({ type: 'ALERT_NOTIFICATION', payload }),
        { TTL: 60, urgency: 'high' },
      );
      return { success: true };
    } catch (error: any) {
      // Expired / gone - don't retry
      if (error.statusCode === 404 || error.statusCode === 410) {
        return { success: false, expired: true };
      }

      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) {
        console.error('[push-service] Push notification failed after retries', {
          endpoint: `...${endpointSnippet}`,
          attempts: maxRetries,
          statusCode: error.statusCode,
          error: error.message,
        });
        return { success: false, error };
      }

      // Exponential backoff: 1s, 2s, 4s …
      // Rate-limited (429): double the delay
      let delayMs = Math.pow(2, attempt - 1) * 1000;
      if (error.statusCode === 429) {
        delayMs *= 2;
      }
      await sleep(delayMs);
    }
  }

  // Should never reach here, but satisfy TypeScript
  return { success: false, error: 'UNKNOWN' };
}
