import { z } from 'zod';

export const listActivityLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  page: z.coerce.number().int().min(1).max(10000, 'Page cannot exceed 10000').optional().default(1),
  entityType: z.enum(['PROJECT', 'TASK', 'MEMBERSHIP', 'INVITATION']).optional(),
});

export type ListActivityLogsQueryInput = z.infer<typeof listActivityLogsQuerySchema>;
