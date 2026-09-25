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
        role: true,
        createdAt: true
      }
    });
  }

  static async create(data, db = prisma) {
    return db.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role || 'USER'
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
  }
}
