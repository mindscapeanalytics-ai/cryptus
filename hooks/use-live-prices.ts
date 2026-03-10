'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface LiveTick {
  price: number;
  change24h: number;
  volume24h: number;
  updatedAt: number;
}

interface BinanceMiniTicker {
  s: string;  // Symbol
  c: string;  // Close price
  o: string;  // Open price
  v: string;  // Base asset volume
  q: string;  // Quote asset volume
}

interface CombinedStreamMessage {
  stream: string;
  data: BinanceMiniTicker;
}

const WS_BASE = 'wss://stream.binance.com:9443/stream?streams=';
const FLUSH_INTERVAL_MS = 2000;
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];
const MAX_WS_CONNECTIONS = Math.max(1, Number(process.env.NEXT_PUBLIC_MAX_WS_CONNECTIONS ?? '3'));
const STREAMS_PER_CONNECTION = Math.max(50, Number(process.env.NEXT_PUBLIC_STREAMS_PER_WS ?? '180'));
const MAX_BUFFER_SIZE = 1000; // prevent unbounded buffer growth
const STALE_THRESHOLD_MS = 300_000; // 5 min — drop stale ticks

function toStream(symbol: string): string {
  return `${symbol.toLowerCase()}@miniTicker`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export function useLivePrices(symbols: Set<string>) {
  const [livePrices, setLivePrices] = useState<Map<string, LiveTick>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  const socketsRef = useRef<Map<number, WebSocket>>(new Map());
  const bufferRef = useRef<Map<string, LiveTick>>(new Map());
  const symbolsRef = useRef(symbols);
  const reconnectAttemptsRef = useRef<Map<number, number>>(new Map());
  const reconnectTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setInterval>>(undefined!);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const openSocketsRef = useRef(0);

  symbolsRef.current = symbols;

  // Flush buffered ticks to React state at a throttled interval
  useEffect(() => {
    flushTimerRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const buf = bufferRef.current;
      if (buf.size === 0) return;
      const now = Date.now();
      setLivePrices((prev) => {
        const next = new Map(prev);
        buf.forEach((tick, sym) => next.set(sym, tick));
        buf.clear();
        // Prune stale ticks that haven't been updated in 5 minutes
        if (next.size > 0) {
          for (const [sym, tick] of next) {
            if (now - tick.updatedAt > STALE_THRESHOLD_MS) next.delete(sym);
          }
        }
        return next;
      });
    }, FLUSH_INTERVAL_MS);

    return () => clearInterval(flushTimerRef.current);
  }, []);

  const closeAllSockets = useCallback(() => {
    reconnectTimersRef.current.forEach((timer) => clearTimeout(timer));
    reconnectTimersRef.current.clear();
    reconnectAttemptsRef.current.clear();
    socketsRef.current.forEach((ws) => {
      try {
        ws.close();
      } catch {
        // no-op
      }
    });
    socketsRef.current.clear();
    openSocketsRef.current = 0;
    setIsConnected(false);
  }, []);

  const handleTicker = useCallback((t: BinanceMiniTicker) => {
    const tracked = symbolsRef.current;
    if (!tracked.has(t.s)) return;

    const close = parseFloat(t.c);
    const open = parseFloat(t.o);
    if (!Number.isFinite(close) || close <= 0) return;

    const change24h = Number.isFinite(open) && open > 0
      ? Math.round(((close - open) / open) * 10000) / 100
      : 0;
    const volume = parseFloat(t.q);

    bufferRef.current.set(t.s, {
      price: close,
      change24h,
      volume24h: Number.isFinite(volume) ? volume : 0,
      updatedAt: Date.now(),
    });

    if (bufferRef.current.size > MAX_BUFFER_SIZE) {
      const firstKey = bufferRef.current.keys().next().value as string | undefined;
      if (firstKey) bufferRef.current.delete(firstKey);
    }
  }, []);

  const connectShard = useCallback((shardIndex: number, shardSymbols: string[], generation: number) => {
    if (!mountedRef.current || generationRef.current !== generation || shardSymbols.length === 0) return;

    const streams = shardSymbols.map(toStream).join('/');
    const ws = new WebSocket(`${WS_BASE}${streams}`);
    let opened = false;

    socketsRef.current.set(shardIndex, ws);

    ws.onopen = () => {
      if (!mountedRef.current || generationRef.current !== generation) return;
      opened = true;
      openSocketsRef.current += 1;
      setIsConnected(openSocketsRef.current > 0);
      reconnectAttemptsRef.current.set(shardIndex, 0);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as CombinedStreamMessage | BinanceMiniTicker;
        if (payload && typeof payload === 'object' && 'data' in payload) {
          handleTicker(payload.data);
          return;
        }
        if (payload && typeof payload === 'object' && 's' in payload) {
          handleTicker(payload);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current || generationRef.current !== generation) return;
      socketsRef.current.delete(shardIndex);
      if (opened) {
        openSocketsRef.current = Math.max(0, openSocketsRef.current - 1);
        setIsConnected(openSocketsRef.current > 0);
      }

      const attempts = reconnectAttemptsRef.current.get(shardIndex) ?? 0;
      const delay = RECONNECT_DELAYS[Math.min(attempts, RECONNECT_DELAYS.length - 1)];
      reconnectAttemptsRef.current.set(shardIndex, attempts + 1);

      const timer = setTimeout(() => {
        connectShard(shardIndex, shardSymbols, generation);
      }, delay);
      reconnectTimersRef.current.set(shardIndex, timer);
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        // no-op
      }
    };
  }, [handleTicker]);

  useEffect(() => {
    mountedRef.current = true;

    closeAllSockets();
    generationRef.current += 1;
    const generation = generationRef.current;

    const sorted = [...symbols].sort();
    if (sorted.length === 0) return () => {
      mountedRef.current = false;
      closeAllSockets();
      clearInterval(flushTimerRef.current);
    };

    const shardCount = Math.min(MAX_WS_CONNECTIONS, Math.max(1, Math.ceil(sorted.length / STREAMS_PER_CONNECTION)));
    const shardSize = Math.ceil(sorted.length / shardCount);
    const shards = chunk(sorted, shardSize);

    shards.forEach((shardSymbols, idx) => {
      connectShard(idx, shardSymbols, generation);
    });

    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      closeAllSockets();
      clearInterval(flushTimerRef.current);
    };
  }, [symbols, connectShard, closeAllSockets]);

  return { livePrices, isConnected };
}
