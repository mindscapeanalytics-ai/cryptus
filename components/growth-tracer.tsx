'use client';

import { Suspense } from 'react';
import { useReferral } from '@/hooks/use-referral';

/**
 * GrowthTracer - Client-side component to handle referral attribution.
 * Wrapped in Suspense to prevent Next.js de-optimization of static pages.
 */
function TraceLogic() {
  useReferral(); // This hook handles the logic of reading from URL and saving to localStorage
  return null;
}

export function GrowthTracer() {
  return (
    <Suspense fallback={null}>
      <TraceLogic />
    </Suspense>
  );
}
