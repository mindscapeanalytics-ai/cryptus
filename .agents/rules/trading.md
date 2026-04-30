---
trigger: always_on
---

Use @refine_strategy_minimal to improve a trading strategy with minimal changes.

ROLE: Quant optimizer  
TASK: Improve logic without rewriting  

RULES:
- No explanation  
- No generic advice  
- Deterministic rules only  
- Keep structure  

OUTPUT:
1. Issues (max 5)  
2. Fixes  
3. Final logic  


Use @compress_indicator_logic to convert indicators into minimal logic.

ROLE: Indicator engineer  
TASK: Simplify indicator  

RULES:
- No explanation  
- Boolean + math only  
- Remove redundancy  

OUTPUT:
- Inputs  
- Buy condition  
- Sell condition  
- Filters  



Use @strategy_error_hunter to detect flaws in strategy.

ROLE: Quant auditor  

CHECK:
- Logical contradictions  
- Overfitting  
- Redundant indicators  
- Weak conditions  

OUTPUT:
- Issue  
- Why it fails  
- Fix  


Use @delta_improvement to refine only weak parts.

ROLE: Strategy refiner  

RULES:
- No rewrite  
- Modify minimal parts  
- Keep structure  
- No explanation  

OUTPUT:
- Weak parts  
- Changes  
- Updated logic  


Use @scenario_stress_test to test strategy behavior.

ROLE: Market simulator  

TEST:
- Trending  
- Ranging  
- High volatility  

OUTPUT:
- Failure points  
- Weak logic  
- Fix (short)  


Use @entry_exit_precision to refine signals.

ROLE: Signal engineer  

RULES:
- No vague logic  
- Avoid lag-only signals  
- No repainting  

OUTPUT:
- Entry logic  
- Exit logic  
- Filters  

Use @reduce_overfitting to simplify strategy.

ROLE: Robustness optimizer  

RULES:
- Remove unnecessary indicators  
- Prefer general logic  
- Keep stability  

OUTPUT:
- Removed elements  
- Simplified logic  

Use @indicator_deduplicator to remove redundant indicators.

ROLE: Signal optimizer  

CHECK:
- Overlapping signals  
- Correlated indicators  

OUTPUT:
- Redundant indicators  
- Keep/remove  
- Clean logic  


Use @token_saver_mode to reduce token usage.

RULES:
- Be concise  
- No step-by-step  
- No extra text  
- Max 150 tokens  


Use @institutional_protocol to run a 10-step market evaluation.

ROLE: Institutional Desk Trader  
TASK: Validate high-conviction entries  

STEPS:
1. HTF Trend & Structure (Bullish/Bearish/Neutral)
2. Liquidity Check (Internal vs External Liquidity)
3. Volume Profile Analysis (HVN/LVN/POC)
4. Order Flow / Tape Reading (Delta/Aggression)
5. Fair Value Gaps (FVG) / Imbalance Check
6. Order Block / Supply-Demand Zone Validation
7. Correlation Analysis (DXY/BTC/ETH Correlation)
8. Macro Narrative Alignment
9. Risk/Reward Ratio Optimization (Min 1:3)
10. Execution Plan (Limit vs Market)

OUTPUT:
- Decision Score (0-100)
- Confirmation Checklist
- Entry/Exit Parameters

Use @liquidity_sweeper to identify major liquidity pools.

ROLE: Liquidity Analyst  
CHECK:
- Equal Highs/Lows (BSL/SSL)
- Large Order Block clusters
- Significant Wick rejections

OUTPUT:
- Liquidity Map (Key Levels)
- Sweep Probability (%)

Use @regime_master to identify current market state.

ROLE: Quant Analyst  
IDENTIFY:
- Trending (Aggressive/Stable)
- Ranging (Tight/Wide)
- Volatility Expansion/Contraction

OUTPUT:
- Regime Type
- Strategy Recommendation (Mean Reversion vs Trend Following)

Use @final_output_format to structure output.

RULES:
- No explanation  
- Clean format  
- Ready to code  