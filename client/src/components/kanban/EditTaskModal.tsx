import React, { useState, useEffect } from 'react';
import { Settings2, AlertCircle, Calendar } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { taskApi } from '../../lib/taskApi';
import { projectApi } from '../../lib/projectApi';
import { ApiClientError } from '../../lib/api';
import { Task, TaskPriority } from '../../types/task';
import { ProjectMember } from '../../types/project';

export interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onTaskUpdated: (updatedTask: Task) => void;
  onTriggerToast: (type: 'success' | 'error' | 'warning', title: string, message?: string) => void;
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({
  isOpen,
  onClose,
  task,
  onTaskUpdated,
  onTriggerToast,
}) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [assigneeId, setAssigneeId] = useState<string>(task.assigneeId || '');
  const [dueDate, setDueDate] = useState<string>(
    task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
  );

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      return;
    }

    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setAssigneeId(task.assigneeId || '');
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');

    let isMounted = true;
    setIsLoadingMembers(true);
    projectApi
      .getProjectMembers(task.projectId)
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
  }, [isOpen, task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await taskApi.updateTask(task._id, {
        title: title.trim(),
        description: description.trim(),
        priority,
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      });

      onTriggerToast('success', 'Task Updated', `Changes saved for task "${updated.title}".`);
      onTaskUpdated(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to update task');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Sprint Task"
      description="Update task parameters, priority classification, and assignment."
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
            leftIcon={<Settings2 className="w-3.5 h-3.5" />}
          >
            Save Changes
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
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
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

          {/* Due Date */}
          <div className="w-full flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 tracking-wide select-none flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-9.5 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors cursor-pointer"
            />
          </div>
        </div>

        {/* Assignee */}
        <div className="w-full flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700 tracking-wide select-none">
            Assigned Team Member
          </label>
          {isLoadingMembers ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
              <Spinner size="sm" />
              <span>Loading team members...</span>
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
      </form>
    </Modal>
  );
};
