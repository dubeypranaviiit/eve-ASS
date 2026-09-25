import { prisma } from '../../db/prisma.js';

export class PaymentRepository {
  static async create(data, db = prisma) {
    return db.payment.create({
      data
    });
  }

  static async findById(id, db = prisma) {
    return db.payment.findUnique({
      where: { id }
    });
  }

  static async findByBookingId(bookingId, db = prisma) {
    return db.payment.findUnique({
      where: { bookingId }
    });
  }

  static async findByProviderPaymentId(providerPaymentId, db = prisma) {
    return db.payment.findUnique({
      where: { providerPaymentId }
    });
  }

  static async createWebhookEvent(data, db = prisma) {
    return db.paymentWebhookEvent.create({
      data
    });
  }

  static async findWebhookEventByProviderId(providerEventId, db = prisma) {
    return db.paymentWebhookEvent.findUnique({
      where: { providerEventId }
    });
  }
}
