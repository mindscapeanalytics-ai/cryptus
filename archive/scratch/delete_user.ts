import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const email = "zalizeeshan2@gmail.com";
  try {
    const deleted = await prisma.user.deleteMany({
      where: { email }
    });
    console.log(`Successfully deleted ${deleted.count} user(s) with email: ${email}`);
  } catch (error) {
    console.error("Error deleting user:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
