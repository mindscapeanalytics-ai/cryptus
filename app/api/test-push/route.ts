import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushNotification } from '@/lib/push-service';

export async function GET() {
  try {
    const subscriptions = await prisma.pushSubscription.findMany();
    
    if (subscriptions.length === 0) {
      return NextResponse.json({ error: 'No subscriptions found. Please enable alerts in the UI first.' }, { status: 404 });
    }

    const payload = {
      title: 'RSIQ Pro Debug Test',
      body: 'If you see this, your Web Push configuration (VAPID) is working perfectly!',
      exchange: 'TestEngine',
      symbol: 'TEST',
    };

    let successCount = 0;
    for (const sub of subscriptions) {
      const res = await sendPushNotification(sub, payload);
      if (res.success) successCount++;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Sent test push to ${successCount} devices.`,
      keysPresent: {
        public: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        private: !!process.env.VAPID_PRIVATE_KEY
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
