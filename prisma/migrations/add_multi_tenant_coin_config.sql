-- Safe Migration: Add multi-tenant support to coin_config
-- This migration preserves existing data by:
-- 1. Adding new columns with defaults
-- 2. Backfilling userId from the first user
-- 3. Dropping the old PK and adding the new compound unique constraint

-- Step 1: Add new columns
ALTER TABLE "coin_config" ADD COLUMN IF NOT EXISTS "id" TEXT;
ALTER TABLE "coin_config" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "coin_config" ADD COLUMN IF NOT EXISTS "exchange" TEXT DEFAULT 'binance';

-- Step 2: Generate UUIDs for existing rows
UPDATE "coin_config" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;

-- Step 3: Backfill userId from first user (single-tenant migration)
-- Replace the subquery fallback if you know the specific userId
UPDATE "coin_config" SET "userId" = (SELECT "id" FROM "user" LIMIT 1) WHERE "userId" IS NULL;

-- Step 4: Make columns NOT NULL after backfill
ALTER TABLE "coin_config" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "coin_config" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "coin_config" ALTER COLUMN "exchange" SET NOT NULL;

-- Step 5: Drop old primary key and add new one
ALTER TABLE "coin_config" DROP CONSTRAINT IF EXISTS "coin_config_pkey";
ALTER TABLE "coin_config" ADD PRIMARY KEY ("id");

-- Step 6: Add compound unique constraint and indexes
ALTER TABLE "coin_config" ADD CONSTRAINT "coin_config_userId_symbol_key" UNIQUE ("userId", "symbol");
CREATE INDEX IF NOT EXISTS "coin_config_userId_idx" ON "coin_config" ("userId");
CREATE INDEX IF NOT EXISTS "coin_config_symbol_idx" ON "coin_config" ("symbol");

-- Step 7: Add foreign key
ALTER TABLE "coin_config" ADD CONSTRAINT "coin_config_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
