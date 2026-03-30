ALTER TABLE "coin_config" ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'medium';
ALTER TABLE "coin_config" ADD COLUMN IF NOT EXISTS "sound" TEXT DEFAULT 'default';
ALTER TABLE "coin_config" ADD COLUMN IF NOT EXISTS "quietHoursEnabled" BOOLEAN DEFAULT false;
ALTER TABLE "coin_config" ADD COLUMN IF NOT EXISTS "quietHoursStart" INTEGER DEFAULT 22;
ALTER TABLE "coin_config" ADD COLUMN IF NOT EXISTS "quietHoursEnd" INTEGER DEFAULT 8;
ALTER TABLE "alert_log" ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'medium';
CREATE TABLE IF NOT EXISTS "alert_template" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "rsi1mPeriod" INTEGER DEFAULT 14,
  "rsi5mPeriod" INTEGER DEFAULT 14,
  "rsi15mPeriod" INTEGER DEFAULT 14,
  "rsi1hPeriod" INTEGER DEFAULT 14,
  "overboughtThreshold" INTEGER DEFAULT 70,
  "oversoldThreshold" INTEGER DEFAULT 30,
  "alertOn1m" BOOLEAN DEFAULT false,
  "alertOn5m" BOOLEAN DEFAULT false,
  "alertOn15m" BOOLEAN DEFAULT false,
  "alertOn1h" BOOLEAN DEFAULT false,
  "priority" TEXT DEFAULT 'medium',
  "sound" TEXT DEFAULT 'default',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "alert_template_userId_idx" ON "alert_template"("userId");
