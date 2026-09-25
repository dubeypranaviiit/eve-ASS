import { prisma } from '../../db/prisma.js';

export class TestRepository {
  static async create(data, db = prisma) {
    return db.diagnosticTest.create({
      data: {
        name: data.name,
        description: data.description
      }
    });
  }

  static async findById(id, db = prisma) {
    return db.diagnosticTest.findUnique({
      where: { id },
      include: {
        centreTests: {
          include: {
            centre: true
          }
        }
      }
    });
  }

  static async findManyWithCentres(skip = 0, take = 20, db = prisma) {
    return db.diagnosticTest.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        centreTests: {
          include: {
            centre: true
          }
        }
      }
    });
  }

  static async count(db = prisma) {
    return db.diagnosticTest.count();
  }
}
