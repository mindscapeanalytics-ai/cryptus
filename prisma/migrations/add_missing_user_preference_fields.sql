-- Migration: Add missing user preference fields and fix defaults
-- Date: 2026-04-26
-- Purpose: Fix gaps identified in default settings analysis

-- Add missing indicator fields
ALTER TABLE "user_preference"
ADD COLUMN IF NOT EXISTS "globalUseObv" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "globalUseWilliamsR" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "globalUseCci" BOOLEAN DEFAULT true;

-- Add missing UI preference fields
ALTER TABLE "user_preference"
ADD COLUMN IF NOT EXISTS "globalShowSignalTags" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "tradingStyle" TEXT DEFAULT 'intraday';

-- Update feature flags to optimal defaults
UPDATE "feature_flag"
SET 
  "allowTrialAdvancedIndicators" = true,
  "allowTrialAlerts" = true,
  "updatedAt" = NOW()
WHERE "id" = 'global';

-- Update existing user preferences with optimal default columns
-- Only update users who have the minimal default (2 columns or less)
UPDATE "user_preference"
SET 
  "visibleColumns" = ARRAY[
    'rank', 'winRate', 'rsi15m', 'emaCross', 'macdHistogram', 'stochK',
    'vwapDiff', 'confluence', 'divergence', 'momentum', 'adx',
    'longCandle', 'volumeSpike', 'fundingRate', 'orderFlow', 'smartMoney', 'strategy'
  ],
  "updatedAt" = NOW()
WHERE array_length("visibleColumns", 1) IS NULL 
   OR array_length("visibleColumns", 1) <= 2;

-- Ensure all existing users have the new indicator fields set to true
UPDATE "user_preference"
SET 
  "globalUseObv" = COALESCE("globalUseObv", true),
  "globalUseWilliamsR" = COALESCE("globalUseWilliamsR", true),
  "globalUseCci" = COALESCE("globalUseCci", true),
  "globalShowSignalTags" = COALESCE("globalShowSignalTags", true),
  "tradingStyle" = COALESCE("tradingStyle", 'intraday'),
  "updatedAt" = NOW();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "user_preference_tradingStyle_idx" ON "user_preference"("tradingStyle");

-- Verify migration
DO $$
DECLARE
  missing_columns TEXT[];
BEGIN
  SELECT ARRAY_AGG(column_name)
  INTO missing_columns
  FROM (
    SELECT unnest(ARRAY['globalUseObv', 'globalUseWilliamsR', 'globalUseCci', 'globalShowSignalTags', 'tradingStyle']) AS column_name
  ) expected
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'user_preference'
      AND column_name = expected.column_name
  );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'Migration failed: Missing columns: %', array_to_string(missing_columns, ', ');
  END IF;

  RAISE NOTICE 'Migration completed successfully. All required columns exist.';
END $$;
