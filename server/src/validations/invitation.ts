import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createInvitationSchema = z.object({
  projectId: z
    .string({ message: 'projectId is required' })
    .regex(objectIdRegex, 'projectId must be a valid MongoDB ObjectId'),
  invitedEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address')
    .optional()
    .nullable(),
  maxUses: z
    .number()
    .int('maxUses must be an integer')
    .min(1, 'maxUses must be at least 1')
    .max(1000, 'maxUses cannot exceed 1000')
    .optional()
    .default(1),
  expiresInDays: z
    .number()
    .int('expiresInDays must be an integer')
    .min(1, 'expiresInDays must be at least 1')
    .max(30, 'expiresInDays cannot exceed 30')
    .optional()
    .default(7),
});

export const acceptInvitationSchema = z.object({
  token: z
    .string({ message: 'Invitation token is required' })
    .trim()
    .min(1, 'Invitation token cannot be empty'),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
