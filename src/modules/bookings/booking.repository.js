import { prisma } from '../../db/prisma.js';

export class BookingRepository {
  static async create(data, db = prisma) {
    return db.booking.create({
      data: {
        userId: data.userId,
        centreId: data.centreId,
        testId: data.testId,
        appointmentAt: data.appointmentAt,
        amount: data.amount,
        status: data.status || 'PENDING'
      },
      include: {
        centre: true,
        test: true
      }
    });
  }

  static async findById(id, db = prisma) {
    return db.booking.findUnique({
      where: { id },
      include: {
        centre: true,
        test: true,
        payment: true
      }
    });
  }

  static async findActiveSlot(centreId, testId, appointmentAt, db = prisma) {
    return db.booking.findFirst({
      where: {
        centreId,
        testId,
        appointmentAt,
        status: { in: ['PENDING', 'CONFIRMED'] }
      }
    });
  }

  static async findManyByUser(userId, status, skip = 0, take = 20, db = prisma) {
    const where = {
      userId,
      ...(status ? { status } : {})
    };

    return db.booking.findMany({
      where,
      skip,
      take,
      orderBy: { appointmentAt: 'desc' },
      include: {
        centre: true,
        test: true,
        payment: true
      }
    });
  }

  static async countByUser(userId, status, db = prisma) {
    const where = {
      userId,
      ...(status ? { status } : {})
    };

    return db.booking.count({ where });
  }

  static async updateStatus(id, status, db = prisma) {
    return db.booking.update({
      where: { id },
      data: { status },
      include: {
        centre: true,
        test: true
      }
    });
  }
}
