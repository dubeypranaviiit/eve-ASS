import { prisma } from '../../db/prisma.js';

export class AuthRepository {
  static async findByEmail(email, db = prisma) {
    return db.user.findUnique({
      where: { email }
    });
  }

  static async findById(id, db = prisma) {
    return db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        createdAt: true
      }
    });
  }

  static async create(data, db = prisma) {
    return db.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash
      },
      select: {
        id: true,
        email: true,
        createdAt: true
      }
    });
  }
}
