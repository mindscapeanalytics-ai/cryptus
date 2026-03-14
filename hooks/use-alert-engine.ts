import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

export interface Alert {
  id: string;
  symbol: string;
  timeframe: string;
  value: number;
  type: 'OVERSOLD' | 'OVERBOUGHT';
  createdAt: number;
}

export function useAlertEngine(
  data: any[],
  coinConfigs: Record<string, any>,
  enabled: boolean,
  soundEnabled: boolean
) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  // Store the last known zone: 'NEUTRAL' | 'OVERSOLD' | 'OVERBOUGHT' for edge-triggering
  const zoneState = useRef<Map<string, 'NEUTRAL' | 'OVERSOLD' | 'OVERBOUGHT'>>(new Map());
  // Anti-dancing cooldown (3 min) on top of edge mapping
  const lastTriggered = useRef<Map<string, number>>(new Map());
  const COOLDOWN_MS = 3 * 60 * 1000;

  const audioCtxRef = useRef<AudioContext | null>(null);

  const playAlertSound = useCallback(async () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      
      if (ctx.state !== 'running') return;

      const playTone = (freq: number, startTime: number, duration: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(vol, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
        
        setTimeout(() => {
          osc.disconnect();
          gain.disconnect();
        }, (duration + 0.1) * 1000);
      };

      const now = ctx.currentTime;
      playTone(880, now, 0.4, 0.15);      
      playTone(1108.73, now + 0.08, 0.35, 0.08); 
      playTone(1318.51, now + 0.16, 0.3, 0.05); 
      playTone(1760, now + 0.24, 0.25, 0.03);    
      
    } catch (e) {
      console.warn('[alerts] Audio generation failed:', e);
    }
  }, [soundEnabled]);

  const triggerNativeNotification = useCallback((title: string, body: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/logo/logo-rsi.png'
      });
    }
  }, []);

  const logAlert = useCallback(async (alert: Omit<Alert, 'id' | 'createdAt'>) => {
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      });
      if (res.ok) {
        const saved = await res.json();
        // Ensure createdAt is numeric for unified sorting/rendering
        const normalized = {
          ...saved,
          createdAt: typeof saved.createdAt === 'string' ? new Date(saved.createdAt).getTime() : saved.createdAt
        };
        setAlerts(prev => [normalized, ...prev].slice(0, 50));
      }
    } catch (e) {
      console.error('[alerts] Failed to log alert:', e);
    }
  }, []);

  useEffect(() => {
    if (!enabled || data.length === 0) return;

    data.forEach(entry => {
      const config = coinConfigs[entry.symbol];
      const obT = config?.overboughtThreshold ?? 70;
      const osT = config?.oversoldThreshold ?? 30;
      const confluenceMode = config?.alertConfluence ?? false;

      const timeframes = [
        { key: 'rsi1m', label: '1m', configKey: 'alertOn1m' },
        { key: 'rsi5m', label: '5m', configKey: 'alertOn5m' },
        { key: 'rsi15m', label: '15m', configKey: 'alertOn15m' },
        { key: 'rsi1h', label: '1h', configKey: 'alertOn1h' },
        { key: 'rsiCustom', label: 'Custom', configKey: 'alertOnCustom' }
      ];

      // 1. Calculate and update current zone for all TFs first
      const currentZones = new Map<string, 'NEUTRAL' | 'OVERSOLD' | 'OVERBOUGHT'>();
      
      timeframes.forEach(({ key, label }) => {
        const val = entry[key];
        if (val === null || val === undefined) return;

        const stateKey = `${entry.symbol}-${label}`;
        const previousZone = zoneState.current.get(stateKey);
        let zone: 'NEUTRAL' | 'OVERSOLD' | 'OVERBOUGHT' = 'NEUTRAL';
        
        const HYSTERESIS = 0.5;
        if (val <= osT) zone = 'OVERSOLD';
        else if (val >= obT) zone = 'OVERBOUGHT';
        else if (previousZone === 'OVERSOLD' && val < osT + HYSTERESIS) zone = 'OVERSOLD';
        else if (previousZone === 'OVERBOUGHT' && val > obT - HYSTERESIS) zone = 'OVERBOUGHT';
        
        currentZones.set(label, zone);
      });

      // 2. Trigger Alerts
      timeframes.forEach(({ label, configKey }) => {
        const isEnabled = config ? config[configKey] : false;
        if (!isEnabled) return;

        const currentZone = currentZones.get(label);
        if (!currentZone || currentZone === 'NEUTRAL') {
          // Update zone state even if neutral to allow later transitions
          zoneState.current.set(`${entry.symbol}-${label}`, 'NEUTRAL');
          return;
        }

        const stateKey = `${entry.symbol}-${label}`;
        const previousZone = zoneState.current.get(stateKey);

        // Check for Confluence if enabled
        let hasConfluence = true;
        if (confluenceMode) {
          // Confluence logic: At least one OTHER enabled timeframe must be in the SAME extreme zone
          const otherExtremes = timeframes
            .filter(tf => tf.label !== label && config[tf.configKey])
            .some(tf => currentZones.get(tf.label) === currentZone);
          
          if (!otherExtremes) hasConfluence = false;
        }

        // Edge transition logic + Confluence check
        if (previousZone !== undefined && previousZone !== currentZone && hasConfluence) {
          const alertKey = `${entry.symbol}-${label}-${currentZone}`;
          const now = Date.now();
          const last = lastTriggered.current.get(alertKey) || 0;

          if (now - last > COOLDOWN_MS) {
            lastTriggered.current.set(alertKey, now);
            
            const val = entry[timeframes.find(t => t.label === label)!.key];
            const newAlert = {
              symbol: entry.symbol,
              timeframe: label,
              value: val,
              type: currentZone
            };

            // UI Actions
            toast[currentZone === 'OVERSOLD' ? 'success' : 'error'](
              `${entry.symbol} ${label} ${confluenceMode ? 'CONFLUENCE' : 'RSI'} is ${currentZone} [${val.toFixed(1)}]`,
              { 
                duration: 5000,
                description: confluenceMode ? "Aligned with other timeframes" : undefined
              }
            );
            
            playAlertSound();
            logAlert(newAlert);
            triggerNativeNotification(
              `${entry.symbol} ${currentZone}`,
              `${label} RSI is ${val.toFixed(1)}`
            );
          }
        }

        // Always update the state machine
        zoneState.current.set(stateKey, currentZone);
      });
    });
  }, [data, coinConfigs, enabled, COOLDOWN_MS, logAlert, playAlertSound]);

  // Initial load of alert history
  useEffect(() => {
    fetch('/api/alerts')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAlerts(data);
      })
      .catch(e => console.error('[alerts] History fetch failed:', e));
  }, []);

  const triggerTestAlert = useCallback(() => {
    const testLabel = "TEST";
    toast.success("RSIQ Alert System: Sound & Notification Check", {
      description: "Verifying your personalized alert settings."
    });
    playAlertSound();
    triggerNativeNotification("RSIQ PRO Test", "Alert system is functional!");
  }, [playAlertSound, triggerNativeNotification]);

  const clearAlertHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts', { method: 'DELETE' });
      if (res.ok) {
        setAlerts([]);
        toast.success("Alert history cleared successfully.");
      } else {
        throw new Error('Failed to clear alerts');
      }
    } catch (e) {
      console.error('[alerts] Clear history failed:', e);
      toast.error("Failed to clear alert history.");
    }
  }, []);

  return { alerts, setAlerts, triggerTestAlert, clearAlertHistory };
}
