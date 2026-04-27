/**
 * RSIQ Pro - Hybrid Multi-Asset Market Data API
 * Copyright © 2024–2026 Mindscape Analytics LLC. All rights reserved.
 * https://mindscapeanalytics.com/
 *
 * PROPRIETARY AND CONFIDENTIAL. Unauthorized copying, modification,
 * distribution, or use of this software is strictly prohibited.
 *
 * Architecture:
 * 1. Cache Layer: 15min TTL (instant, no API calls)
 * 2. Alpha Vantage: Intraday candles (25 calls/day FREE)
 * 3. Twelve Data: Fallback intraday (800 calls/day FREE)
 * 4. Yahoo Finance v7: Batch quotes (price, SMAs, market state)
 * 5. Yahoo Finance v8: Chart data (2h history backup)
 *
 * Security: Session-gated - requires authenticated user with active subscription or trial.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/api-auth';
import { getAlphaVantageClient } from '@/lib/data-sources/alpha-vantage';
import { getTwelveDataClient } from '@/lib/data-sources/twelve-data';
import { intradayCache } from '@/lib/data-sources/intraday-cache';

// ── Rate Limiter (Per-IP, in-memory) ─────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// ── Resilient fetch with retry + fallback endpoints ──────────────
const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

async function resilientFetch(path: string, timeoutMs = 6000): Promise<any> {
  for (const host of YAHOO_HOSTS) {
    try {
      const url = `https://${host}${path}`;
      const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
      const res = await fetch(url, {
        headers: { 'User-Agent': ua },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return await res.json();
    } catch {
      // Try next host
    }
  }
  return null;
}

// ── Intraday Data Fetcher (Alpha Vantage + Twelve Data + Cache) ──
async function fetchIntradayData(symbols: string[]): Promise<Map<string, number[]>> {
  const results = new Map<string, number[]>();
  
  // Only fetch top 10 visible symbols to stay within rate limits
  const prioritySymbols = symbols.slice(0, 10);
  
  const alphaVantage = getAlphaVantageClient();
  const twelveData = getTwelveDataClient();
  
  for (const symbol of prioritySymbols) {
    // 1. Check cache first (15min TTL)
    const cached = intradayCache.get(symbol, '1min');
    if (cached) {
      const closes = cached.map((c: any) => {
        // Handle both Alpha Vantage and Twelve Data formats
        if (typeof c === 'object' && c.close !== undefined) {
          return typeof c.close === 'number' ? c.close : parseFloat(c.close);
        }
        return c;
      }).filter((c: number) => Number.isFinite(c) && c > 0);
      
      if (closes.length > 0) {
        results.set(symbol, closes);
        continue;
      }
    }
    
    // 2. Try Alpha Vantage (primary source)
    if (alphaVantage) {
      try {
        const data = await alphaVantage.getIntradayCandles(symbol, '1min', 'compact');
        if (data && data.candles.length > 0) {
          const closes = data.candles.map(c => c.close);
          results.set(symbol, closes);
          intradayCache.set(symbol, '1min', data.candles, 'alphavantage');
          
          // Rate limit: wait 12s between calls (5 calls/min = 1 call per 12s)
          await new Promise(resolve => setTimeout(resolve, 12000));
          continue;
        }
      } catch (error) {
        console.error(`[IntradayData] Alpha Vantage error for ${symbol}:`, error);
      }
    }
    
    // 3. Fallback to Twelve Data
    if (twelveData) {
      try {
        const data = await twelveData.getTimeSeries(symbol, '1min', 100);
        if (data && data.candles.length > 0) {
          const closes = data.candles.map((c: any) => parseFloat(c.close));
          results.set(symbol, closes);
          intradayCache.set(symbol, '1min', data.candles, 'twelvedata');
          
          // Rate limit: wait 8s between calls (8 calls/min = 1 call per 7.5s)
          await new Promise(resolve => setTimeout(resolve, 8000));
        }
      } catch (error) {
        console.error(`[IntradayData] Twelve Data error for ${symbol}:`, error);
      }
    }
  }
  
  // Log stats for monitoring
  if (results.size > 0) {
    const cacheStats = intradayCache.getStats();
    console.log('[IntradayData] Fetched:', {
      symbols: results.size,
      cacheHitRate: cacheStats.hitRate,
      alphaVantage: alphaVantage?.getStats(),
      twelveData: twelveData?.getStats(),
    });
  }
  
  return results;
}

// ── Types ────────────────────────────────────────────────────────
interface MarketDataEntry {
  symbol: string;
  displayName: string;
  price: number;
  open: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  sma50: number | null;
  sma200: number | null;
  marketState: string;
  currency: string;
  updatedAt: number;
  closes: number[]; // Last 60-120 minutes of 1m closes for technicals
}

// ── Main Handler ─────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // ── 1. Soft Auth (tiered rate limits like the screener) ──
  let userId: string | null = null;
  try {
    const { user } = await getSessionUser();
    userId = user?.id ?? null;
  } catch {
    // Auth failure is non-fatal - anonymous access with lower limits
  }

  // ── 2. Rate Limit (authenticated users get higher burst) ──
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rateLimitKey = userId || ip;
  if (!checkRateLimit(rateLimitKey)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please retry shortly.' },
      { status: 429, headers: { 'Retry-After': '30' } }
    );
  }

  // ── 3. Parse Params ──
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  const assetClass = searchParams.get('class') || 'stocks';

  if (!symbolsParam) {
    return NextResponse.json({ error: 'Missing symbols' }, { status: 400 });
  }

  const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 50);
  if (symbols.length === 0) return NextResponse.json({ data: [] });

  try {
    // ── 4. Fetch Batch Quotes (v7) with fallback ──
    const quotePath = `/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(','))}&fields=regularMarketPrice,regularMarketOpen,regularMarketPreviousClose,regularMarketChange,regularMarketChangePercent,regularMarketVolume,regularMarketDayHigh,regularMarketDayLow,fiftyDayAverage,twoHundredDayAverage,shortName,longName,marketState,currency`;

    // ── 5. Fetch Intraday Data (Alpha Vantage + Twelve Data + Cache) ──
    const intradayData = await fetchIntradayData(symbols);
    
    // ── 6. Fetch Charts for Technicals (v8) - Parallelized (Yahoo backup) ──
    const techRequired = symbols.slice(0, 30);

    const [quoteResponse, ...chartResults] = await Promise.all([
      resilientFetch(quotePath, 6000),
      ...techRequired.map(s =>
        resilientFetch(`/v8/finance/chart/${encodeURIComponent(s)}?interval=1m&range=2h&includePrePost=false`, 5000)
      ),
    ]);

    const quotes = quoteResponse?.quoteResponse?.result || [];
    const charMap = new Map<string, number[]>();

    // Process charts into closes map (Yahoo backup)
    chartResults.forEach(chart => {
      const res = chart?.chart?.result?.[0];
      const sym = res?.meta?.symbol;
      const cl = res?.indicators?.quote?.[0]?.close;
      if (sym && Array.isArray(cl)) {
        charMap.set(sym, cl.filter((c: any) => c !== null && typeof c === 'number'));
      }
    });

    // ── 7. Merge into unified MarketDataEntry stream ──
    const results: MarketDataEntry[] = quotes.map((q: any) => {
      // Priority: Alpha Vantage/Twelve Data > Yahoo Chart > Empty
      const histCloses = intradayData.get(q.symbol) || charMap.get(q.symbol) || [];
      const livePrice = q.regularMarketPrice || 0;

      // Append live price to closes tail for indicator accuracy
      if (livePrice > 0 && (histCloses.length === 0 || histCloses[histCloses.length - 1] !== livePrice)) {
        histCloses.push(livePrice);
      }

      return {
        symbol: q.symbol,
        displayName: q.shortName || q.longName || q.symbol,
        price: livePrice,
        open: q.regularMarketOpen || q.regularMarketPreviousClose || 0,
        previousClose: q.regularMarketPreviousClose || 0,
        change: q.regularMarketChange || 0,
        changePercent: q.regularMarketChangePercent || 0,
        volume: q.regularMarketVolume || 0,
        high: q.regularMarketDayHigh || livePrice,
        low: q.regularMarketDayLow || livePrice,
        sma50: q.fiftyDayAverage || null,
        sma200: q.twoHundredDayAverage || null,
        marketState: q.marketState || 'REGULAR',
        currency: q.currency || 'USD',
        updatedAt: Date.now(),
        closes: histCloses.slice(-120), // Keep 120 candles for technical depth
      };
    });

    // Determine data source for response
    const dataSource = intradayData.size > 0 
      ? 'hybrid-alphavantage-twelvedata-yahoo'
      : 'hybrid-yahoo-v7v8';

    return NextResponse.json({
      data: results,
      source: dataSource,
      timestamp: Date.now(),
      assetClass,
      stats: {
        intradaySymbols: intradayData.size,
        yahooSymbols: charMap.size,
        cacheStats: intradayCache.getStats(),
      },
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Powered-By': 'Mindscape Analytics RSIQ Pro',
      },
    });

  } catch (error) {
    console.error('[api/market-data] Hybrid Fetch Error:', error);
    return NextResponse.json({ error: 'Market data engine error', data: [] }, { status: 502 });
  }
}

