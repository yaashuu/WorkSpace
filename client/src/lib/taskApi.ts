import { apiClient } from './api';
import {
  Task,
  TaskStatus,
  CreateTaskInput,
  UpdateTaskInput,
  MoveTaskStatusInput,
  TaskComment,
  CreateCommentInput,
} from '../types/task';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export const taskApi = {
  /**
   * Fetch all tasks belonging to a specific project.
   * Deterministically sorted by position, createdAt, and _id.
   */
  async getProjectTasks(projectId: string, status?: TaskStatus): Promise<Task[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await apiClient<ApiResponse<Task[]>>(`/projects/${projectId}/tasks${query}`);
    return res.data;
  },

  /**
   * Fetch a single task by ID.
   */
  async getTaskById(taskId: string): Promise<Task> {
    const res = await apiClient<ApiResponse<Task>>(`/tasks/${taskId}`);
    return res.data;
  },

  /**
   * Create a new task within a project (Admin or Primary PM only).
   */
  async createTask(projectId: string, input: CreateTaskInput): Promise<Task> {
    const res = await apiClient<ApiResponse<Task>>(`/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res.data;
  },

  /**
   * Update task metadata (title, description, priority, assignee, due date).
   * Admin or Primary PM only.
   */
  async updateTask(taskId: string, input: UpdateTaskInput): Promise<Task> {
    const res = await apiClient<ApiResponse<Task>>(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return res.data;
  },

  /**
   * Move task status and/or fractional position on the Kanban board.
   * Enforces optimistic concurrency control (version).
   * Authorized for Admin, PM, or the task's assigned employee.
   */
  async moveTaskStatus(taskId: string, input: MoveTaskStatusInput): Promise<Task> {
    const res = await apiClient<ApiResponse<Task>>(`/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return res.data;
  },

  /**
   * Delete a task and its comments (Admin or Primary PM only).
   */
  async deleteTask(taskId: string): Promise<{ message: string; taskId: string }> {
    const res = await apiClient<ApiResponse<{ message: string; taskId: string }>>(
      `/tasks/${taskId}`,
      {
        method: 'DELETE',
      }
    );
    return res.data;
  },

  /**
   * List all comments for a task ordered chronologically.
   * Authorized for project members, PM, and Admin.
   */
  async getTaskComments(taskId: string): Promise<TaskComment[]> {
    const res = await apiClient<ApiResponse<TaskComment[]>>(`/tasks/${taskId}/comments`);
    return res.data;
  },

  /**
   * Create a comment on a task.
   * Authorized for project members, PM, and Admin.
   */
  async createTaskComment(taskId: string, input: CreateCommentInput): Promise<TaskComment> {
    const res = await apiClient<ApiResponse<TaskComment>>(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res.data;
  },
};
