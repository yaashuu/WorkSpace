import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, KANBAN_COLUMNS } from '../../types/task';
import { KanbanColumn } from './KanbanColumn';
import { CreateTaskModal } from './CreateTaskModal';
import { TaskDetailsModal } from './TaskDetailsModal';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { taskApi } from '../../lib/taskApi';
import { ApiClientError } from '../../lib/api';
import { AuthUser } from '../../types/auth';

export interface KanbanBoardProps {
  projectId: string;
  projectKey: string;
  currentUser: AuthUser;
  isAdmin: boolean;
  isPrimaryManager: boolean;
  initialSelectedTaskId?: string | null;
  onTriggerToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  projectId,
  projectKey,
  currentUser,
  isAdmin,
  isPrimaryManager,
  initialSelectedTaskId,
  onTriggerToast,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | TaskPriority>('ALL');

  // Drag and Drop active task
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [targetColumnForNewTask, setTargetColumnForNewTask] = useState<TaskStatus>('BACKLOG');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const canCreateTask = isAdmin || isPrimaryManager;

  const loadTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await taskApi.getProjectTasks(projectId);
      setTasks(data);

      if (initialSelectedTaskId) {
        const found = data.find((t) => t._id === initialSelectedTaskId);
        if (found) setSelectedTask(found);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load project tasks');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [projectId]);

  // Group tasks by column
  const columnTasks = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      BACKLOG: [],
      TODO: [],
      IN_PROGRESS: [],
      TESTING: [],
      DONE: [],
    };

    tasks.forEach((task) => {
      // 1. Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description.toLowerCase().includes(q);
        const matchesAssignee = task.assignee?.fullName.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesAssignee) return;
      }

      // 2. My Tasks Only filter
      if (onlyMyTasks && task.assigneeId !== currentUser._id) {
        return;
      }

