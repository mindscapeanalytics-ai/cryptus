import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Starting verification of legacy users...');

  try {
    const usersToVerify = await prisma.user.findMany({
      where: {
        emailVerified: false
      }
    });

    console.log(`Found ${usersToVerify.length} users with unverified emails.`);

    if (usersToVerify.length === 0) {
      console.log('No users to update.');
      return;
    }

    const result = await prisma.user.updateMany({
      where: {
        emailVerified: false
      },
      data: {
        emailVerified: true
      }
    });

    console.log(`Successfully verified ${result.count} legacy users.`);
  } catch (error) {
    console.error('Error verifying users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
