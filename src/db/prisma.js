import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

export const prisma =
  global.prismaInstance ||
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
  });

if (env.NODE_ENV !== 'production') {
  global.prismaInstance = prisma;
}
