import webpush from 'web-push';

export async function sendPushNotification(subscription: any, payload: any) {
  try {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
      console.warn('[push-service] VAPID keys missing. Skipping push.');
      return { success: false, error: 'MISSING_KEYS' };
    }

    // Initialize VAPID details lazily within the function call
    // to prevent build-time failures if keys are missing in build environment
    webpush.setVapidDetails(
      'mailto:noreply@rsiq.pro',
      publicKey,
      privateKey
    );

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
      })
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
