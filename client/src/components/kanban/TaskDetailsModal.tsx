import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  User,
  Trash2,
  Edit3,
  Layers,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TaskPriorityBadge, TaskStatusBadge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Task, TaskStatus, KANBAN_COLUMNS } from '../../types/task';
import { TaskComments } from './TaskComments';
import { EditTaskModal } from './EditTaskModal';
import { taskApi } from '../../lib/taskApi';
import { AuthUser } from '../../types/auth';

export interface TaskDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  projectKey: string;
  currentUser: AuthUser;
  isAdmin: boolean;
  isPrimaryManager: boolean;
  onTaskUpdated: (updatedTask: Task) => void;
  onTaskDeleted: (taskId: string) => void;
  onQuickMoveStatus: (task: Task, newStatus: TaskStatus) => void;
  onTriggerToast: (type: 'success' | 'error' | 'warning', title: string, message?: string) => void;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  isOpen,
  onClose,
  task,
  projectKey,
  currentUser,
  isAdmin,
  isPrimaryManager,
  onTaskUpdated,
  onTaskDeleted,
  onQuickMoveStatus,
  onTriggerToast,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!task) return null;

  const canManageTask = isAdmin || isPrimaryManager;
  const isAssignee = task.assigneeId === currentUser._id;
  const canMoveStatus = canManageTask || isAssignee;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await taskApi.deleteTask(task._id);
      onTriggerToast('success', 'Task Deleted', `Task "${task.title}" has been deleted.`);
      setIsDeleteConfirmOpen(false);
      onClose();
      onTaskDeleted(task._id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete task';
      onTriggerToast('error', 'Delete Failed', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Task ${projectKey}-${task._id.slice(-4).toUpperCase()}`}
        description="Detailed sprint task view, assignment, concurrency state, and activity."
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Created {new Date(task.createdAt).toLocaleDateString()}</span>
            </div>

            <div className="flex items-center gap-2">
              {canManageTask && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditModalOpen(true)}
                    className="text-xs"
                    leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                  >
                    Edit Task
                  </Button>
                </>
              )}
              <Button variant="primary" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Header Badges & Concurrency Tag */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <TaskStatusBadge status={task.status} />
              <TaskPriorityBadge priority={task.priority} />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                Version {task.version} (OCC)
              </span>

              {/* Status Transition Selector */}
              {canMoveStatus && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-xs">Move to:</span>
                  <select
                    value={task.status}
                    onChange={(e) => onQuickMoveStatus(task, e.target.value as TaskStatus)}
                    className="h-7 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {KANBAN_COLUMNS.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Task Title */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-snug">{task.title}</h2>
          </div>

          {/* Description */}
          <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Task Description
            </span>
            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
              {task.description || 'No description provided.'}
            </p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-xs">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Assignee
              </span>
              <div className="flex items-center gap-1.5 mt-1 font-medium text-slate-800">
                {task.assignee ? (
                  <>
                    <Avatar name={task.assignee.fullName} size="xs" />
                    <span className="truncate">{task.assignee.fullName}</span>
                  </>
                ) : (
                  <span className="text-slate-400 italic">Unassigned</span>
                )}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Reporter / Creator
              </span>
              <div className="flex items-center gap-1.5 mt-1 font-medium text-slate-800">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate">{task.creator?.fullName || 'Manager'}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Due Date
              </span>
              <div className="flex items-center gap-1.5 mt-1 font-medium text-slate-800">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'None set'}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Board Position
              </span>
              <div className="flex items-center gap-1 mt-1 font-mono text-slate-700">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>{task.position.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Embedded Discussion Comments */}
          <div className="border-t border-slate-100 pt-4">
            <TaskComments
              taskId={task._id}
              currentUser={currentUser}
              onTriggerToast={onTriggerToast}
            />
          </div>
        </div>
      </Modal>

      {/* Edit Task Modal */}
      {canManageTask && (
        <EditTaskModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          task={task}
          onTaskUpdated={(updated) => {
            onTaskUpdated(updated);
          }}
          onTriggerToast={onTriggerToast}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title="Delete Sprint Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={isDeleting}
            >
              Confirm Deletion
            </Button>
          </>
        }
      >
        <p className="text-xs text-slate-600 leading-relaxed">
          Task <strong>"{task.title}"</strong> and all its associated comments will be permanently
          removed from the project workstream.
        </p>
      </Modal>
    </>
  );
};
