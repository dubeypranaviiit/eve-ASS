import { z } from 'zod';

export const createBookingSchema = z.object({
  centreId: z.string().uuid('Invalid centre ID format'),
  testId: z.string().uuid('Invalid test ID format'),
  appointmentAt: z
    .string()
    .datetime({ message: 'appointmentAt must be a valid ISO 8601 timestamp' })
    .refine(
      (val) => new Date(val).getTime() > Date.now(),
      { message: 'Appointment date must be in the future' }
    )
});

export const bookingIdParamSchema = z.object({
  id: z.string().uuid('Invalid booking ID format')
});

export const listBookingsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED']).optional()
});
