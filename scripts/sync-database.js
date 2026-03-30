#!/usr/bin/env node

/**
 * Database Sync Script
 * 
 * Ensures the database schema is in sync with Prisma schema.
 * Run this after pulling schema changes or before deployment.
 * 
 * Usage:
 *   node scripts/sync-database.js [--force]
 * 
 * Options:
 *   --force    Accept data loss warnings (use with caution)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FORCE = process.argv.includes('--force');
const SCHEMA_PATH = path.join(__dirname, '..', 'prisma', 'schema.prisma');

console.log('🔍 Database Sync Script');
console.log('━'.repeat(50));

// Check if schema file exists
if (!fs.existsSync(SCHEMA_PATH)) {
  console.error('❌ Prisma schema not found at:', SCHEMA_PATH);
  process.exit(1);
}

console.log('✅ Prisma schema found');

// Step 1: Check migration status
console.log('\n📊 Checking migration status...');
try {
  const status = execSync('npx prisma migrate status', { 
    encoding: 'utf-8',
    stdio: 'pipe'
  });
  console.log(status);
} catch (error) {
  console.warn('⚠️  Migration status check failed (this is OK for db push workflow)');
}

// Step 2: Sync database schema
console.log('\n🔄 Syncing database schema...');
try {
  const pushCmd = FORCE 
    ? 'npx prisma db push --accept-data-loss'
    : 'npx prisma db push';
  
  const result = execSync(pushCmd, { 
    encoding: 'utf-8',
    stdio: 'inherit'
  });
  
  console.log('✅ Database schema synced successfully');
} catch (error) {
  console.error('❌ Failed to sync database schema');
  console.error(error.message);
  process.exit(1);
}

// Step 3: Regenerate Prisma Client
console.log('\n🔨 Regenerating Prisma Client...');
try {
  execSync('npx prisma generate', { 
    encoding: 'utf-8',
    stdio: 'inherit'
  });
  
  console.log('✅ Prisma Client regenerated successfully');
} catch (error) {
  console.error('❌ Failed to regenerate Prisma Client');
  console.error(error.message);
  process.exit(1);
}

// Step 4: Verify
console.log('\n✨ Database sync complete!');
console.log('━'.repeat(50));
console.log('\n📋 Next steps:');
console.log('  1. Restart your development server');
console.log('  2. Test database operations');
console.log('  3. Check application logs for errors');
console.log('\n💡 Tip: Run this script after pulling schema changes');

process.exit(0);
