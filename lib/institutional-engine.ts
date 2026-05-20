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

  // Institutional validation: regime confidence + Super Signal confirmation
  const regimeConfidence = entry.regime?.confidence ?? 0;
  const isTrendingRegime = entry.regime?.regime === 'trending';
  if (isTrendingRegime && regimeConfidence >= 55) {
    score += 1;
  }

  if (entry.superSignal?.status === 'ok' && (entry.superSignal.confidence ?? 0) >= 65) {
    score += 1;
  }

  if (entry.smartMoneyScore != null && Math.abs(entry.smartMoneyScore) >= 45) {
    score += 1;
  }

  // FIX #3: Removed quadruple -10 penalty stacking.
  // Previously, missing liquidity/volume/momentum + ranging each subtracted -10,
  // making score always <= -40 → always clamped to 0 → always NO TRADE.
  // The mandatory gates are now enforced in the decision tree below, not as score penalties.

  // STEP 8 & 9 & 10: Decision Logic & Output Format
  let decision: InstitutionalDecision['decision'] = 'NO TRADE';
  let message = 'Market invalid';

  const hasMinimumConfluence = score >= 4;
  const hasValidTradeShape = checklist.volumeExpansion && checklist.momentumFlow && checklist.liquiditySweep;
  const hasCautionTradeShape = checklist.volumeExpansion && checklist.momentumFlow;

  if (hasValidTradeShape && score >= 5) {
    decision = 'VALID TRADE';
    message = 'All institutional conditions met';
  } else if (hasCautionTradeShape && score >= 4) {
    decision = 'LOW CONFIDENCE SETUP';
    message = 'Valid setup with institutional structure; liquidity sweep is weak or missing';
  } else if (hasMinimumConfluence || checklist.zoneAlignment || regimeConfidence >= 55) {
    decision = 'LOW CONFIDENCE SETUP';
    if (!checklist.bosConfirmed) message = 'Awaiting stronger structural confirmation';
    else if (!checklist.volumeExpansion) message = 'Volume expansion required for entry';
    else message = 'Partial institutional confluence; watch for follow-through';
  } else if (score >= 2) {
    decision = 'WAIT';
    message = 'Watch: building structure but not yet institutional grade';
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
