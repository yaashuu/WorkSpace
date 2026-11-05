import { z } from 'zod';

export const registerSchema = z.object({
  email: z
    .string({ message: 'Email is required' })
    .email('Please provide a valid email address')
    .trim()
    .toLowerCase()
    .max(255, 'Email cannot exceed 255 characters'),
  password: z
    .string({ message: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  fullName: z
    .string({ message: 'Full name is required' })
    .trim()
    .min(2, 'Full name must be at least 2 characters long')
    .max(100, 'Full name must be at most 100 characters long'),
  avatarUrl: z
    .string()
    .url('Avatar URL must be a valid URL')
    .refine((url) => /^https?:\/\//i.test(url), {
      message: 'Avatar URL must use http or https protocol',
    })
    .max(2048, 'Avatar URL cannot exceed 2048 characters')
    .optional()
    .nullable(),
});

export const loginSchema = z.object({
  email: z
    .string({ message: 'Email is required' })
    .email('Please provide a valid email address')
    .trim()
    .toLowerCase()
    .max(255, 'Email cannot exceed 255 characters'),
  password: z
    .string({ message: 'Password is required' })
    .min(1, 'Password is required')
    .max(128, 'Password cannot exceed 128 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
