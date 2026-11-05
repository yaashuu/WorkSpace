import { z } from 'zod';

export const createCommentSchema = z.object({
  content: z
    .string({ message: 'Comment content is required' })
    .trim()
    .min(1, 'Comment content cannot be empty')
    .max(2000, 'Comment content cannot exceed 2000 characters'),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
