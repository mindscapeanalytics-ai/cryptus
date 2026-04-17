import { prisma } from './prisma';

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
  globalUseRsi: boolean;
  globalUseMacd: boolean;
  globalUseBb: boolean;
  globalUseStoch: boolean;
  globalUseEma: boolean;
  globalUseVwap: boolean;
  globalUseConfluence: boolean;
  globalUseDivergence: boolean;
  globalUseMomentum: boolean;
  visibleColumns: string[];
  refreshInterval: number;
  pairCount: number;
  smartMode: boolean;
  showHeader: boolean;
  rsiPeriod: number;
  soundEnabled: boolean;
  watchlist: string[];
}

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  try {
    const prefs = await (prisma as any).userPreference.findUnique({
      where: { userId },
    });
    return prefs as UserPreferences | null;
  } catch (err) {
    console.error('[user-preferences] Failed to fetch:', err);
    return null;
  }
}

export async function updateUserPreferences(userId: string, data: Partial<UserPreferences>) {
  try {
    // Remove sensitive fields from mutation
    const { userId: _, ...updateData } = data as any;
    
    // Note: Property 'userPreference' is generated from 'UserPreference' model in schema.prisma
    return await (prisma as any).userPreference.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        ...updateData,
      },
    });
  } catch (err) {
    console.error('[user-preferences] Failed to update:', err);
    throw err;
  }
}