      // 3. Priority filter
      if (priorityFilter !== 'ALL' && task.priority !== priorityFilter) {
        return;
      }

      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });

    // Ensure sorted deterministically by position
    Object.keys(grouped).forEach((status) => {
      grouped[status as TaskStatus].sort((a, b) => a.position - b.position);
    });

    return grouped;
  }, [tasks, searchQuery, onlyMyTasks, priorityFilter, currentUser._id]);

  /**
   * Optimistic status move with OCC (version) and HTTP 409 conflict reconciliation
   */
  const handleMoveTaskStatus = async (
    task: Task,
    newStatus: TaskStatus,
    targetTaskId?: string
  ) => {
    // If moving to the exact same status with no target position change, no-op
    if (task.status === newStatus && !targetTaskId) {
      return;
    }

    // Capture backup state for rollback
    const previousTasks = [...tasks];

    // Compute previous and next tasks in the destination column for fractional positioning
    const destinationColumnTasks = (columnTasks[newStatus] || []).filter((t) => t._id !== task._id);
    let previousTaskId: string | null = null;
    let nextTaskId: string | null = null;

    if (targetTaskId) {
      const targetIndex = destinationColumnTasks.findIndex((t) => t._id === targetTaskId);
      if (targetIndex >= 0) {
        const targetTask = destinationColumnTasks[targetIndex];
        previousTaskId = targetTask._id;
        const nextInCol = destinationColumnTasks[targetIndex + 1];
        if (nextInCol) nextTaskId = nextInCol._id;
      }
    } else {
      // Default to end of destination column
      const last = destinationColumnTasks[destinationColumnTasks.length - 1];
      if (last) previousTaskId = last._id;
    }

    // 1. Apply optimistic update immediately to board state
    const optimisticUpdatedTask: Task = {
      ...task,
      status: newStatus,
      version: task.version + 1,
    };

    setTasks((current) =>
      current.map((t) => (t._id === task._id ? optimisticUpdatedTask : t))
    );

    // Also update selected task if modal is open
    if (selectedTask && selectedTask._id === task._id) {
      setSelectedTask(optimisticUpdatedTask);
    }

    // 2. Dispatch API request to backend
    try {
      const serverTask = await taskApi.moveTaskStatus(task._id, {
        status: newStatus,
        version: task.version,
        previousTaskId,
        nextTaskId,
      });

      // 3. Reconcile optimistic state with authoritative server data
      setTasks((current) =>
        current.map((t) => (t._id === task._id ? serverTask : t))
      );
      if (selectedTask && selectedTask._id === task._id) {
        setSelectedTask(serverTask);
      }

      onTriggerToast(
        'success',
        'Task Moved',
        `Task moved to ${newStatus} (v${serverTask.version}).`
      );
    } catch (err) {
      // 4. Handle HTTP 409 Concurrent Modification
      if (err instanceof ApiClientError && err.statusCode === 409) {
        onTriggerToast(
          'warning',
          'Concurrent Modification Detected',
          'This task was updated elsewhere by another user. Reconciling board with latest state...'
        );
        // Roll back and fetch fresh server state
        await loadTasks();
      } else {
        // Roll back on any other error
        setTasks(previousTasks);
        if (selectedTask && selectedTask._id === task._id) {
          setSelectedTask(task);
        }
        const msg = err instanceof Error ? err.message : 'Failed to move task';
        onTriggerToast('error', 'Move Failed', msg);
      }
    }
  };

  const handleDropOnColumn = (targetStatus: TaskStatus) => {
    if (!draggingTask) return;
    handleMoveTaskStatus(draggingTask, targetStatus);
    setDraggingTask(null);
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Left: Search & Filter Chips */}
        <div className="flex items-center gap-2.5 flex-wrap flex-1">
          {/* Search */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8.5 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
          </div>

          {/* My Tasks Toggle */}
          <button
            type="button"
            onClick={() => setOnlyMyTasks((prev) => !prev)}
            className={`h-8.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              onlyMyTasks
                ? 'bg-primary text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Assigned to Me</span>
          </button>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Priority:
            </span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as 'ALL' | TaskPriority)}
              className="h-8.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadTasks}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            className="text-xs"
          >
            Refresh
          </Button>

          {canCreateTask && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setTargetColumnForNewTask('TODO');
                setIsCreateModalOpen(true);
              }}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              New Task
            </Button>
          )}
        </div>
      </div>

      {/* Main Board Container */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20 text-slate-500 gap-3">
          <Spinner size="lg" />
          <span className="text-xs font-medium">Loading Kanban tasks...</span>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-red-700 text-sm font-semibold">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="outline" onClick={loadTasks}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="flex items-start gap-4 overflow-x-auto pb-4 pt-1">
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              status={col.id}
              label={col.label}
              tasks={columnTasks[col.id]}
              projectKey={projectKey}
              currentUser={currentUser}
              isAdmin={isAdmin}
              isPrimaryManager={isPrimaryManager}
              canCreateTask={canCreateTask}
              onOpenCreateTaskModal={(status) => {
                setTargetColumnForNewTask(status);
                setIsCreateModalOpen(true);
              }}
              onSelectTask={(task) => setSelectedTask(task)}
              onQuickMoveStatus={handleMoveTaskStatus}
              onDragStart={(task) => setDraggingTask(task)}
              onDragEnd={() => setDraggingTask(null)}
              onDropTaskOnColumn={handleDropOnColumn}
            />
          ))}
        </div>
      )}

      {/* Create Task Modal */}
      {canCreateTask && (
        <CreateTaskModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          projectId={projectId}
          defaultStatus={targetColumnForNewTask}
          onTaskCreated={(created) => {
            setTasks((prev) => [...prev, created]);
          }}
          onTriggerToast={onTriggerToast}
        />
      )}

      {/* Task Details Modal */}
      <TaskDetailsModal
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        projectKey={projectKey}
        currentUser={currentUser}
        isAdmin={isAdmin}
        isPrimaryManager={isPrimaryManager}
        onTaskUpdated={(updated) => {
          setTasks((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
          setSelectedTask(updated);
        }}
        onTaskDeleted={(deletedId) => {
          setTasks((prev) => prev.filter((t) => t._id !== deletedId));
          setSelectedTask(null);
        }}
        onQuickMoveStatus={handleMoveTaskStatus}
        onTriggerToast={onTriggerToast}
      />
    </div>
  );
};
