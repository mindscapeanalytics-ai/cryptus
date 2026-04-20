const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const dotenv = require("dotenv");

// Load .env file
dotenv.config();

function createPrismaClient() {
  const connectionString = (process.env.DATABASE_URL || "").trim();
  
  if (!connectionString) {
    console.error("DATABASE_URL is not defined in .env");
    process.exit(1);
  }

  const pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000,
    idleTimeoutMillis: 30000,
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

async function main() {
  console.log("🚀 Starting database cleanup (Users, Sessions, Accounts)...");
  try {
    // Truncate cascade is best
    const email = "zalizeeshan2@gmail.com";
    
    // We'll clear everything to be safe since you asked to "clear all users"
    await prisma.$transaction([
      prisma.session.deleteMany(),
      prisma.account.deleteMany(),
      prisma.subscription.deleteMany(),
      prisma.user.deleteMany(),
    ]);
    
    console.log("✅ Successfully purged User table and all related associations.");
  } catch (error) {
    console.error("❌ Error clearing database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
