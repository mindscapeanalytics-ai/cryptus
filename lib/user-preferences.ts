import { prisma } from './prisma';
import {
  DASHBOARD_DEFAULTS,
  RSI_DEFAULTS,
  VOLATILITY_DEFAULTS,
  INDICATOR_DEFAULTS,
} from './defaults';

export interface UserPreferences {
  userId: string;
  globalThresholdsEnabled: boolean;
  globalOverbought: number;
  globalOversold: number;
  globalThresholdTimeframes: string[];
  globalVolatilityEnabled: boolean;
  globalLongCandleThreshold: number;
  globalVolumeSpikeThreshold: number;
  globalSignalThresholdMode: string;
  globalShowSignalTags: boolean;
  globalUseRsi: boolean;
  globalUseMacd: boolean;
  globalUseBb: boolean;
  globalUseStoch: boolean;
  globalUseEma: boolean;
  globalUseVwap: boolean;
  globalUseConfluence: boolean;
  globalUseDivergence: boolean;
  globalUseMomentum: boolean;
  globalUseObv: boolean;
  globalUseWilliamsR: boolean;
  globalUseCci: boolean;
  tradingStyle: 'scalping' | 'intraday' | 'swing' | 'position';
  visibleColumns: string[];
  refreshInterval: number;
  pairCount: number;
  smartMode: boolean;
  showHeader: boolean;
  rsiPeriod: number;
  soundEnabled: boolean;
  watchlist: string[];
}

const ALLOWED_TIMEFRAMES = new Set(['1m', '5m', '15m', '1h']);
const ALLOWED_TRADING_STYLES = new Set(['scalping', 'intraday', 'swing', 'position']);
const GLOBAL_DEFAULTS: Omit<UserPreferences, 'userId'> = {
  globalThresholdsEnabled: true,
  globalOverbought: RSI_DEFAULTS.overbought,
  globalOversold: RSI_DEFAULTS.oversold,
  globalThresholdTimeframes: ['1m', '5m', '15m', '1h'],
  globalVolatilityEnabled: true,
  globalLongCandleThreshold: VOLATILITY_DEFAULTS.longCandleThreshold,
  globalVolumeSpikeThreshold: VOLATILITY_DEFAULTS.volumeSpikeThreshold,
  globalSignalThresholdMode: 'custom',
  globalShowSignalTags: true,
  globalUseRsi: INDICATOR_DEFAULTS.rsi,
  globalUseMacd: INDICATOR_DEFAULTS.macd,
  globalUseBb: INDICATOR_DEFAULTS.bb,
  globalUseStoch: INDICATOR_DEFAULTS.stoch,
  globalUseEma: INDICATOR_DEFAULTS.ema,
  globalUseVwap: INDICATOR_DEFAULTS.vwap,
  globalUseConfluence: INDICATOR_DEFAULTS.confluence,
  globalUseDivergence: INDICATOR_DEFAULTS.divergence,
  globalUseMomentum: INDICATOR_DEFAULTS.momentum,
  globalUseObv: INDICATOR_DEFAULTS.obv,
  globalUseWilliamsR: INDICATOR_DEFAULTS.williamsR,
  globalUseCci: INDICATOR_DEFAULTS.cci,
  tradingStyle: DASHBOARD_DEFAULTS.tradingStyle,
  visibleColumns: [...DASHBOARD_DEFAULTS.visibleColumns],
  refreshInterval: DASHBOARD_DEFAULTS.refreshInterval,
  pairCount: DASHBOARD_DEFAULTS.pairCount,
  smartMode: DASHBOARD_DEFAULTS.smartMode,
  showHeader: DASHBOARD_DEFAULTS.showHeader,
  rsiPeriod: RSI_DEFAULTS.period,
  soundEnabled: DASHBOARD_DEFAULTS.soundEnabled,
  watchlist: [],
};

