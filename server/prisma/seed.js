import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  console.log(`Seed complete. Existing users: ${userCount}`);
  console.log('No login accounts are created by the seed.');
  console.log('Open the app and use Sign Up to create the first Head Manager account.');
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(async () => prisma.$disconnect());
