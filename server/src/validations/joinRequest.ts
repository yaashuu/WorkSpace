import { z } from 'zod';

export const reviewJoinRequestSchema = z.object({
  rejectionReason: z
    .string()
    .trim()
    .max(300, 'Rejection reason cannot exceed 300 characters')
    .optional()
    .nullable(),
});

export type ReviewJoinRequestInput = z.infer<typeof reviewJoinRequestSchema>;
