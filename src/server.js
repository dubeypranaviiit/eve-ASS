import { buildApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';

async function start() {
  const app = buildApp();

  try {
    await prisma.$connect();
    console.log('Connected to PostgreSQL database via Prisma');

    const server = app.listen(env.PORT, '0.0.0.0', () => {
      console.log(`Server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });

    const shutdown = async (signal) => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('Failed to start server:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

start();
