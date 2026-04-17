'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const REFERRAL_KEY = 'rsiq_ref_id';
const EXPIRY_DAYS = 30;

/**
 * useReferral Attribution Hook
 * 
 * Captures ?ref=... from the URL and persists it in localStorage for 30 days.
 * This allows the platform to track which users are driving viral growth.
 */
export function useReferral() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get('ref');
    
    if (ref) {
      try {
        const payload = {
          id: ref,
          capturedAt: Date.now(),
          expiresAt: Date.now() + (EXPIRY_DAYS * 24 * 60 * 60 * 1000)
        };
        
        localStorage.setItem(REFERRAL_KEY, JSON.stringify(payload));
        console.log(`[growth] Attribution captured: ${ref}`);
      } catch (e) {
        console.error('[growth] Failed to store referral:', e);
      }
    }
  }, [searchParams]);

  return {
    getReferralId: () => {
      try {
        const stored = localStorage.getItem(REFERRAL_KEY);
        if (!stored) return null;
        
        const payload = JSON.parse(stored);
        if (Date.now() > payload.expiresAt) {
          localStorage.removeItem(REFERRAL_KEY);
          return null;
        }
        
        return payload.id;
      } catch {
        return null;
      }
    }
  };
}
