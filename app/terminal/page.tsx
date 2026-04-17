// Force dynamic rendering to ensure session and entitlement checks are run on every request
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import ScreenerDashboard from '@/components/screener-dashboard';
import { SubscriptionGate } from '@/components/subscription-gate';

export default function TerminalPage() {
  return (
    <div className="min-h-screen bg-[#05080F]">
      <SubscriptionGate>
        <ScreenerDashboard />
      </SubscriptionGate>
    </div>
  );
}
