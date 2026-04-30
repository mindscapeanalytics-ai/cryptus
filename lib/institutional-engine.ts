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
  let state: InstitutionalDecision['state'] = 'RANGING';
  const adx = entry.adx ?? 0;
  if (adx > 25) {
    state = 'TRENDING';
  } else if (adx > 18) {
    state = 'TRANSITION';
  } else {
    state = 'RANGING';
  }

  // STEP 2 & 3: Zone Detection & Liquidity Analysis (Mandatory)
  const isNearFvg = !!entry.smc?.fvg;
  const isNearOb = !!entry.smc?.orderBlock;
  checklist.zoneAlignment = isNearFvg || isNearOb;

  // Assuming price testing near an OB or extreme RSI divergence indicates a potential sweep or trap
  checklist.liquiditySweep = !!entry.rsiDivergence || !!entry.rsiDivergenceCustom || (isNearOb && !!entry.volumeSpike);

  // STEP 4: Momentum & Flow Validation
  const smartMoneyScore = Math.abs(entry.smartMoneyScore ?? 0);
  checklist.momentumFlow = smartMoneyScore > 30 || !!entry.obvTrend || (entry.macdHistogram !== null && Math.abs(entry.macdHistogram) > 0.5);

  // STEP 5: Confirmation (Critical)
  checklist.bosConfirmed = checklist.zoneAlignment && checklist.momentumFlow && !!entry.emaCross;

  // STEP 6: Indicator Context (Secondary)
  const hasIndicatorSupport = entry.confluence !== undefined && Math.abs(entry.confluence) > 30;

  // STEP 7: Scoring System
  if (checklist.liquiditySweep) score += 2;
  if (checklist.bosConfirmed) score += 2;
  if (entry.volumeSpike) {
    checklist.volumeExpansion = true;
    score += 2;
  } else {
    score -= 2; // No volume
  }
  if (checklist.zoneAlignment) score += 1;
  if (hasIndicatorSupport) score += 1;

  if (!checklist.momentumFlow) score -= 2;
  if (state === 'RANGING') score -= 2;

  // STEP 8 & 9 & 10: Decision Logic & Output Format
  let decision: InstitutionalDecision['decision'] = 'NO TRADE';
  let message = 'Market invalid';

  if (!checklist.liquiditySweep) {
    decision = 'WAIT';
    message = 'WAIT - Awaiting liquidity sweep';
  } else if (!checklist.bosConfirmed) {
    decision = 'WAIT';
    message = 'WAIT - No BOS/Displacement confirmation';
  } else if (!checklist.momentumFlow) {
    decision = 'NO TRADE';
    message = 'NO TRADE - Weak momentum/order flow';
  } else {
    if (score >= 6) {
      decision = 'VALID TRADE';
      message = 'VALID TRADE - All institutional conditions met';
    } else if (score >= 3) {
      decision = 'LOW CONFIDENCE SETUP';
      message = 'LOW CONFIDENCE SETUP - Not recommended due to low score';
    } else {
      decision = 'NO TRADE';
      message = 'NO TRADE - Setup scored too low';
    }
  }

  return { state, decision, score, message, checklist };
}
