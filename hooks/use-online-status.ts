"use client";

import { useEffect, useState, useCallback } from 'react';

/**
 * Hook to detect and track online/offline status
 * Useful for disabling real-time features and showing status indicators
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      console.log('[Connectivity] Back online');
      setIsOnline(true);
      setWasOffline(true);
      
      // Trigger data refresh when coming back online
      window.dispatchEvent(new CustomEvent('app-came-online'));
    };

    const handleOffline = () => {
      console.log('[Connectivity] Gone offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getConnectionSpeed = useCallback(async () => {
    if (!('connection' in navigator)) return null;
    return (navigator as any).connection.effectiveType;
  }, []);

  return {
    isOnline,
    wasOffline,
    getConnectionSpeed,
  };
}

/**
 * Hook to attempt recovery and alert when connection is restored
 */
export function useConnectionRecovery() {
  const { isOnline } = useOnlineStatus();

  useEffect(() => {
    const handleAppOnline = () => {
      // Request fresh data
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'REFRESH_DATA',
        });
      }
    };

    window.addEventListener('app-came-online', handleAppOnline);
    return () => window.removeEventListener('app-came-online', handleAppOnline);
  }, []);

  return { isOnline };
}
