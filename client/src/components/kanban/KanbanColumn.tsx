import React, { useState } from 'react';
import { Plus, Inbox } from 'lucide-react';
import { Task, TaskStatus } from '../../types/task';
import { TaskStatusBadge } from '../ui/Badge';
import { TaskCard } from './TaskCard';
import { AuthUser } from '../../types/auth';

export interface KanbanColumnProps {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  projectKey: string;
  currentUser: AuthUser;
  isAdmin: boolean;
  isPrimaryManager: boolean;
  canCreateTask: boolean;
  onOpenCreateTaskModal: (status: TaskStatus) => void;
  onSelectTask: (task: Task) => void;
  onQuickMoveStatus: (task: Task, newStatus: TaskStatus) => void;
  onDragStart: (task: Task) => void;
  onDragEnd: () => void;
  onDropTaskOnColumn: (status: TaskStatus, targetTaskId?: string) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  tasks,
  projectKey,
  currentUser,
  isAdmin,
  isPrimaryManager,
  canCreateTask,
  onOpenCreateTaskModal,
  onSelectTask,
  onQuickMoveStatus,
  onDragStart,
  onDragEnd,
  onDropTaskOnColumn,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onDropTaskOnColumn(status);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col bg-slate-50/80 rounded-2xl border transition-all duration-200 min-w-[280px] w-full max-w-sm flex-1 ${
        isDragOver ? 'border-primary ring-2 ring-primary/20 bg-primary-50/20' : 'border-slate-200/70'
      }`}
    >
      {/* Column Header */}
      <div className="p-3.5 flex items-center justify-between border-b border-slate-200/60 bg-white/60 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <TaskStatusBadge status={status} />
          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
            {tasks.length}
          </span>
        </div>

        {canCreateTask && (
          <button
            type="button"
            onClick={() => onOpenCreateTaskModal(status)}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary-50 transition-colors"
            title={`Add task to ${status}`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Column Tasks Container */}
      <div className="p-3 flex-1 flex flex-col gap-2.5 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[300px]">
        {tasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl my-auto">
            <Inbox className="w-6 h-6 text-slate-300 mb-2" />
            <span className="text-xs font-semibold text-slate-600">No tasks in {status}</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Drag tasks here or create a new card</p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              projectKey={projectKey}
              currentUser={currentUser}
              isAdmin={isAdmin}
              isPrimaryManager={isPrimaryManager}
              onSelectTask={onSelectTask}
              onQuickMoveStatus={onQuickMoveStatus}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </div>
    </div>
  );
};
