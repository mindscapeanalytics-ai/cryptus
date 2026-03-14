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

  const resumeAudioContext = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      console.log("[alerts] AudioContext active:", audioCtxRef.current.state);
    } catch (e) {
      console.error("[alerts] Failed to resume audio:", e);
    }
  }, []);

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

      const playTone = (freq: number, startTime: number, duration: number, vol: number, type: OscillatorType = 'sine') => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(vol, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
        
        setTimeout(() => {
          osc.disconnect();
          gain.disconnect();
        }, (duration + 0.5) * 1000);
      };

      const now = ctx.currentTime;
      
      // Enterprise "Harmonic Bloom" Chime
      // High-end attack
      playTone(1046.50, now, 0.6, 0.12, 'sine'); // C6
      playTone(1318.51, now + 0.05, 0.5, 0.08, 'sine'); // E6
      playTone(1567.98, now + 0.1, 0.4, 0.06, 'sine'); // G6
      
      // Soft bed
      playTone(523.25, now, 0.8, 0.05, 'sine'); // C5
      
    } catch (e) {
      console.warn('[alerts] Audio generation failed:', e);
    }
  }, [soundEnabled]);

  const triggerNativeNotification = useCallback((title: string, body: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/logo/mindscape-analytics.png', // Premium logo
        silent: true // We handle audio ourselves for better control
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
      
      // CRITICAL: If no config exists for this coin, skip entirely
      if (!config) return;

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

      timeframes.forEach(({ label, configKey }) => {
        const isEnabled = config[configKey] === true; // Explicitly check for true
        if (!isEnabled) return;

        const currentZone = currentZones.get(label);
        if (!currentZone || currentZone === 'NEUTRAL') {
          zoneState.current.set(`${entry.symbol}-${label}`, 'NEUTRAL');
          return;
        }

        const stateKey = `${entry.symbol}-${label}`;
        const previousZone = zoneState.current.get(stateKey);

        let hasConfluence = true;
        if (confluenceMode) {
          const otherExtremes = timeframes
            .filter(tf => tf.label !== label && config[tf.configKey])
            .some(tf => currentZones.get(tf.label) === currentZone);
          
          if (!otherExtremes) hasConfluence = false;
        }

        if (previousZone !== undefined && previousZone !== currentZone && hasConfluence) {
          const alertKey = `${entry.symbol}-${label}-${currentZone}`;
          const now = Date.now();
          const last = lastTriggered.current.get(alertKey) || 0;

          if (now - last > COOLDOWN_MS) {
            lastTriggered.current.set(alertKey, now);
            
            const tfEntry = timeframes.find(t => t.label === label);
            const val = tfEntry ? entry[tfEntry.key] : 0;
            const newAlert = {
              symbol: entry.symbol,
              timeframe: label,
              value: val,
              type: currentZone as 'OVERSOLD' | 'OVERBOUGHT'
            };

            toast[currentZone === 'OVERSOLD' ? 'success' : 'error'](
              `${entry.symbol} ${label} ${confluenceMode ? 'CONFLUENCE' : 'RSI'} is ${currentZone} [${val.toFixed(1)}]`,
              { 
                duration: 6000,
                description: confluenceMode ? "Multiple timeframes aligned" : "Personalized alert strategy triggered"
              }
            );
            
            playAlertSound();
            logAlert(newAlert);
            triggerNativeNotification(
              `${entry.symbol} ${currentZone}`,
              `${label} RSI reached ${val.toFixed(1)} on personalized config.`
            );
          }
        }

        zoneState.current.set(stateKey, currentZone);
      });
    });
  }, [data, coinConfigs, enabled, COOLDOWN_MS, logAlert, playAlertSound, triggerNativeNotification]);

  useEffect(() => {
    fetch('/api/alerts')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAlerts(data);
      })
      .catch(e => console.error('[alerts] History fetch failed:', e));
  }, []);

  const triggerTestAlert = useCallback(() => {
    toast.success("RSIQ Enterprise: Flow Test", {
      description: "Verifying your personalized high-fidelity alert pipeline."
    });
    playAlertSound();
    triggerNativeNotification("RSIQ PRO Test", "Enterprise alert delivery is active!");
  }, [playAlertSound, triggerNativeNotification]);

  const clearAlertHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts', { method: 'DELETE' });
      if (res.ok) {
        setAlerts([]);
        toast.success("Alert history purged.");
      }
    } catch (e) {
      console.error('[alerts] Clear history failed:', e);
    }
  }, []);

  return { alerts, setAlerts, triggerTestAlert, clearAlertHistory, resumeAudioContext };
}
