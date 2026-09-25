import { z } from 'zod';

export const createCentreSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  location: z.string().trim().min(2, 'Location must be at least 2 characters')
});

export const centreIdParamSchema = z.object({
  id: z.string().uuid('Invalid centre ID format')
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const addCentreTestSchema = z.object({
  testId: z.string().uuid('Invalid test ID format'),
  price: z.coerce
    .number()
    .positive('Price must be greater than 0')
    .refine((val) => Number(val.toFixed(2)) === val, {
      message: 'Price must have at most 2 decimal places'
    })
});

export const centreTestParamsSchema = z.object({
  centreId: z.string().uuid('Invalid centre ID format'),
  testId: z.string().uuid('Invalid test ID format')
});
