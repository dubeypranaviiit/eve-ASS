import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@eve.health';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existing) {
    const passwordHash = await argon2.hash(adminPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    });

    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: 'ADMIN'
      }
    });

    console.log(`Initial admin account created: ${adminEmail}`);
  }
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
