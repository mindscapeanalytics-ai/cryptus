import type { ScreenerEntry } from './types';

export interface InstitutionalDecision {
  state: 'TRENDING' | 'RANGING' | 'TRANSITION';
  decision: 'NO TRADE' | 'WAIT' | 'LOW CONFIDENCE SETUP' | 'VALID TRADE';
  score: number;
  message: string;
  checklist: {
    liquiditySweep: boolean;
    bosConfirmed: boolean;
    volumeExpansion: boolean;
    zoneAlignment: boolean;
    momentumFlow: boolean;
  };
}

export function evaluateInstitutionalProtocol(entry: ScreenerEntry): InstitutionalDecision {
  let score = 0;
  const checklist = {
    liquiditySweep: false,
    bosConfirmed: false,
    volumeExpansion: false,
    zoneAlignment: false,
    momentumFlow: false,
  };

  // STEP 1: Market State Classification
  const state: InstitutionalDecision['state'] = entry.regime?.regime === 'trending' ? 'TRENDING' : entry.regime?.regime === 'ranging' ? 'RANGING' : 'TRANSITION';
  if (state === 'RANGING') score -= 2;

  // STEP 2: Zone Detection (BB extremes or VWAP deviation)
  const zoneAligned = (entry.bbPosition != null && (entry.bbPosition <= 0.1 || entry.bbPosition >= 0.9)) || 
                      (entry.vwapDiff != null && Math.abs(entry.vwapDiff) > 1);
  if (zoneAligned) { 
    score += 1; 
    checklist.zoneAlignment = true; 
  }

  // STEP 3: Liquidity Analysis
  // FIX #4: Read from canonical entry.liquidity?.sweep (populated by detectLiquiditySweeps in buildEntry)
  const sweep = entry.liquidity?.sweep ?? 'none';
  if (sweep !== 'none') {
    score += 2;
    checklist.liquiditySweep = true;
  }

  // STEP 4: Momentum & Flow Validation
  if (entry.volumeSpike) {
    score += 2;
    checklist.volumeExpansion = true;
  } else {
    score -= 1; // Mild penalty, not -2 (avoids over-penalizing low-vol sessions)
  }

  const isMomentumWeak = Math.abs(entry.momentum || 0) < 0.5 && entry.obvTrend === 'none';
  if (isMomentumWeak) {
    score -= 1;
  } else {
    checklist.momentumFlow = true;
    score += 1;
  }

  // STEP 5: Trend Confirmation (EMA cross + volume + momentum as BOS proxy)
  // FIX #5: This is a structural trend confirmation, not literal Break-of-Structure.
  // The checklist label "BOS Confirmed" is kept for UI backward compatibility.
  const trendConfirmed = (entry.emaCross !== 'none' && entry.volumeSpike && !isMomentumWeak);
  if (trendConfirmed) {
    score += 2;
    checklist.bosConfirmed = true;
  }

  // STEP 6: Indicator Context (Secondary)
  let indScore = 0;
  if (entry.macdHistogram != null && Math.abs(entry.macdHistogram) > 0) indScore++;
  if (entry.vwapDiff != null && Math.abs(entry.vwapDiff) > 1) indScore++;
  if (entry.smartMoneyScore != null && Math.abs(entry.smartMoneyScore) > 30) indScore++;
  if (entry.adx != null && entry.adx > 25) indScore++;
  if (indScore >= 2) {
    score += 1;
  }

  // FIX #3: Removed quadruple -10 penalty stacking.
  // Previously, missing liquidity/volume/momentum + ranging each subtracted -10,
  // making score always <= -40 → always clamped to 0 → always NO TRADE.
  // The mandatory gates are now enforced in the decision tree below, not as score penalties.

  // STEP 8 & 9 & 10: Decision Logic & Output Format
  let decision: InstitutionalDecision['decision'] = 'NO TRADE';
  let message = 'Market invalid';

  // VALID TRADE requires all three mandatory gates
  if (score >= 4 && checklist.volumeExpansion && checklist.momentumFlow) {
    if (checklist.liquiditySweep) {
      decision = 'VALID TRADE';
      message = 'All institutional conditions met';
    } else {
      // Strong setup but no sweep — still actionable with caution
      decision = 'LOW CONFIDENCE SETUP';
      message = 'Setup valid but no liquidity sweep detected';
    }
  } else if (score >= 2 || checklist.zoneAlignment) {
    decision = 'LOW CONFIDENCE SETUP';
    if (!checklist.bosConfirmed) message = 'Awaiting trend confirmation';
    else if (!checklist.volumeExpansion) message = 'Volume expansion required';
    else message = 'Partial confluence — monitor for completion';
  } else {
    if (state === 'RANGING') message = 'Ranging market — no institutional edge';
    else if (isMomentumWeak) message = 'Weak momentum — no directional flow';
    else message = 'Insufficient confluence for entry';
  }

  return { 
    state, 
    decision, 
    score: Math.max(0, score), 
    message, 
    checklist 
  };
}
