export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'TESTING' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export const KANBAN_COLUMNS: { id: TaskStatus; label: string; description: string }[] = [
  { id: 'BACKLOG', label: 'Backlog', description: 'Pending backlog items awaiting prioritization' },
  { id: 'TODO', label: 'To Do', description: 'Scheduled tasks ready for current sprint execution' },
  { id: 'IN_PROGRESS', label: 'In Progress', description: 'Active work currently being engineered' },
  { id: 'TESTING', label: 'Testing', description: 'Quality assurance, code review, and verification' },
  { id: 'DONE', label: 'Done', description: 'Completed and verified deliverables' },
];

export interface TaskAssignee {
  _id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

export interface TaskCreator {
  _id: string;
  fullName: string;
  email: string;
}

export interface Task {
  _id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  assignee?: TaskAssignee | null;
  creatorId: string;
  creator?: TaskCreator | null;
  dueDate: string | null;
  position: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export interface MoveTaskStatusInput {
  status?: TaskStatus;
  version: number;
  targetPosition?: number;
  previousTaskId?: string | null;
  nextTaskId?: string | null;
}

export interface TaskCommentAuthor {
  _id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

export interface TaskComment {
  _id: string;
  taskId: string;
  projectId: string;
  authorId: string;
  author?: TaskCommentAuthor | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentInput {
  content: string;
}

export interface ConcurrentModificationDetails {
  currentVersion: number;
  currentStatus: TaskStatus;
  currentPosition: number;
}
