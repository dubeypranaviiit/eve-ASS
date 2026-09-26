import { prisma } from '../../src/db/prisma.js';
import { hashPassword } from '../../src/common/security/password.js';
import { signAccessToken } from '../../src/common/security/jwt.js';

export async function clearDatabase() {
  await prisma.paymentWebhookEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.centreTest.deleteMany();
  await prisma.diagnosticCentre.deleteMany();
  await prisma.diagnosticTest.deleteMany();
  await prisma.user.deleteMany();
}

export async function createTestAdmin(email = 'admin-test@example.com', password = 'password123') {
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'ADMIN'
    }
  });

  const accessToken = await signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role
  });

  return { user, accessToken };
}
