import React, { useState, useEffect } from 'react';
import { Plus, AlertCircle, Calendar } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { taskApi } from '../../lib/taskApi';
import { projectApi } from '../../lib/projectApi';
import { ApiClientError } from '../../lib/api';
import { Task, TaskStatus, TaskPriority, KANBAN_COLUMNS } from '../../types/task';
import { ProjectMember } from '../../types/project';

export interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  defaultStatus?: TaskStatus;
  onTaskCreated: (task: Task) => void;
  onTriggerToast: (type: 'success' | 'error' | 'warning', title: string, message?: string) => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  projectId,
  defaultStatus = 'BACKLOG',
  onTaskCreated,
  onTriggerToast,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');

  // Project members for assignee dropdown
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setDescription('');
      setStatus(defaultStatus);
      setPriority('MEDIUM');
      setAssigneeId('');
      setDueDate('');
      setError(null);
      return;
    }

    setStatus(defaultStatus);

    let isMounted = true;
    setIsLoadingMembers(true);
    projectApi
      .getProjectMembers(projectId)
      .then((data) => {
        if (isMounted) setMembers(data);
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoadingMembers(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, projectId, defaultStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const created = await taskApi.createTask(projectId, {
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      });

      onTriggerToast('success', 'Task Created', `Task "${created.title}" added to ${status}.`);
      onTaskCreated(created);
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create task');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Sprint Task"
      description="Create a task card and assign it to an active project team member."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Create Task
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <Input
          label="Task Title"
          placeholder="e.g. Implement resilient retry mechanism for webhook delivery"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="w-full flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700 tracking-wide select-none">
            Description
          </label>
          <textarea
            rows={3}
            placeholder="Detailed specifications, reproduction steps, or requirements..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Status Column */}
          <div className="w-full flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 tracking-wide select-none">
              Target Status Column
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="w-full h-9.5 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors cursor-pointer"
            >
              {KANBAN_COLUMNS.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className="w-full flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 tracking-wide select-none">
              Priority Level
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full h-9.5 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors cursor-pointer"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Assignee */}
          <div className="w-full flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 tracking-wide select-none">
              Assignee
            </label>
            {isLoadingMembers ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                <Spinner size="sm" />
                <span>Loading team...</span>
              </div>
            ) : (
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full h-9.5 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors cursor-pointer"
              >
                <option value="">Unassigned</option>
                {members.map((m) => {
                  if (!m.user) return null;
                  return (
                    <option key={m.user._id} value={m.user._id}>
                      {m.user.fullName} {m.isPrimaryManager ? '(Primary PM)' : ''}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Due Date */}
          <div className="w-full flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 tracking-wide select-none flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              Due Date (Optional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-9.5 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors cursor-pointer"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
};
