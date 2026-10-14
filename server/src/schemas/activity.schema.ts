import { z } from 'zod';

export const activityQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type ActivityQuery = z.infer<typeof activityQuerySchema>;
