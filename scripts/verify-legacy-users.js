const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

async function main() {
  console.log('Starting legacy users verification via standard pg...');
  
  const connectionString = (process.env.DATABASE_URL || "").trim();
  if (!connectionString) {
      console.error("No DATABASE_URL found.");
      return;
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query(`UPDATE "user" SET "emailVerified" = true WHERE "emailVerified" = false`);
    console.log(`Successfully verified ${res.rowCount} legacy users.`);
  } catch (error) {
    console.error('Error executing update:', error);
  } finally {
    await pool.end();
  }
}

main();
