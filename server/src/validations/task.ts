import { z } from 'zod';
import { isValidObjectId } from 'mongoose';

export const taskStatuses = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'TESTING', 'DONE'] as const;
export const taskPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export const createTaskSchema = z.object({
  title: z
    .string({ message: 'Task title is required' })
    .trim()
    .min(1, 'Task title cannot be empty')
    .max(200, 'Task title cannot exceed 200 characters'),
  description: z
    .string()
    .max(5000, 'Task description cannot exceed 5000 characters')
    .optional()
    .default(''),
  status: z.enum(taskStatuses).optional().default('BACKLOG'),
  priority: z.enum(taskPriorities).optional().default('MEDIUM'),
  assigneeId: z
    .string()
    .refine((val) => isValidObjectId(val), {
      message: 'Invalid assignee ID format',
    })
    .nullable()
    .optional(),
  dueDate: z
    .string()
    .datetime({ message: 'Due date must be a valid ISO 8601 string' })
    .nullable()
    .optional(),
});

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Task title cannot be empty')
      .max(200, 'Task title cannot exceed 200 characters')
      .optional(),
    description: z.string().max(5000, 'Task description cannot exceed 5000 characters').optional(),
    priority: z.enum(taskPriorities).optional(),
    assigneeId: z
      .string()
      .refine((val) => isValidObjectId(val), {
        message: 'Invalid assignee ID format',
      })
      .nullable()
      .optional(),
    dueDate: z
      .string()
      .datetime({ message: 'Due date must be a valid ISO 8601 string' })
      .nullable()
      .optional(),
  })
  .strict();

export const moveTaskStatusSchema = z.object({
  status: z.enum(taskStatuses).optional(),
  version: z
    .number({ message: 'Task version is required for concurrency control' })
    .int('Version must be an integer')
    .min(0, 'Version cannot be negative')
    .finite('Version must be a finite number'),
  targetPosition: z
    .number()
    .positive('Target position must be positive')
    .finite('Target position must be a finite number')
    .optional(),
  previousTaskId: z
    .string()
    .refine((val) => isValidObjectId(val), {
      message: 'Invalid previous task ID format',
    })
    .nullable()
    .optional(),
  nextTaskId: z
    .string()
    .refine((val) => isValidObjectId(val), {
      message: 'Invalid next task ID format',
    })
    .nullable()
    .optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskStatusInput = z.infer<typeof moveTaskStatusSchema>;
