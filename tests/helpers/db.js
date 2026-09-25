import { prisma } from '../../src/db/prisma.js';

export async function clearDatabase() {
  await prisma.paymentWebhookEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.centreTest.deleteMany();
  await prisma.diagnosticCentre.deleteMany();
  await prisma.diagnosticTest.deleteMany();
  await prisma.user.deleteMany();
}
