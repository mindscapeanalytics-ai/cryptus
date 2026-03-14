import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

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
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

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
      playTone(880, now, 0.4, 0.1);      
      playTone(1318.51, now + 0.05, 0.3, 0.05); 
      playTone(1760, now + 0.1, 0.2, 0.02);    
      
    } catch (e) {
      console.warn('[alerts] Audio generation failed:', e);
    }
  }, [soundEnabled]);

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

      const timeframes = [
        { key: 'rsi1m', label: '1m', configKey: 'alertOn1m' },
        { key: 'rsi5m', label: '5m', configKey: 'alertOn5m' },
        { key: 'rsi15m', label: '15m', configKey: 'alertOn15m' },
        { key: 'rsi1h', label: '1h', configKey: 'alertOn1h' },
        { key: 'rsiCustom', label: 'Custom', configKey: 'alertOnCustom' }
      ];

      timeframes.forEach(({ key, label, configKey }) => {
        const isEnabled = config ? config[configKey] : false; // Strict opt-in: false if no config exists
        
        if (!isEnabled) return;
        
        const val = entry[key];
        if (val === null || val === undefined) return;

        let currentZone: 'NEUTRAL' | 'OVERSOLD' | 'OVERBOUGHT' = 'NEUTRAL';
        
        // Apply hysteresis: If we were extreme, we need to cross back further than the threshold to become neutral
        // This prevents flickering alerts if price dances on the line.
        const stateKey = `${entry.symbol}-${label}`;
        const previousZone = zoneState.current.get(stateKey);
        
        const HYSTERESIS = 0.5;
        if (val <= osT) currentZone = 'OVERSOLD';
        else if (val >= obT) currentZone = 'OVERBOUGHT';
        else if (previousZone === 'OVERSOLD' && val < osT + HYSTERESIS) currentZone = 'OVERSOLD';
        else if (previousZone === 'OVERBOUGHT' && val > obT - HYSTERESIS) currentZone = 'OVERBOUGHT';

        // Always record the latest known zone to the state machine array
        zoneState.current.set(stateKey, currentZone);

        // Edge transition logic: alert ONLY when entering an extreme zone from a different zone
        if (previousZone !== undefined && previousZone !== currentZone && currentZone !== 'NEUTRAL') {
          const alertKey = `${entry.symbol}-${label}-${currentZone}`;
          const now = Date.now();
          const last = lastTriggered.current.get(alertKey) || 0;

          if (now - last > COOLDOWN_MS) {
            lastTriggered.current.set(alertKey, now);
            
            const newAlert = {
              symbol: entry.symbol,
              timeframe: label,
              value: val,
              type: currentZone
            };

            // UI Actions
            toast[currentZone === 'OVERSOLD' ? 'success' : 'error'](
              `${entry.symbol} ${label} RSI is ${currentZone} [${val.toFixed(1)}]`,
              { duration: 5000 }
            );
            
            playAlertSound();
            logAlert(newAlert);
          }
        }
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

  return { alerts, setAlerts };
}
