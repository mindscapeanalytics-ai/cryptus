"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, 
  X, 
  Smartphone, 
  ShieldCheck, 
  Zap, 
  MonitorSmartphone 
} from 'lucide-react';

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Precise Standalone Detection
    const checkStandalone = () => {
      if (typeof window === 'undefined') return false;
      return (
        window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
      );
    };

    // DEBUG: Force show if needed for testing (Set in console: sessionStorage.setItem('pwa-debug', 'true'))
    const isDebug = typeof window !== 'undefined' && sessionStorage.getItem('pwa-debug') === 'true';

    if (checkStandalone() && !isDebug) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed in this session
    if (sessionStorage.getItem('pwa-prompt-dismissed') && !isDebug) {
      setIsVisible(false);
      return;
    }

    // 2. Automated Event Listener (Chrome/Android/Edge)
    const handler = (e: any) => {
      console.log("[PWA] beforeinstallprompt event fired");
      e.preventDefault();
      setDeferredPrompt(e);
      // Fast trigger for automated support
      if (!sessionStorage.getItem('pwa-snoozed') || isDebug) {
        setTimeout(() => setIsVisible(true), isDebug ? 500 : 2000);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // 3. Fallback Logic for iOS/Desktop Chrome without prompt
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (!checkStandalone() && (!sessionStorage.getItem('pwa-snoozed') || isDebug)) {
      // Show fallback prompt after 10s if the automated event didn't fire
      const delay = isMobile ? (isDebug ? 500 : 4000) : 10000;
      const timer = setTimeout(() => {
        if (!isInstalled) setIsVisible(true);
      }, delay);
      return () => clearTimeout(timer);
    }

    window.addEventListener('appinstalled', () => {
      console.log("[PWA] App installed successfully");
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [isInstalled]);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Manual instruction fallback
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        alert("To Install RSIQ Pro:\n1. Tap 'Share' icon below\n2. Select 'Add to Home Screen' 📲");
      } else {
        alert("To Install:\nClick three dots (menu) in browser and select 'Install App' or 'Add to Home Screen'.");
      }
      return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsVisible(false);
      setDeferredPrompt(null);
    }
  };

  const closePrompt = () => {
    setIsVisible(false);
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
    sessionStorage.setItem('pwa-snoozed', 'true');
  };

  if (isInstalled || !isVisible) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ y: 50, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 20, stiffness: 350 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0 w-[calc(100%-2rem)] md:w-[350px] z-[999]"
      >
        <div className="bg-[#080F1B]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex items-center gap-4 relative group overflow-hidden">
          {/* Subtle Dynamic Glow */}
          <div className="absolute inset-0 bg-gradient-to-tr from-[#39FF14]/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
          
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#39FF14]/20 to-emerald-900/40 border border-[#39FF14]/30 flex items-center justify-center shrink-0 shadow-lg ring-1 ring-[#39FF14]/10">
            <MonitorSmartphone size={24} className="text-[#39FF14]" />
          </div>

          <div className="flex-1 min-w-0 relative z-10">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-white tracking-tight flex items-center gap-1.5 leading-none">
                Install <span className="text-[#39FF14]">RSIQ Pro</span>
              </h4>
               <button 
                onClick={closePrompt}
                className="p-1 rounded-full hover:bg-white/5 text-slate-600 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-[10px] font-bold text-slate-400 mt-1.5 leading-tight">
              Get the full terminal experience.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <button 
                onClick={handleInstall}
                className="px-4 py-1.5 rounded-lg bg-[#39FF14] text-black text-[9px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all outline-none"
              >
                Install
              </button>
              <button 
                onClick={closePrompt}
                className="text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-all outline-none"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
