import React, { useState } from 'react';
import {
  Calendar,
  MoreVertical,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { Task, TaskStatus, KANBAN_COLUMNS } from '../../types/task';
import { TaskPriorityBadge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { AuthUser } from '../../types/auth';

export interface TaskCardProps {
  task: Task;
  projectKey: string;
  currentUser: AuthUser;
  isAdmin: boolean;
  isPrimaryManager: boolean;
  onSelectTask: (task: Task) => void;
  onQuickMoveStatus: (task: Task, newStatus: TaskStatus) => void;
  onDragStart: (task: Task) => void;
  onDragEnd: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  projectKey,
  currentUser,
  isAdmin,
  isPrimaryManager,
  onSelectTask,
  onQuickMoveStatus,
  onDragStart,
  onDragEnd,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Authority check (Spec 9.2 & matrix): Admin, Primary PM, or task's assigned employee can move status
  const isAssignee = task.assigneeId === currentUser._id;
  const canMove = isAdmin || isPrimaryManager || isAssignee;

  const handleDragStart = (e: React.DragEvent) => {
    if (!canMove) {
      e.preventDefault();
      return;
    }
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', task._id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart(task);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    onDragEnd();
  };

  // Due date formatting and overdue check
  const isOverdue = task.dueDate ? new Date(task.dueDate).getTime() < Date.now() && task.status !== 'DONE' : false;

  return (
    <div
      draggable={canMove}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onSelectTask(task)}
      className={`group relative bg-white border rounded-xl p-3.5 shadow-xs transition-all select-none ${
        canMove ? 'cursor-grab active:cursor-grabbing hover:border-primary-300 hover:shadow-card' : 'cursor-pointer hover:border-slate-300'
      } ${isDragging ? 'opacity-40 border-dashed border-primary scale-[0.98]' : 'border-slate-200/90'}`}
    >
      {/* Header: Key, Priority, and Quick Move Menu */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            {projectKey}-{task._id.slice(-4).toUpperCase()}
          </span>
          <TaskPriorityBadge priority={task.priority} />
        </div>

        {/* Quick Column Transition Dropdown */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          {canMove ? (
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Move column or options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span title="Only assigned employee or PM can move task" className="text-slate-300">
              <Lock className="w-3 h-3" />
            </span>
          )}

          {isMenuOpen && (
            <div className="absolute right-0 top-7 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-1.5 space-y-0.5 animate-fade-in text-xs">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Move to Column:
              </div>
              {KANBAN_COLUMNS.map((col) => {
                if (col.id === task.status) return null;
                return (
                  <button
                    key={col.id}
                    onClick={() => {
                      setIsMenuOpen(false);
                      onQuickMoveStatus(task, col.id);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-slate-700 hover:bg-primary-50 hover:text-primary transition-colors flex items-center justify-between"
                  >
                    <span>{col.label}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Task Title */}
      <h4 className="text-xs font-semibold text-slate-900 group-hover:text-primary transition-colors leading-snug line-clamp-2 mb-1.5">
        {task.title}
      </h4>

      {/* Description Snippet */}
      {task.description && (
        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-3">
          {task.description}
        </p>
      )}

      {/* Card Footer: Assignee & Due Date */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
        {/* Assignee */}
        <div className="flex items-center gap-1.5">
          {task.assignee ? (
            <>
              <Avatar name={task.assignee.fullName} size="xs" />
              <span className="truncate max-w-[100px] text-slate-700 font-medium">
                {task.assignee.fullName}
              </span>
            </>
          ) : (
            <span className="text-slate-400 italic">Unassigned</span>
          )}
        </div>

        {/* Due Date & Version */}
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <span
              className={`flex items-center gap-1 font-medium ${
                isOverdue ? 'text-red-600 bg-red-50 px-1.5 py-0.5 rounded' : 'text-slate-400'
              }`}
              title={isOverdue ? 'Task is overdue' : 'Due date'}
            >
              <Calendar className="w-3 h-3" />
              <span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            </span>
          )}

          <span className="text-[9px] font-mono text-slate-400" title={`Concurrency Version: ${task.version}`}>
            v{task.version}
          </span>
        </div>
      </div>
    </div>
  );
};
