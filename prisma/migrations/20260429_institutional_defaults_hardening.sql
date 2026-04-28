-- Institutional defaults hardening for UserPreference
-- Ensures first-run users and partially populated rows start with robust defaults.

ALTER TABLE "user_preference"
  ALTER COLUMN "globalThresholdsEnabled" SET DEFAULT true,
  ALTER COLUMN "globalVolatilityEnabled" SET DEFAULT true,
  ALTER COLUMN "globalSignalThresholdMode" SET DEFAULT 'custom',
  ALTER COLUMN "visibleColumns" SET DEFAULT ARRAY[
    'rank','winRate','rsi15m','emaCross','macdHistogram','stochK','vwapDiff',
    'confluence','divergence','momentum','adx','longCandle','volumeSpike',
    'fundingRate','orderFlow','smartMoney','finalAction','superSignal','strategy'
  ]::text[];

-- Backfill existing rows with null-ish weak defaults.
UPDATE "user_preference"
SET
  "globalThresholdsEnabled" = true
WHERE "globalThresholdsEnabled" IS DISTINCT FROM true;

UPDATE "user_preference"
SET
  "globalVolatilityEnabled" = true
WHERE "globalVolatilityEnabled" IS DISTINCT FROM true;

UPDATE "user_preference"
SET
  "globalSignalThresholdMode" = 'custom'
WHERE "globalSignalThresholdMode" IS NULL OR "globalSignalThresholdMode" NOT IN ('default', 'custom');
