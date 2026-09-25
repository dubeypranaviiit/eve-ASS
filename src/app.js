import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { errorHandler } from './plugins/error-handler.js';
import { setupSwagger } from './plugins/swagger.js';
import { authRouter } from './modules/auth/auth.route.js';
import { centreRouter } from './modules/centres/centre.route.js';
import { testRouter } from './modules/tests/test.route.js';
import { bookingRouter } from './modules/bookings/booking.route.js';
import { paymentRouter } from './modules/payments/payment.route.js';

export function buildApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  if (process.env.NODE_ENV !== 'test') {
    const logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie']
    });
    app.use(pinoHttp({ logger }));
  }

  setupSwagger(app);

  app.get('/health', (req, res) => {
    return res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  app.use(authRouter);
  app.use(centreRouter);
  app.use(testRouter);
  app.use(bookingRouter);
  app.use(paymentRouter);

  app.use(errorHandler);

  return app;
}
