## End-to-end strategy pipeline (real-time screener)

This document describes the **actual** dataflow and decision logic used to produce the columns:
`Signal` (RSI extreme), `Strategy` (multi-factor score), `Super Signal` (fusion), and `Final` (single execution resolver).

### 1) Real-time data feed → pipeline stages

- **Client poll / snapshot**
  - Endpoint: `app/api/screener/route.ts`
  - Calls `getScreenerData()` in `lib/screener-service.ts`
  - Returns a *single authoritative snapshot* per refresh cycle including `strategySignal`, `strategyScore`, `superSignal` (if available), and a coherent `signal`.

- **Server compute pipeline (authoritative)**
  - Location: `lib/screener-service.ts`
  - For each symbol:
    - fetch ticker (price/change/volume)
    - fetch klines (1m + optional 1h/4h/1d)
    - `buildEntry(...)` computes indicators and an initial `Strategy`
  - Post-step:
    - compute `SUPER_SIGNAL` for each entry (cross-asset aware)
    - run `applyCurrentCycleCoherence(...)` to recompute **Strategy + Signal** using the *same-cycle* `SUPER_SIGNAL` value

- **Client live updates (non-authoritative overlay)**
  - Price engine: `hooks/use-live-prices.ts` + `public/ticker-worker.js`
  - Derivatives intel: `hooks/use-derivatives-intel.ts` + `public/derivatives-worker.js`
  - The UI overlays live price/indicator approximations for responsiveness, but **Strategy / Super / Signal coherence is anchored to the server snapshot**.

### 2) Strategy signal generation (authoritative)

Source of truth: `lib/indicators.ts` → `computeStrategyScore(...)`.

#### 2.1 Inputs

Core indicator inputs (nullable):
- RSI: `rsi1m, rsi5m, rsi15m, rsi1h, rsi4h, rsi1d`
- Trend: `emaCross`, `macdHistogram`, `adx`
- Mean reversion / structure: `bbPosition`, `stochK/stochD`, `williamsR`, `cci`
- Volume / price context: `vwapDiff`, `volumeSpike`, `obvTrend`
- Intelligence fields: `confluence`, `rsiDivergence`, `hiddenDivergence`, `smartMoneyScore`, `regime`, `tradingStyle`
- Cross-validation: `superSignalScore` (normalized to \([-100..100]\))

#### 2.2 Asset-specific RSI zones

From `lib/defaults.ts` (`RSI_ZONES`), per market:
- **Crypto**: deepOS=20, OS=30, OB=70, deepOB=80
- **Forex**: deepOS=25, OS=35, OB=65, deepOB=75
- **Metal/Index/Stocks**: deepOS=22, OS=32, OB=68, deepOB=78

Regime-aware adjustments can shift these zones (feature-flagged).

#### 2.3 Score composition (high level)

`computeStrategyScore` builds a raw score by accumulating weighted contributions:
- **RSI** per timeframe (style-weighted), using the zone thresholds above
- **MACD** histogram (ATR-normalized when ATR is available)
- **EMA cross** (trend)
- **Bollinger position**, **Stoch RSI**
- **VWAP diff**, **Volume spike**
- **Confluence**, **Divergence**, **Momentum**
- **OBV trend**, **Williams %R**, **CCI**
- **Smart Money** boost/penalty (if present)
- Optional: **Hidden divergence**

Then applies post-processing guards:
- correlation diminishing-returns (feature-flagged)
- overbought/oversold suppression logic (feature-flagged)
- evidence sufficiency guard (min factors)
- **Super Signal cross-validation** (`validateWithSuperSignal`)
- **Multi-TF RSI agreement gate** for Strong signals

Finally maps numeric score → discrete signal:
- `score >= strongThreshold` and Multi-TF RSI agreement → `strong-buy`
- `score >= actionThreshold` → `buy`
- `score <= -strongThreshold` and Multi-TF RSI agreement → `strong-sell`
- `score <= -actionThreshold` → `sell`
- else `neutral`

Thresholds come from `lib/defaults.ts` (`STRATEGY_DEFAULTS`): strong=60, action=25.

### 3) Signal column (RSI extreme) coherence rule

Source of truth: `lib/indicators.ts` → `deriveCoherentSignal(strategySignal, rsi, overbought, oversold)`

- Compute RSI extreme: `deriveSignal(rsi, overbought, oversold)` → `oversold | overbought | neutral`
- Gate it by strategy intent:
  - Strategy is **buy** ⇒ show **oversold only**, otherwise neutral
  - Strategy is **sell** ⇒ show **overbought only**, otherwise neutral
  - Strategy is **neutral** ⇒ show raw RSI extreme

This prevents `Signal` from contradicting `Strategy`.

### 4) Super Signal → Strategy same-snapshot coherence

After `SUPER_SIGNAL` is computed, the server calls:
- `applyCurrentCycleCoherence(entry, ...)`

This recomputes `Strategy` and `Signal` using:
- current-cycle indicator snapshot
- **current-cycle** normalized `superSignalScore = (superSignal.value - 50) * 2`

This removes lag/circular dependency across refresh cycles.

### 5) Final Action resolver (single execution truth)

UI source: `components/screener-dashboard.tsx`

Resolver:
- If `superSignal.status === 'ok'` and `superSignal.confidence >= 60`:
  - `finalSignal = map(superSignal.category)`
  - `finalScore ≈ (superSignal.value - 50) * 2`
- Else:
  - `finalSignal = strategySignal`
  - `finalScore = strategyScore`

Filters and sorting are wired to `finalSignal/finalScore` to make decisions deterministic and conflict-free.

