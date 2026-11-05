import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createProjectSchema = z.object({
  name: z
    .string({ message: 'Project name is required' })
    .trim()
    .min(2, 'Project name must be at least 2 characters')
    .max(100, 'Project name must be at most 100 characters'),
  key: z
    .string({ message: 'Project key is required' })
    .trim()
    .toUpperCase()
    .min(2, 'Project key must be at least 2 characters')
    .max(10, 'Project key must be at most 10 characters')
    .regex(/^[A-Z0-9]+$/, 'Project key must contain only uppercase alphanumeric characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be at most 500 characters')
    .optional()
    .default(''),
  primaryManagerId: z
    .string({ message: 'primaryManagerId is required' })
    .regex(objectIdRegex, 'primaryManagerId must be a valid MongoDB ObjectId'),
});

export const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Project name must be at least 2 characters')
      .max(100, 'Project name must be at most 100 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, 'Description must be at most 500 characters')
      .optional(),
    status: z
      .enum(['ACTIVE', 'ARCHIVED'], {
        message: 'Status must be ACTIVE or ARCHIVED',
      })
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const updateVisibilitySchema = z.object({
  visibility: z.enum(['PUBLIC', 'PRIVATE'], {
    message: 'Visibility must be either PUBLIC or PRIVATE',
  }),
});

export const assignManagerSchema = z.object({
  primaryManagerId: z
    .string({ message: 'primaryManagerId is required' })
    .regex(objectIdRegex, 'primaryManagerId must be a valid MongoDB ObjectId'),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type UpdateVisibilityInput = z.infer<typeof updateVisibilitySchema>;
export type AssignManagerInput = z.infer<typeof assignManagerSchema>;
