import { z } from 'zod';

export const sendMessageSchema = z.object({
  content: z
    .string({ message: 'Message content is required' })
    .trim()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message cannot exceed 5000 characters'),
});

export const getMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  before: z.string().datetime({ message: 'before must be a valid ISO 8601 string' }).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type GetMessagesQueryInput = z.infer<typeof getMessagesQuerySchema>;
