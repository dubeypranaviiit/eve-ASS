import express from 'express';
import { PaymentService } from './payment.service.js';
import { createPaymentSchema, webhookPayloadSchema } from './payment.schema.js';
import { authenticate } from '../../plugins/auth.js';
import { bookingIdParamSchema } from '../bookings/booking.schema.js';
import { asyncHandler } from '../../common/utils/async-handler.js';

const router = express.Router();

// Client payment endpoint (authenticated)
router.post('/payments', authenticate, asyncHandler(async (req, res) => {
  const input = createPaymentSchema.parse(req.body);
  const userId = req.user.id;
  const payment = await PaymentService.processPayment(userId, input);
  return res.status(201).json(payment);
}));

// Get payment details for booking (authenticated)
router.get('/payments/booking/:id', authenticate, asyncHandler(async (req, res) => {
  const params = bookingIdParamSchema.parse(req.params);
  const userId = req.user.id;
  const payment = await PaymentService.getPaymentByBookingId(userId, params.id);
  return res.status(200).json(payment);
}));

// Provider webhook endpoint (public / unauthenticated provider endpoint)
router.post('/payments/webhook', asyncHandler(async (req, res) => {
  const payload = webhookPayloadSchema.parse(req.body);
  const result = await PaymentService.processWebhook(payload);
  return res.status(200).json(result);
}));

export const paymentRouter = router;
