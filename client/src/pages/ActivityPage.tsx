import React, { useState, useEffect } from 'react';
import {
  Activity,
  Filter,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/EmptyState';
import { activityApi } from '../lib/activityApi';
import { projectApi } from '../lib/projectApi';
import { ActivityLogResponse, ActivityEntityType } from '../types/activity';
import { ProjectItem, isDetailedProject } from '../types/project';
import { ApiClientError } from '../lib/api';

export interface ActivityPageProps {
  initialProjectId?: string | null;
  onTriggerToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

const formatActionName = (action: string): string => {
  switch (action) {
    case 'PROJECT_CREATED':
      return 'created the project';
    case 'VISIBILITY_CHANGED':
      return 'changed project visibility';
    case 'MANAGER_REPLACED':
      return 'reassigned the primary project manager';
    case 'TASK_CREATED':
      return 'created a new task';
    case 'TASK_UPDATED':
      return 'updated task details';
    case 'TASK_MOVED':
      return 'moved task status';
    case 'TASK_DELETED':
      return 'deleted a task';
    case 'COMMENT_ADDED':
      return 'posted a comment';
    case 'MEMBER_JOINED':
      return 'joined the project workstream';
    case 'MEMBER_REMOVED':
      return 'revoked project membership';
    case 'INVITATION_CREATED':
      return 'issued a project invitation';
    default:
      return action.toLowerCase().replace(/_/g, ' ');
  }
};

const getEntityBadgeVariant = (type: ActivityEntityType) => {
  switch (type) {
    case 'PROJECT':
      return 'primary';
    case 'TASK':
      return 'info';
    case 'MEMBERSHIP':
      return 'warning';
    case 'INVITATION':
      return 'neutral';
    default:
      return 'neutral';
  }
};

export const ActivityPage: React.FC<ActivityPageProps> = ({
  initialProjectId,
  onTriggerToast,
}) => {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [logs, setLogs] = useState<ActivityLogResponse[]>([]);
  const [entityFilter, setEntityFilter] = useState<ActivityEntityType | ''>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // 1. Fetch accessible projects
  useEffect(() => {
    async function loadProjects() {
      setIsLoadingProjects(true);
      try {
        const data = await projectApi.getProjects();
        const accessible = data.filter(isDetailedProject);
        setProjects(accessible);

        if (initialProjectId && accessible.some((p) => p._id === initialProjectId)) {
          setSelectedProjectId(initialProjectId);
        } else if (accessible.length > 0) {
          setSelectedProjectId(accessible[0]._id);
        }
      } catch (err) {
        const msg = err instanceof ApiClientError ? err.message : 'Failed to load projects';
        onTriggerToast('error', 'Project Load Error', msg);
      } finally {
        setIsLoadingProjects(false);
      }
    }

    loadProjects();
  }, [initialProjectId]);

  // 2. Fetch activity logs whenever project, filter, or page changes
  const loadActivityLogs = async () => {
    if (!selectedProjectId) return;
    setIsLoadingLogs(true);
    try {
      const data = await activityApi.getProjectActivity(selectedProjectId, {
        page,
        limit: 25,
        entityType: entityFilter || undefined,
      });
      setLogs(data.activityLogs);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.total);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to load activity feed';
      onTriggerToast('error', 'Activity Error', msg);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadActivityLogs();
  }, [selectedProjectId, entityFilter, page]);

  const selectedProject = projects.find((p) => p._id === selectedProjectId);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary flex items-center justify-center font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Project Activity Stream
              {totalCount > 0 && (
                <Badge variant="neutral" size="sm">
                  {totalCount} events
                </Badge>
              )}
            </h2>
            <p className="text-xs text-slate-500">
              Complete chronological audit trail of project creation, task movements, and membership changes.
            </p>
          </div>
        </div>

        {/* Project Selector & Refresh */}
        <div className="flex items-center gap-2.5">
          {isLoadingProjects ? (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Spinner size="sm" />
              <span>Loading projects...</span>
            </div>
          ) : (
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setPage(1);
              }}
              className="h-8.5 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium cursor-pointer max-w-xs"
            >
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={loadActivityLogs}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Entity Filters Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
        <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          Filter:
        </span>

        {(['', 'TASK', 'PROJECT', 'MEMBERSHIP', 'INVITATION'] as const).map((filterVal) => {
          const isActive = entityFilter === filterVal;
          const label = filterVal === '' ? 'All Events' : filterVal.charAt(0) + filterVal.slice(1).toLowerCase();
          return (
            <button
              key={filterVal}
              onClick={() => {
                setEntityFilter(filterVal);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                isActive
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Activity Timeline List */}
      <Card className="p-6">
        <CardHeader className="p-0 pb-4 mb-4 border-b border-slate-100 flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Audit History for {selectedProject?.name || 'Selected Project'}
          </CardTitle>

          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1 || isLoadingLogs}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages || isLoadingLogs}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {isLoadingLogs ? (
            <div className="flex flex-col items-center justify-center p-16 text-slate-400 gap-2">
              <Spinner size="lg" />
              <span className="text-xs">Fetching audit logs from WorkSpace API...</span>
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={<Inbox className="w-8 h-8" />}
              title="No activity recorded"
              description="Actions performed in this project will automatically appear on this audit stream."
            />
          ) : (
            <div className="space-y-6 relative border-l-2 border-slate-100 pl-6 ml-4 my-2">
              {logs.map((log) => {
                const actorName = log.actor?.fullName || 'System User';
                const actionDesc = formatActionName(log.action);
                const timeString = new Date(log.createdAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                // Extract friendly target description from metadata
                const metadataTitle =
                  (log.metadata?.title as string) ||
                  (log.metadata?.name as string) ||
                  (log.metadata?.newRole as string) ||
                  '';

                return (
                  <div key={log._id} className="relative group text-xs">
                    {/* Timeline bullet dot */}
                    <span className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-white border-2 border-primary group-hover:scale-110 transition-transform shadow-xs" />

                    <div className="flex items-start justify-between gap-3 bg-slate-50/60 p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                      <div className="flex items-start gap-3">
                        <Avatar
                          name={actorName}
                          src={log.actor?.avatarUrl || undefined}
                          size="sm"
                          className="shrink-0 mt-0.5"
                        />
                        <div className="space-y-1">
                          <p className="text-slate-800 leading-snug">
                            <strong className="font-bold text-slate-900">{actorName}</strong>{' '}
                            <span className="text-slate-600">{actionDesc}</span>{' '}
                            {metadataTitle && (
                              <span className="font-semibold text-primary">
                                &ldquo;{metadataTitle}&rdquo;
                              </span>
                            )}
                          </p>

                          <div className="flex items-center gap-2 pt-0.5">
                            <Badge variant={getEntityBadgeVariant(log.entityType)} size="sm">
                              {log.entityType}
                            </Badge>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {log.action}
                            </span>
                          </div>
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {timeString}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
