import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Plus,
  Lock,
  Globe,
  SlidersHorizontal,
  Calendar,
  ChevronRight,
  Users,
  CheckSquare,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge, TaskPriorityBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Spinner } from '../components/ui/Spinner';
import { AuthUser } from '../types/auth';
import { Task } from '../types/task';
import { ProjectItem, isDetailedProject } from '../types/project';
import { ActivityLogResponse } from '../types/activity';
import { projectApi } from '../lib/projectApi';
import { taskApi } from '../lib/taskApi';
import { activityApi } from '../lib/activityApi';

export interface DashboardPageProps {
  currentUser: AuthUser;
  searchQuery: string;
  onClearSearch: () => void;
  onNavigateToProjects: () => void;
  onNavigateToTasks: () => void;
  onNavigateToActivity?: () => void;
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
  onNavigateToActivity,
  onNavigateToProject,
  onNavigateToTask,
  onOpenNewProjectModal,
}) => {
  const [liveProjects, setLiveProjects] = useState<ProjectItem[]>([]);
  const [liveTasks, setLiveTasks] = useState<Task[]>([]);
  const [liveActivity, setLiveActivity] = useState<ActivityLogResponse[]>([]);
  const [isLoadingLive, setIsLoadingLive] = useState(true);

  // Fetch live projects, tasks, and recent activity
  useEffect(() => {
    let isMounted = true;
    const fetchDashboardData = async () => {
      try {
        const projs = await projectApi.getProjects();
        if (!isMounted) return;
        setLiveProjects(projs);

        const detailed = projs.filter(isDetailedProject);
        if (detailed.length > 0) {
          const [taskLists, activityResults] = await Promise.all([
            Promise.all(
              detailed.slice(0, 8).map((p) => taskApi.getProjectTasks(p._id).catch(() => [] as Task[]))
            ),
            Promise.all(
              detailed.slice(0, 4).map((p) =>
                activityApi
                  .getProjectActivity(p._id, { limit: 5 })
                  .then((res) => res.activityLogs)
                  .catch(() => [] as ActivityLogResponse[])
              )
            ),
          ]);
          if (!isMounted) return;
          setLiveTasks(taskLists.flat());
          const mergedLogs = activityResults.flat();
          mergedLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setLiveActivity(mergedLogs.slice(0, 5));
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

  // Role detection
  const isOrgAdmin = currentUser.globalRole === 'ADMIN';
  const isManager = useMemo(() => {
    return liveProjects.some(
      (p) =>
        isDetailedProject(p) &&
        (p.primaryManagerId === currentUser._id || p.primaryManager?._id === currentUser._id)
    );
  }, [liveProjects, currentUser._id]);

  // Project indexing & task grouping
  const projectMap = useMemo(() => {
    const map = new Map<string, ProjectItem>();
    liveProjects.forEach((p) => map.set(p._id, p));
    return map;
  }, [liveProjects]);

  const tasksByProject = useMemo(() => {
    const map = new Map<string, Task[]>();
    liveTasks.forEach((task) => {
      const list = map.get(task.projectId) || [];
      list.push(task);
      map.set(task.projectId, list);
    });
    return map;
  }, [liveTasks]);

  // Active projects list
  const activeProjects = useMemo(() => {
    return liveProjects.filter((p) => !('status' in p) || p.status !== 'ARCHIVED');
  }, [liveProjects]);

  // Filter projects by search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return activeProjects;
    const q = searchQuery.toLowerCase().trim();
    return activeProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [activeProjects, searchQuery]);

  // Tasks assigned to current user
  const userAssignedTasks = useMemo(() => {
    return liveTasks.filter((t) => t.assigneeId === currentUser._id);
  }, [liveTasks, currentUser._id]);

  // Scoped tasks for KPI metrics
  const relevantTasks = useMemo(() => {
    if (isOrgAdmin) return liveTasks;
    if (isManager) return liveTasks;
    return userAssignedTasks.length > 0 ? userAssignedTasks : liveTasks;
  }, [isOrgAdmin, isManager, userAssignedTasks, liveTasks]);

  // KPI 1: Active Projects Count
  const activeProjectsCount = activeProjects.length;

  // KPI 2: Open Tasks
  const openTasksCount = useMemo(() => {
    return relevantTasks.filter((t) => t.status !== 'DONE').length;
  }, [relevantTasks]);

  // KPI 3: Overdue Tasks
  const overdueTasksCount = useMemo(() => {
    const now = Date.now();
    return relevantTasks.filter((t) => {
      if (t.status === 'DONE' || !t.dueDate) return false;
      return new Date(t.dueDate).getTime() < now;
    }).length;
  }, [relevantTasks]);

  // KPI 4: Completed Tasks & Rate
  const completedTasksCount = useMemo(() => {
    return relevantTasks.filter((t) => t.status === 'DONE').length;
  }, [relevantTasks]);

  const completionRate = useMemo(() => {
    const total = relevantTasks.length;
    if (total === 0) return 100;
    return Math.round((completedTasksCount / total) * 100);
  }, [relevantTasks, completedTasksCount]);

  // Tasks requiring attention: Overdue, High/Urgent, Due soon
  const attentionTasks = useMemo(() => {
    const now = Date.now();
    const candidateTasks = userAssignedTasks.length > 0 ? userAssignedTasks : liveTasks;

    return candidateTasks
      .filter((task) => {
        if (task.status === 'DONE') return false;
        const isOverdue = task.dueDate ? new Date(task.dueDate).getTime() < now : false;
        const isUrgent = task.priority === 'URGENT' || task.priority === 'HIGH';
        const isDueSoon = task.dueDate
          ? new Date(task.dueDate).getTime() - now < 3 * 24 * 60 * 60 * 1000
          : false;
        return isOverdue || isUrgent || isDueSoon;
      })
      .sort((a, b) => {
        const aOverdue = a.dueDate ? new Date(a.dueDate).getTime() < now : false;
        const bOverdue = b.dueDate ? new Date(b.dueDate).getTime() < now : false;
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;

        const priorityRank = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
      })
      .slice(0, 5);
  }, [userAssignedTasks, liveTasks]);

  const isFiltering = searchQuery.trim().length > 0;

  // Format relative timestamp
  const formatTimeAgo = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / (60 * 1000));
      const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
      const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  const formatActivityAction = (action: string): string => {
    switch (action) {
      case 'PROJECT_CREATED':
        return 'created project';
      case 'VISIBILITY_CHANGED':
        return 'updated visibility of';
      case 'MANAGER_REPLACED':
        return 'reassigned manager for';
      case 'TASK_CREATED':
        return 'created task';
      case 'TASK_UPDATED':
        return 'updated task';
      case 'TASK_MOVED':
        return 'moved task';
      case 'TASK_DELETED':
        return 'deleted task';
      case 'COMMENT_ADDED':
        return 'commented on';
      case 'MEMBER_JOINED':
        return 'joined project';
      case 'MEMBER_REMOVED':
        return 'removed member from';
      case 'INVITATION_CREATED':
        return 'sent invitation for';
      default:
        return action.toLowerCase().replace(/_/g, ' ');
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Filter Banner */}
      {isFiltering && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-primary-800 animate-fade-in">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-primary shrink-0" />
            <span>
              Filtering dashboard for <strong>"{searchQuery}"</strong> — Found{' '}
              <strong>{filteredProjects.length}</strong> matching projects.
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSearch}
            className="text-xs h-7 text-primary hover:bg-primary-100 cursor-pointer"
          >
            Clear Filter
          </Button>
        </div>
      )}

      {/* 1. Contextual Greeting Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-card flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {currentUser.fullName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isOrgAdmin
              ? 'Here is an overview of active projects, task health, and team activity across your workspace.'
              : isManager
              ? 'Here is an overview of your managed projects, assigned tasks, and team progress.'
              : 'Here is an overview of your assigned tasks, project progress, and recent team activity.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isOrgAdmin ? (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={onOpenNewProjectModal}
                leftIcon={<Plus className="w-4 h-4" />}
                className="cursor-pointer shadow-sm"
              >
                New Project
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateToProjects}
                leftIcon={<FolderKanban className="w-4 h-4" />}
                className="cursor-pointer"
              >
                All Projects
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={onNavigateToTasks}
                leftIcon={<CheckSquare className="w-4 h-4" />}
                className="cursor-pointer shadow-sm"
              >
                My Tasks
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateToProjects}
                leftIcon={<FolderKanban className="w-4 h-4" />}
                className="cursor-pointer"
              >
                Browse Projects
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 2. Summary KPIs (4 Cards Max) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Projects */}
        <div
          onClick={onNavigateToProjects}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-card hover:border-primary-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Projects
            </span>
            <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isLoadingLive ? '...' : activeProjectsCount}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isOrgAdmin ? 'Across your organization' : 'Available in workspace'}
            </p>
          </div>
        </div>

        {/* KPI 2: Open Tasks */}
        <div
          onClick={onNavigateToTasks}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-card hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Open Tasks
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isLoadingLive ? '...' : openTasksCount}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {userAssignedTasks.length > 0 && !isOrgAdmin
                ? 'Assigned to your account'
                : 'Pending and in progress'}
            </p>
          </div>
        </div>

        {/* KPI 3: Overdue Tasks */}
        <div
          onClick={onNavigateToTasks}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-card hover:border-amber-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Overdue Tasks
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                overdueTasksCount > 0
                  ? 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white'
                  : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                overdueTasksCount > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {isLoadingLive ? '...' : overdueTasksCount}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {overdueTasksCount > 0 ? 'Requires immediate attention' : 'All tasks on schedule'}
            </p>
          </div>
        </div>

        {/* KPI 4: Completed Tasks */}
        <div
          onClick={onNavigateToTasks}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-card hover:border-emerald-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Completed Tasks
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isLoadingLive ? '...' : completedTasksCount}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {completionRate}% overall completion rate
            </p>
          </div>
        </div>
      </div>

      {/* 3. Main Dashboard Body: Project Progress (7 cols) + Right Column (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Project Progress Overview */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="h-full flex flex-col">
            <CardHeader className="py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-bold text-slate-900">
                  Project Progress Overview
                </CardTitle>
                <Badge variant="neutral" size="sm">
                  {filteredProjects.length}
                </Badge>
              </div>
              <button
                type="button"
                onClick={onNavigateToProjects}
                className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </CardHeader>

            <CardContent className="p-0 divide-y divide-slate-100 flex-1">
              {isLoadingLive ? (
                <div className="p-12 flex items-center justify-center gap-2 text-xs text-slate-400">
                  <Spinner size="sm" />
                  <span>Loading projects...</span>
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-400">
                  {searchQuery
                    ? `No projects found matching "${searchQuery}".`
                    : 'No active projects in your workspace yet.'}
                </div>
              ) : (
                filteredProjects.slice(0, 5).map((project) => {
                  const pTasks = tasksByProject.get(project._id) || [];
                  const pCompleted = pTasks.filter((t) => t.status === 'DONE').length;
                  const pTotal = pTasks.length;
                  const pPercent = pTotal > 0 ? Math.round((pCompleted / pTotal) * 100) : 0;
                  const pmName = project.primaryManager?.fullName || 'Project Manager';

                  return (
                    <div
                      key={project._id}
                      onClick={() =>
                        onNavigateToProject
                          ? onNavigateToProject(project._id)
                          : onNavigateToProjects()
                      }
                      className="p-5 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col gap-3 group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-primary-50 text-primary border border-primary-200 shrink-0">
                              {project.key}
                            </span>
                            <h4 className="text-sm font-semibold text-slate-900 group-hover:text-primary transition-colors truncate">
                              {project.name}
                            </h4>
                            {project.visibility === 'PRIVATE' ? (
                              <span className="text-slate-400 shrink-0" title="Private project">
                                <Lock className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="text-slate-400 shrink-0" title="Public project">
                                <Globe className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                          {project.description && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                              {project.description}
                            </p>
                          )}
                        </div>

                        <Badge variant="primary" size="sm" dot>
                          Active
                        </Badge>
                      </div>

                      {/* Progress Bar & Ratio */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">
                            {pTotal > 0
                              ? `${pCompleted} of ${pTotal} tasks completed`
                              : 'No tasks created yet'}
                          </span>
                          <span className="font-bold text-slate-700">{pPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${pPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Footer Info */}
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100/80">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>PM: {pmName}</span>
                        </span>
                        <span className="text-primary font-medium group-hover:underline flex items-center gap-1">
                          Open Project <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Tasks Requiring Attention & Recent Activity */}
        <div className="lg:col-span-5 space-y-6">
          {/* Tasks Requiring Attention */}
          <Card>
            <CardHeader className="py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <CardTitle className="text-sm font-bold text-slate-900">
                  Tasks Requiring Attention
                </CardTitle>
                <Badge
                  variant={attentionTasks.length > 0 ? 'warning' : 'neutral'}
                  size="sm"
                >
                  {attentionTasks.length}
                </Badge>
              </div>
              <button
                type="button"
                onClick={onNavigateToTasks}
                className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>All Tasks</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </CardHeader>

            <CardContent className="p-3 divide-y divide-slate-100">
              {isLoadingLive ? (
                <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Spinner size="sm" />
                  <span>Loading tasks...</span>
                </div>
              ) : attentionTasks.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-800">You&apos;re all caught up!</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    No overdue or urgent tasks requiring attention right now.
                  </p>
                </div>
              ) : (
                attentionTasks.map((task) => {
                  const now = Date.now();
                  const isOverdue = task.dueDate ? new Date(task.dueDate).getTime() < now : false;
                  const projectObj = projectMap.get(task.projectId);

                  return (
                    <div
                      key={task._id}
                      onClick={() => {
                        if (onNavigateToTask) {
                          onNavigateToTask(task.projectId, task._id);
                        } else {
                          onNavigateToTasks();
                        }
                      }}
                      className="py-3 px-2.5 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer flex items-start justify-between gap-3 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <TaskPriorityBadge priority={task.priority} />
                          {isOverdue && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                              Overdue
                            </span>
                          )}
                          {projectObj && (
                            <span className="text-[10px] font-mono text-slate-500 font-medium">
                              [{projectObj.key}]
                            </span>
                          )}
                        </div>
                        <h5 className="text-xs font-semibold text-slate-900 group-hover:text-primary transition-colors leading-snug line-clamp-1">
                          {task.title}
                        </h5>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className={isOverdue ? 'text-rose-600 font-semibold' : ''}>
                            {task.dueDate
                              ? `Due ${new Date(task.dueDate).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                })}`
                              : 'No due date'}
                          </span>
                        </div>
                      </div>

                      {task.assignee && (
                        <Avatar name={task.assignee.fullName} size="xs" className="shrink-0 mt-0.5" />
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-bold text-slate-900">
                  Recent Activity
                </CardTitle>
              </div>
              {onNavigateToActivity && (
                <button
                  type="button"
                  onClick={onNavigateToActivity}
                  className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>View All</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </CardHeader>

            <CardContent className="p-4 space-y-3.5">
              {isLoadingLive ? (
                <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Spinner size="sm" />
                  <span>Loading recent activity...</span>
                </div>
              ) : liveActivity.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No recent activity recorded yet across your projects.
                </div>
              ) : (
                liveActivity.map((act) => {
                  const actorName = act.actor?.fullName || 'Team Member';
                  const entityLabel =
                    (act.metadata?.title as string) ||
                    (act.metadata?.name as string) ||
                    act.entityType;
                  const timeFormatted = formatTimeAgo(act.createdAt);

                  return (
                    <div key={act._id} className="flex items-start gap-2.5 text-xs">
                      <Avatar name={actorName} size="xs" className="mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0 leading-snug">
                        <span className="font-semibold text-slate-900">{actorName}</span>{' '}
                        <span className="text-slate-500">{formatActivityAction(act.action)}</span>{' '}
                        <span className="font-semibold text-slate-900 truncate inline-block max-w-[130px] align-bottom">
                          {entityLabel}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {timeFormatted}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
