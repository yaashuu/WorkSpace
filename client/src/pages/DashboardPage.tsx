import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderKanban,
  Users,
  AlertTriangle,
  Clock,
  ArrowRight,
  Layers,
  ChevronRight,
  Lock,
  Globe,
  SlidersHorizontal,
  Calendar,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge, TaskPriorityBadge, TaskStatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Spinner } from '../components/ui/Spinner';
import { AuthUser } from '../types/auth';
import { Task, TaskStatus } from '../types/task';
import { ProjectItem, isDetailedProject } from '../types/project';
import { projectApi } from '../lib/projectApi';
import { taskApi } from '../lib/taskApi';
import {
  SAMPLE_ACTIVITY_STREAM,
} from '../data/sampleData';

export interface DashboardPageProps {
  currentUser: AuthUser;
  searchQuery: string;
  onClearSearch: () => void;
  onNavigateToProjects: () => void;
  onNavigateToTasks: () => void;
  onNavigateToProject?: (projectId: string) => void;
  onNavigateToTask?: (projectId: string, taskId: string) => void;
  onOpenNewProjectModal: () => void;
  onTriggerToast: (type: 'info' | 'success' | 'warning', title: string, message?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  currentUser,
  searchQuery,
  onClearSearch,
  onNavigateToProjects,
  onNavigateToTasks,
  onNavigateToProject,
  onNavigateToTask,
  onOpenNewProjectModal,
}) => {
  const [liveProjects, setLiveProjects] = useState<ProjectItem[]>([]);
  const [liveTasks, setLiveTasks] = useState<Task[]>([]);
  const [isLoadingLive, setIsLoadingLive] = useState(true);

  // Fetch live projects & tasks
  useEffect(() => {
    let isMounted = true;
    const fetchDashboardData = async () => {
      try {
        const projs = await projectApi.getProjects();
        if (!isMounted) return;
        setLiveProjects(projs);

        const detailed = projs.filter(isDetailedProject);
        if (detailed.length > 0) {
          const taskLists = await Promise.all(
            detailed.slice(0, 6).map((p) => taskApi.getProjectTasks(p._id).catch(() => [] as Task[]))
          );
          if (!isMounted) return;
          setLiveTasks(taskLists.flat());
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (isMounted) setIsLoadingLive(false);
      }
    };

    fetchDashboardData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter projects by search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return liveProjects;
    const q = searchQuery.toLowerCase().trim();
    return liveProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [liveProjects, searchQuery]);

  // Tasks assigned to current user
  const userAssignedTasks = useMemo(() => {
    return liveTasks.filter((t) => t.assigneeId === currentUser._id);
  }, [liveTasks, currentUser._id]);

  // Filter tasks by search query (prioritize user assigned, fallback to all project tasks)
  const displayTasks = useMemo(() => {
    const source = userAssignedTasks.length > 0 ? userAssignedTasks : liveTasks;
    if (!searchQuery.trim()) return source;
    const q = searchQuery.toLowerCase().trim();
    return source.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.assignee?.fullName.toLowerCase().includes(q)
    );
  }, [userAssignedTasks, liveTasks, searchQuery]);

  // Status breakdown metrics
  const statusCounts = useMemo(() => {
    const counts: Record<TaskStatus, number> = {
      BACKLOG: 0,
      TODO: 0,
      IN_PROGRESS: 0,
      TESTING: 0,
      DONE: 0,
    };
    liveTasks.forEach((t) => {
      if (counts[t.status] !== undefined) counts[t.status]++;
    });
    return counts;
  }, [liveTasks]);

  const totalTasksCount = liveTasks.length;

  const statusMetrics = [
    { status: 'BACKLOG' as TaskStatus, label: 'Backlog', count: statusCounts.BACKLOG, color: 'bg-slate-400' },
    { status: 'TODO' as TaskStatus, label: 'To Do', count: statusCounts.TODO, color: 'bg-blue-500' },
    { status: 'IN_PROGRESS' as TaskStatus, label: 'In Progress', count: statusCounts.IN_PROGRESS, color: 'bg-primary' },
    { status: 'TESTING' as TaskStatus, label: 'Testing', count: statusCounts.TESTING, color: 'bg-amber-500' },
    { status: 'DONE' as TaskStatus, label: 'Done', count: statusCounts.DONE, color: 'bg-emerald-500' },
  ];

  const isFiltering = searchQuery.trim().length > 0;
  const matchCount = filteredProjects.length + displayTasks.length;

  return (
    <div className="space-y-6">
      {/* Search Filter Active Feedback Banner */}
      {isFiltering && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-primary-800 animate-fade-in">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-primary shrink-0" />
            <span>
              Filtering dashboard for <strong>"{searchQuery}"</strong> — Found{' '}
              <strong>{matchCount}</strong> matching items across projects & tasks.
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSearch}
            className="text-xs h-7 text-primary hover:bg-primary-100"
          >
            Clear Filter
          </Button>
        </div>
      )}

      {/* 1. Context & Sprint Pulse Header */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-card flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-primary bg-primary-50 px-2.5 py-0.5 rounded-full border border-primary-200">
              Active Sprint
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-medium text-slate-500">{totalTasksCount} tasks in progress</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Welcome back, {currentUser.fullName}
          </h1>
          <p className="text-xs text-slate-500">
            {currentUser.globalRole === 'ADMIN' ? 'Organization Administrator' : 'Team Member'} — WorkSpace team collaboration & Kanban tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {currentUser.globalRole === 'ADMIN' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenNewProjectModal}
              leftIcon={<FolderKanban className="w-3.5 h-3.5" />}
            >
              New Project
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onNavigateToProjects}
              leftIcon={<FolderKanban className="w-3.5 h-3.5" />}
            >
              Browse Projects
            </Button>
          )}
        </div>
      </div>

      {/* 2. Kanban Workflow Pipeline Summary Strip (Live Data) */}
      <Card className="p-4 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Kanban Flow Velocity ({totalTasksCount} Tracked Tasks)
            </h3>
          </div>
          <button
            onClick={onNavigateToTasks}
            className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Open Sprint Board</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Proportional Status Segmented Bar */}
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex mb-3">
          {totalTasksCount > 0 ? (
            statusMetrics.map((seg) => (
              <div
                key={seg.status}
                className={`${seg.color} h-full transition-all`}
                style={{ width: `${(seg.count / totalTasksCount) * 100}%` }}
                title={`${seg.label}: ${seg.count} tasks`}
              />
            ))
          ) : (
            <div className="w-full h-full bg-slate-200" title="No tasks created yet" />
          )}
        </div>

        {/* Column Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
          {statusMetrics.map((seg) => (
            <div
              key={seg.status}
              onClick={onNavigateToTasks}
              className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors cursor-pointer text-center"
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className={`w-2 h-2 rounded-full ${seg.color}`} />
                <span className="text-[11px] font-medium text-slate-500">{seg.label}</span>
              </div>
              <span className="text-base font-bold text-slate-900">{seg.count}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 3. Main Dashboard Body: Projects (Left 60%) & Priority Queue + Activity (Right 40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Projects Portfolio */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="h-full flex flex-col">
            <CardHeader className="py-3.5">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm">Active Workstream Projects</CardTitle>
                <Badge variant="neutral" size="sm">
                  {filteredProjects.length}
                </Badge>
              </div>
              <button
                onClick={onNavigateToProjects}
                className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Directory</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </CardHeader>

            <CardContent className="p-0 divide-y divide-slate-100 flex-1">
              {isLoadingLive ? (
                <div className="p-10 flex items-center justify-center gap-2 text-xs text-slate-400">
                  <Spinner size="sm" />
                  <span>Loading workstreams...</span>
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  {searchQuery ? `No projects matching "${searchQuery}".` : 'No accessible workstreams yet.'}
                </div>
              ) : (
                filteredProjects.slice(0, 5).map((project) => {
                  const hasDetails = isDetailedProject(project);
                  const pmName = project.primaryManager?.fullName || 'Manager';

                  return (
                    <div
                      key={project._id}
                      onClick={() =>
                        onNavigateToProject ? onNavigateToProject(project._id) : onNavigateToProjects()
                      }
                      className="p-5 hover:bg-slate-50/70 transition-colors cursor-pointer flex flex-col gap-3 group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-primary-50 text-primary border border-primary-200">
                              {project.key}
                            </span>
                            <h4 className="text-sm font-semibold text-slate-900 group-hover:text-primary transition-colors">
                              {project.name}
                            </h4>
                            {project.visibility === 'PRIVATE' ? (
                              <span className="text-slate-400" title="Private project">
                                <Lock className="w-3 h-3" />
                              </span>
                            ) : (
                              <span className="text-slate-400" title="Public project">
                                <Globe className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                            {project.description || 'Active workstream.'}
                          </p>
                        </div>

                        <Badge variant="primary" size="sm" dot>
                          {hasDetails ? (project as any).status || 'ACTIVE' : 'PUBLIC'}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                        <span className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>PM: {pmName}</span>
                        </span>
                        <span className="text-primary font-medium group-hover:underline flex items-center gap-1">
                          View Workstream <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Focus Queue & Activity Feed */}
        <div className="lg:col-span-5 space-y-6">
          {/* Priority Focus Queue (Live Data) */}
          <Card>
            <CardHeader className="py-3.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <CardTitle className="text-sm">Priority Focus Queue</CardTitle>
                <Badge variant={displayTasks.length > 0 ? 'primary' : 'neutral'} size="sm">
                  {displayTasks.length} {userAssignedTasks.length > 0 ? 'Assigned' : 'Tasks'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-3 divide-y divide-slate-100">
              {isLoadingLive ? (
                <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Spinner size="sm" />
                  <span>Loading tasks...</span>
                </div>
              ) : displayTasks.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  {searchQuery ? `No tasks matching "${searchQuery}".` : 'No tasks assigned to your account.'}
                </div>
              ) : (
                displayTasks.slice(0, 5).map((task) => (
                  <div
                    key={task._id}
                    onClick={() => {
                      if (onNavigateToTask) {
                        onNavigateToTask(task.projectId, task._id);
                      } else {
                        onNavigateToTasks();
                      }
                    }}
                    className="py-3 px-2 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer flex items-start justify-between gap-3 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <TaskPriorityBadge priority={task.priority} />
                        <TaskStatusBadge status={task.status} />
                      </div>
                      <h5 className="text-xs font-semibold text-slate-800 group-hover:text-primary transition-colors leading-snug line-clamp-1">
                        {task.title}
                      </h5>
                      <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : 'Sprint task'}
                        </span>
                        <span>•</span>
                        <span>v{task.version}</span>
                      </span>
                    </div>

                    {task.assignee && <Avatar name={task.assignee.fullName} size="xs" />}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Activity Audit Stream Preview */}
          <Card>
            <CardHeader className="py-3.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm">Recent Activity Audit</CardTitle>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3.5">
              {SAMPLE_ACTIVITY_STREAM.slice(0, 4).map((act) => (
                <div key={act.id} className="flex items-start gap-2.5 text-xs">
                  <Avatar name={act.actorName} size="xs" className="mt-0.5" />
                  <div className="flex-1 min-w-0 leading-snug">
                    <span className="font-semibold text-slate-800">{act.actorName}</span>{' '}
                    <span className="text-slate-500">{act.actionVerb}</span>{' '}
                    <span className="font-bold text-slate-900">{act.targetEntity}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {act.timestamp} • Workstream <strong>{act.projectKey}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
