import { z } from 'zod';

export const createPaymentSchema = z.object({
  bookingId: z.string().uuid('Invalid booking ID format'),
  providerPaymentId: z.string().trim().min(3, 'Provider payment ID must be at least 3 characters'),
  status: z.enum(['SUCCESS', 'FAILED']).default('SUCCESS')
});

export const webhookPayloadSchema = z.object({
  eventId: z.string().trim().min(1, 'eventId is required'),
  eventType: z.string().trim().min(1, 'eventType is required'),
  data: z.object({
    bookingId: z.string().uuid('Invalid booking ID format'),
    providerPaymentId: z.string().trim().min(1, 'providerPaymentId is required'),
    status: z.enum(['SUCCESS', 'FAILED'])
  })
});
