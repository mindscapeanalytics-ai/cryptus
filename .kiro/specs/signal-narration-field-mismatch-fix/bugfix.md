# Bugfix Requirements Document

## Introduction

The signal narration system has a critical field name mismatch causing 24-hour price change context to never appear in evidence lists. The code checks for `entry.priceChange24h` but the actual field in the `ScreenerEntry` interface is named `change24h`. This results in confusing and potentially contradictory signals where headlines may say "Bullish Expansion" while the asset has crashed 40% in 24 hours, or "Institutional Sell Setup" while multiple bullish indicators are present and the 24h change is positive.

**Impact:** This affects ALL signals across the platform, undermining accuracy and user trust. Users may make incorrect trading decisions based on incomplete or contradictory information.

**Root Cause:** Field name mismatch in `lib/signal-narration.ts` (lines 100-135, 628-693) and `lib/market-regime.ts` where code references `priceChange24h` instead of the actual field name `change24h` defined in `lib/types.ts`.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the signal narration engine processes a ScreenerEntry THEN the 24h price change context block (lines 100-135 in signal-narration.ts) never executes because it checks `entry.priceChange24h` which does not exist

1.2 WHEN extreme price movements occur (>15% in 24h) THEN the system fails to add prominent evidence items describing the price action

1.3 WHEN the headline generation logic runs (lines 628-693) THEN it cannot access 24h price context for context-aware headlines because it references the wrong field name

1.4 WHEN market regime classification runs THEN it receives `priceChange24h` parameter but the calling code passes `change24h`, causing potential undefined values

1.5 WHEN a user views a signal for XATUSDT with -40.08% 24h change THEN the headline shows "Bullish Expansion — Strategy Confirmed" without any 24h context in the evidence list, creating a contradictory signal

1.6 WHEN a user views a signal for ALGOUSDT with +1.71% 24h change and bullish indicators THEN the headline shows "Institutional Sell Setup — High Confluence" with 90% conviction but no 24h context explaining the contradiction

1.7 WHEN the momentum flux calculation uses the wrong field name THEN it may produce sign contradictions between price direction and signal direction

### Expected Behavior (Correct)

2.1 WHEN the signal narration engine processes a ScreenerEntry THEN the 24h price change context block SHALL execute using `entry.change24h` and add appropriate evidence items

2.2 WHEN extreme price movements occur (>50% in 24h) THEN the system SHALL add a PARABOLIC MOVE evidence item as the first or second item with appropriate emoji (🚀 for rallies, 💥 for crashes)

2.3 WHEN strong price movements occur (30-50% in 24h) THEN the system SHALL add an EXTREME MOMENTUM evidence item with exhaustion warnings

2.4 WHEN moderate price movements occur (15-30% in 24h) THEN the system SHALL add a Strong 24h momentum evidence item with overbought/oversold risk context

2.5 WHEN the headline generation logic runs THEN it SHALL access `entry.change24h` to generate context-aware headlines that account for 24h price action

2.6 WHEN market regime classification runs with extreme price moves (>20% in 24h) THEN it SHALL correctly classify the regime as "trending" or "breakout" based on the actual `change24h` value

2.7 WHEN a user views a signal with extreme price movement THEN the headline SHALL reflect the price context (e.g., "Overbought Exhaustion After +42% Rally" instead of generic "Bullish Expansion")

2.8 WHEN all field references are corrected THEN the momentum flux calculation SHALL produce directionally consistent signals

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the 24h price change is null or undefined THEN the system SHALL CONTINUE TO skip the 24h context block without errors

3.2 WHEN the 24h price change is between -5% and +5% THEN the system SHALL CONTINUE TO either omit it or show it as low-priority evidence

3.3 WHEN other indicator evidence items are generated (RSI, EMA, MACD, etc.) THEN they SHALL CONTINUE TO function exactly as before

3.4 WHEN conviction scoring is calculated THEN it SHALL CONTINUE TO use the same algorithm with the same weights

3.5 WHEN market regime classification receives valid data THEN it SHALL CONTINUE TO classify regimes correctly for non-extreme moves

3.6 WHEN headline generation logic processes signals without extreme price moves THEN it SHALL CONTINUE TO generate appropriate headlines based on other indicators

3.7 WHEN the signal narration engine processes entries with all other fields THEN the output format, structure, and emoji usage SHALL CONTINUE TO remain unchanged
