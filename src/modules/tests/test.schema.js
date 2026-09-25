import { z } from 'zod';

export const createTestSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  description: z.string().trim().min(2, 'Description must be at least 2 characters')
});

export const testIdParamSchema = z.object({
  id: z.string().uuid('Invalid test ID format')
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});
