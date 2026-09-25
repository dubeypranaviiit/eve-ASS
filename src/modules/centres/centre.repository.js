import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export class CentreRepository {
  static async create(data, db = prisma) {
    return db.diagnosticCentre.create({
      data: {
        name: data.name,
        location: data.location
      }
    });
  }

  static async findById(id, db = prisma) {
    return db.diagnosticCentre.findUnique({
      where: { id },
      include: {
        centreTests: {
          include: {
            test: true
          }
        }
      }
    });
  }

  static async findManyWithTests(skip = 0, take = 20, db = prisma) {
    return db.diagnosticCentre.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        centreTests: {
          include: {
            test: true
          }
        }
      }
    });
  }

  static async count(db = prisma) {
    return db.diagnosticCentre.count();
  }

  static async findCentreTest(centreId, testId, db = prisma) {
    return db.centreTest.findUnique({
      where: {
        centreId_testId: {
          centreId,
          testId
        }
      },
      include: {
        centre: true,
        test: true
      }
    });
  }

  static async createCentreTest(data, db = prisma) {
    return db.centreTest.create({
      data: {
        centreId: data.centreId,
        testId: data.testId,
        price: new Prisma.Decimal(data.price.toFixed(2))
      },
      include: {
        test: true,
        centre: true
      }
    });
  }

  static async findTestsByCentreId(centreId, db = prisma) {
    return db.centreTest.findMany({
      where: { centreId },
      include: { test: true }
    });
  }
}
