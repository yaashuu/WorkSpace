import React, { useState, useEffect } from 'react';
import {
  Layers,
  AlertCircle,
} from 'lucide-react';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { projectApi } from '../lib/projectApi';
import { ApiClientError } from '../lib/api';
import { DetailedProject, isDetailedProject } from '../types/project';
import { AuthUser } from '../types/auth';

export interface TasksPageProps {
  currentUser: AuthUser;
  initialProjectId?: string | null;
  initialTaskId?: string | null;
  onNavigateToProjects: () => void;
  onTriggerToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

export const TasksPage: React.FC<TasksPageProps> = ({
  currentUser,
  initialProjectId,
  initialTaskId,
  onNavigateToProjects,
  onTriggerToast,
}) => {
  const [projects, setProjects] = useState<DetailedProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = currentUser.globalRole === 'ADMIN';

  const loadProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await projectApi.getProjects();
      const accessibleProjects = data.filter(isDetailedProject) as DetailedProject[];
      setProjects(accessibleProjects);

      if (accessibleProjects.length > 0) {
        if (initialProjectId && accessibleProjects.some((p) => p._id === initialProjectId)) {
          setSelectedProjectId(initialProjectId);
        } else {
          setSelectedProjectId(accessibleProjects[0]._id);
        }
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const activeProject = projects.find((p) => p._id === selectedProjectId);
  const isPrimaryPM = activeProject ? activeProject.primaryManagerId === currentUser._id : false;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-500 gap-3">
        <Spinner size="lg" />
        <span className="text-xs font-medium">Loading project workstreams...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center space-y-3">
        <div className="flex items-center justify-center gap-2 text-red-700 text-sm font-semibold">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span>{error}</span>
        </div>
        <Button size="sm" variant="outline" onClick={loadProjects}>
          Try Again
        </Button>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="w-6 h-6" />}
        title="No Accessible Project Workstreams"
        description="You are not currently an active member of any project workstream. Join or create a project to view its sprint Kanban board."
        actionLabel="Explore Projects Directory"
        onAction={onNavigateToProjects}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Workstream Switcher Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary flex items-center justify-center shrink-0">
            <Layers className="w-4.5 h-4.5" />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="text-xs font-semibold text-slate-500">
              Active Sprint Workstream:
            </span>

            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="h-8.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors cursor-pointer"
            >
              {projects.map((proj) => (
                <option key={proj._id} value={proj._id}>
                  {proj.key} — {proj.name} {proj.primaryManagerId === currentUser._id ? '(Your PM Workstream)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeProject && (
            <span className="text-[11px] text-slate-500 font-medium">
              PM: <strong>{activeProject.primaryManager?.fullName || 'Assigned'}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Active Workstream Kanban Board */}
      {activeProject && (
        <KanbanBoard
          key={activeProject._id}
          projectId={activeProject._id}
          projectKey={activeProject.key}
          currentUser={currentUser}
          isAdmin={isAdmin}
          isPrimaryManager={isPrimaryPM}
          initialSelectedTaskId={initialTaskId}
          onTriggerToast={onTriggerToast}
        />
      )}
    </div>
  );
};
