/**
 * RSIQ Pro — Derivatives Intelligence Types
 * Data structures for funding rates, liquidations, whale trades, and order flow.
 */

// ── Funding Rate ────────────────────────────────────────────────

export interface FundingRateData {
  symbol: string;
  rate: number;          // e.g., 0.0001 = 0.01%
  annualized: number;    // rate * 3 * 365 (3 funding periods per day)
  nextFundingTime: number;
  markPrice: number;
  indexPrice: number;
  updatedAt: number;
}

// ── Liquidation ─────────────────────────────────────────────────

export interface LiquidationEvent {
  id: string;
  symbol: string;
  side: 'Buy' | 'Sell';   // Buy = short liquidated, Sell = long liquidated
  size: number;            // quantity in base asset
  price: number;           // bankruptcy price
  valueUsd: number;        // size * price
  exchange: 'binance' | 'bybit';
  timestamp: number;
}

// ── Whale Trade ─────────────────────────────────────────────────

export interface WhaleTradeEvent {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';   // taker side
  price: number;
  quantity: number;
  valueUsd: number;
  exchange: 'binance' | 'bybit';
  timestamp: number;
}

// ── Order Flow ──────────────────────────────────────────────────

export interface OrderFlowData {
  symbol: string;
  buyVolume1m: number;     // USD value of buy-side volume in last 1 min
  sellVolume1m: number;    // USD value of sell-side volume in last 1 min
  ratio: number;           // buyVolume / (buyVolume + sellVolume), 0-1
  pressure: 'strong-buy' | 'buy' | 'neutral' | 'sell' | 'strong-sell';
  tradeCount1m: number;
  updatedAt: number;
}

// ── Open Interest ───────────────────────────────────────────────

export interface OpenInterestData {
  symbol: string;
  value: number;           // OI in USD
  change1h: number;        // % change from 1h ago
  change24h: number;       // % change from 24h ago
  updatedAt: number;
}

// ── Smart Money Pressure Index ──────────────────────────────────

export interface SmartMoneyPressure {
  symbol: string;
  score: number;           // -100 to +100
  label: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';
  components: {
    fundingSignal: number;       // -100 to +100
    liquidationImbalance: number; // -100 to +100 (positive = shorts liquidated more)
    whaleDirection: number;       // -100 to +100
    orderFlowPressure: number;   // -100 to +100
  };
  updatedAt: number;
}

// ── Aggregated Derivatives State ────────────────────────────────

export interface DerivativesState {
  fundingRates: Map<string, FundingRateData>;
  liquidations: LiquidationEvent[];       // last 100
  whaleAlerts: WhaleTradeEvent[];         // last 50
  orderFlow: Map<string, OrderFlowData>;
  openInterest: Map<string, OpenInterestData>;
  smartMoney: Map<string, SmartMoneyPressure>;
  isConnected: boolean;
  lastUpdate: number;
}

// ── Worker Message Types ────────────────────────────────────────

export type DerivativesWorkerMessage =
  | { type: 'START'; payload: { symbols: string[] } }
  | { type: 'STOP' }
  | { type: 'UPDATE_SYMBOLS'; payload: { symbols: string[] } }
  | { type: 'FUNDING_UPDATE'; payload: [string, FundingRateData][] }
  | { type: 'LIQUIDATION'; payload: LiquidationEvent }
  | { type: 'WHALE_TRADE'; payload: WhaleTradeEvent }
  | { type: 'ORDER_FLOW_UPDATE'; payload: [string, OrderFlowData][] }
  | { type: 'OI_UPDATE'; payload: [string, OpenInterestData][] };
