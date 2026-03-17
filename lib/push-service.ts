import webpush from 'web-push';

// GAP-F4 FIX: Module-level VAPID initialization (called once, not per-push)
let vapidInitialized = false;

function ensureVapidInitialized(): boolean {
  if (vapidInitialized) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    console.warn('[push-service] VAPID keys missing. Push notifications disabled.');
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

export async function sendPushNotification(subscription: any, payload: any) {
  try {
    if (!ensureVapidInitialized()) {
      return { success: false, error: 'MISSING_KEYS' };
    }

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify({
        type: 'ALERT_NOTIFICATION',
        payload,
      }),
      {
        TTL: 60, // 1 minute expiration (trade urgency)
        urgency: 'high', // Prioritize delivery on mobile gateways
      }
    );
    return { success: true };
  } catch (error: any) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      // Subscription has expired or is no longer valid
      return { success: false, expired: true };
    }
    console.error('[push-service] Push error:', error);
    return { success: false, error };
  }
}