function normalizePreferencesInput(data: Partial<UserPreferences>): Partial<UserPreferences> {
  const { userId: _userId, ...input } = data as any;
  const out: any = { ...input };

  if (out.globalOverbought !== undefined) {
    out.globalOverbought = Math.max(50, Math.min(95, Number(out.globalOverbought)));
  }
  if (out.globalOversold !== undefined) {
    out.globalOversold = Math.max(5, Math.min(50, Number(out.globalOversold)));
  }
  if (out.globalOverbought !== undefined && out.globalOversold !== undefined && out.globalOverbought <= out.globalOversold) {
    out.globalOverbought = RSI_DEFAULTS.overbought;
    out.globalOversold = RSI_DEFAULTS.oversold;
  }
  if (out.globalThresholdTimeframes !== undefined) {
    const next = Array.isArray(out.globalThresholdTimeframes)
      ? out.globalThresholdTimeframes.filter((tf: unknown): tf is string => typeof tf === 'string' && ALLOWED_TIMEFRAMES.has(tf))
      : [];
    out.globalThresholdTimeframes = next.length > 0 ? next : [...GLOBAL_DEFAULTS.globalThresholdTimeframes];
  }
  if (out.globalLongCandleThreshold !== undefined) {
    out.globalLongCandleThreshold = Math.max(1.2, Math.min(8, Number(out.globalLongCandleThreshold)));
  }
  if (out.globalVolumeSpikeThreshold !== undefined) {
    out.globalVolumeSpikeThreshold = Math.max(1.2, Math.min(10, Number(out.globalVolumeSpikeThreshold)));
  }
  if (out.globalSignalThresholdMode !== undefined) {
    out.globalSignalThresholdMode = out.globalSignalThresholdMode === 'default' ? 'default' : 'custom';
  }
  if (out.refreshInterval !== undefined) {
    out.refreshInterval = Math.max(5, Math.min(300, Number(out.refreshInterval)));
  }
  if (out.pairCount !== undefined) {
    out.pairCount = Math.max(20, Math.min(500, Number(out.pairCount)));
  }
  if (out.rsiPeriod !== undefined) {
    out.rsiPeriod = Math.max(2, Math.min(50, Number(out.rsiPeriod)));
  }
  if (out.tradingStyle !== undefined) {
    out.tradingStyle = ALLOWED_TRADING_STYLES.has(out.tradingStyle) ? out.tradingStyle : GLOBAL_DEFAULTS.tradingStyle;
  }
  if (out.visibleColumns !== undefined) {
    out.visibleColumns = Array.isArray(out.visibleColumns)
      ? out.visibleColumns.filter((c: unknown): c is string => typeof c === 'string' && c.length > 0)
      : [...GLOBAL_DEFAULTS.visibleColumns];
  }
  if (out.watchlist !== undefined) {
    out.watchlist = Array.isArray(out.watchlist)
      ? out.watchlist.filter((s: unknown): s is string => typeof s === 'string' && s.length > 0)
      : [];
  }

  return out;
}

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  try {
    const prefs = await (prisma as any).userPreference.findUnique({
      where: { userId },
    });
    if (!prefs) return null;
    // Merge DB values on top of institutional defaults to avoid partial/missing records
    return normalizePreferencesInput({
      userId,
      ...GLOBAL_DEFAULTS,
      ...prefs,
    }) as UserPreferences;
  } catch (err) {
    console.error('[user-preferences] Failed to fetch:', err);
    return null;
  }
}

export async function updateUserPreferences(userId: string, data: Partial<UserPreferences>) {
  try {
    const updateData = normalizePreferencesInput(data);
    
    // Note: Property 'userPreference' is generated from 'UserPreference' model in schema.prisma
    return await (prisma as any).userPreference.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        ...GLOBAL_DEFAULTS,
        ...updateData,
      },
    });
  } catch (err) {
    console.error('[user-preferences] Failed to update:', err);
    throw err;
  }
}
