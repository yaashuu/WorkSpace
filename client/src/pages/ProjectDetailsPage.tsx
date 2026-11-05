import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Users,
  UserPlus,
  Mail,
  Lock,
  Globe,
  Settings2,
  AlertCircle,
  Crown,
  RefreshCw,
  Layers,
  MessageSquare,
  ArrowRight,
  ListTodo,
} from 'lucide-react';
import { Card, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Avatar } from '../components/ui/Avatar';
import { MembersList } from '../components/projects/MembersList';
import { JoinRequestsList } from '../components/projects/JoinRequestsList';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { EditProjectModal } from '../components/projects/EditProjectModal';
import { ReassignManagerModal } from '../components/projects/ReassignManagerModal';
import { CreateInvitationModal } from '../components/projects/CreateInvitationModal';
import { projectApi } from '../lib/projectApi';
import { taskApi } from '../lib/taskApi';
import { ApiClientError } from '../lib/api';
import { DetailedProject, PublicProjectMetadata, ProjectMember, isDetailedProject } from '../types/project';
import { Task } from '../types/task';
import { AuthUser } from '../types/auth';

export interface ProjectDetailsPageProps {
  projectId: string;
  currentUser: AuthUser;
  initialTab?: 'OVERVIEW' | 'KANBAN' | 'MEMBERS' | 'REQUESTS';
  initialTaskId?: string | null;
  onBackToProjects: () => void;
  onNavigateToChat?: (projectId: string) => void;
  onTriggerToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

export const ProjectDetailsPage: React.FC<ProjectDetailsPageProps> = ({
  projectId,
  currentUser,
  initialTab = 'OVERVIEW',
  initialTaskId,
  onBackToProjects,
  onNavigateToChat,
  onTriggerToast,
}) => {
  const [project, setProject] = useState<DetailedProject | PublicProjectMetadata | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'KANBAN' | 'MEMBERS' | 'REQUESTS'>(initialTab);

  // Modals State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Non-member request state
  const [isRequestingJoin, setIsRequestingJoin] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);

  // Refresh trigger for child lists
  const [refreshKey, setRefreshKey] = useState(0);

  const isAdmin = currentUser.globalRole === 'ADMIN';

  const loadProject = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await projectApi.getProjectById(projectId);
      setProject(data);

      if (isDetailedProject(data)) {
        // Fetch members and tasks in parallel for summary overview
        const [membersRes, tasksRes] = await Promise.all([
          projectApi.getProjectMembers(projectId).catch(() => []),
          taskApi.getProjectTasks(projectId).catch(() => []),
        ]);
        setMembers(membersRes);
        setTasks(tasksRes);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load project details');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [projectId, refreshKey]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-500 gap-3">
        <Spinner size="lg" />
        <span className="text-xs font-medium">Loading project workstream details...</span>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBackToProjects} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
          Back to Projects
        </Button>
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-red-700 text-sm font-semibold">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span>{error || 'Project not found'}</span>
          </div>
          <p className="text-xs text-slate-500">
            This project may be PRIVATE or your account may not possess member access.
          </p>
          <Button size="sm" variant="outline" onClick={onBackToProjects}>
            Return to Directory
          </Button>
        </div>
      </div>
    );
  }

  const hasDetailedAccess = isDetailedProject(project);
  const detailedProject = hasDetailedAccess ? (project as DetailedProject) : null;
  const isPrimaryPM = hasDetailedAccess && detailedProject?.primaryManagerId === currentUser._id;
  const canManageWorkstream = isAdmin || isPrimaryPM;
  const pmName = project.primaryManager?.fullName || 'Assigned Manager';
  const pmEmail = (project.primaryManager as any)?.email;

  // Handle Non-Member Public Join Request
  const handlePublicJoinRequest = async () => {
    setIsRequestingJoin(true);
    try {
      await projectApi.submitJoinRequest(project._id);
      setHasRequested(true);
      onTriggerToast(
        'success',
        'Join Request Submitted',
        `Your request to join "${project.name}" has been sent to the Project Manager.`
      );
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'DUPLICATE_PENDING_REQUEST') {
        setHasRequested(true);
        onTriggerToast('info', 'Request Pending', 'You already have a pending join request for this project.');
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to submit join request';
        onTriggerToast('error', 'Request Failed', msg);
      }
    } finally {
      setIsRequestingJoin(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Back Bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBackToProjects}
          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
          className="text-xs text-slate-600 hover:text-slate-900"
        >
          Back to Projects Directory
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadProject}
            leftIcon={<RefreshCw className="w-3.5 h-3.5 text-slate-400" />}
            className="text-xs text-slate-500"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Workstream Banner Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-card space-y-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-1 rounded-md font-mono text-xs font-bold bg-primary-50 text-primary border border-primary-200">
                {project.key}
              </span>

              <Badge variant={project.visibility === 'PUBLIC' ? 'primary' : 'neutral'} dot size="sm">
                {project.visibility === 'PUBLIC' ? (
                  <span className="flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Public Workstream
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Private Workstream
                  </span>
                )}
              </Badge>

              {detailedProject && detailedProject.status === 'ARCHIVED' && (
                <Badge variant="neutral" size="sm">
                  Archived
                </Badge>
              )}

              {isPrimaryPM && (
                <Badge variant="primary" size="sm" className="gap-1">
                  <Crown className="w-3 h-3 text-primary" />
                  You are Primary PM
                </Badge>
              )}
            </div>

            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {project.name}
            </h1>

            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              {project.description || 'No description provided for this workstream.'}
            </p>
          </div>

          {/* Action Buttons for Authorized Roles */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {hasDetailedAccess && (
              <Button
                variant={activeTab === 'KANBAN' ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => setActiveTab('KANBAN')}
                leftIcon={<Layers className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                Kanban Board
              </Button>
            )}

            {hasDetailedAccess && onNavigateToChat && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateToChat(project._id)}
                leftIcon={<MessageSquare className="w-3.5 h-3.5 text-primary" />}
                className="text-xs"
              >
                Project Chat
              </Button>
            )}

            {canManageWorkstream && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsInviteModalOpen(true)}
                leftIcon={<Mail className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                Invite Member
              </Button>
            )}

            {isAdmin && detailedProject && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsReassignModalOpen(true)}
                  leftIcon={<Crown className="w-3.5 h-3.5" />}
                  className="text-xs"
                >
                  Reassign PM
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditModalOpen(true)}
                  leftIcon={<Settings2 className="w-3.5 h-3.5" />}
                  className="text-xs"
                >
                  Settings
                </Button>
              </>
            )}

            {/* Non-member Public Project CTA */}
            {!hasDetailedAccess && project.visibility === 'PUBLIC' && (
              <Button
                variant={hasRequested ? 'secondary' : 'primary'}
                size="md"
                disabled={hasRequested || isRequestingJoin}
                onClick={handlePublicJoinRequest}
                isLoading={isRequestingJoin}
                leftIcon={<UserPlus className="w-3.5 h-3.5" />}
              >
                {hasRequested ? 'Join Request Pending' : 'Request to Join Workstream'}
              </Button>
            )}
          </div>
        </div>

        {/* Workstream Quick Facts Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 border-t border-slate-100 text-xs">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Primary Manager
            </span>
            <span className="font-bold text-slate-800 truncate block">{pmName}</span>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Created Date
            </span>
            <span className="font-bold text-slate-800">
              {new Date(project.createdAt).toLocaleDateString()}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Visibility Scope
            </span>
            <span className="font-bold text-slate-800">{project.visibility}</span>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Active Team
            </span>
            <span className="font-bold text-slate-800">
              {members.length > 0 ? `${members.length} Member${members.length === 1 ? '' : 's'}` : '1 Manager'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Tasks
            </span>
            <span className="font-bold text-slate-800">
              {tasks.length} Task{tasks.length === 1 ? '' : 's'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Your Access Level
            </span>
            <span className="font-bold text-primary truncate block">
              {isAdmin
                ? 'Org Administrator'
                : isPrimaryPM
                ? 'Primary PM'
                : hasDetailedAccess
                ? 'Active Member'
                : 'Public Discoverer'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation for Detailed Members / PMs / Admins */}
      {hasDetailedAccess ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('OVERVIEW')}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'OVERVIEW'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Workstream Overview
            </button>

            <button
              onClick={() => setActiveTab('KANBAN')}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'KANBAN'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Kanban Board</span>
              {tasks.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                  {tasks.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('MEMBERS')}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'MEMBERS'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Project Team</span>
              {members.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                  {members.length}
                </span>
              )}
            </button>

            {canManageWorkstream && (
              <button
                onClick={() => setActiveTab('REQUESTS')}
                className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'REQUESTS'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Join Requests</span>
              </button>
            )}
          </div>

          {/* Tab 1: Overview */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-5">
              {/* Top Row: PM & Governance */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Primary Manager Card */}
                <Card className="p-5 space-y-3">
                  <CardTitle className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Primary Project Manager
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <Avatar name={pmName} size="lg" />
                    <div>
                      <div className="text-sm font-bold text-slate-900">{pmName}</div>
                      {pmEmail && <div className="text-xs text-slate-500">{pmEmail}</div>}
                      <div className="text-[11px] text-primary font-semibold mt-0.5">
                        Designated Manager (Spec 4.2)
                      </div>
                    </div>
                  </div>
                  {isAdmin && detailedProject && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsReassignModalOpen(true)}
                      className="w-full text-xs mt-2"
                    >
                      Reassign Primary PM
                    </Button>
                  )}
                </Card>

                {/* Workstream Governance Card */}
                <Card className="p-5 space-y-3 md:col-span-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Workstream Governance & Scope
                  </CardTitle>
                  <div className="space-y-2 text-xs text-slate-600">
                    <p>
                      <strong>Project Key:</strong> <code>{project.key}</code> — Prefix for all tasks in this workstream.
                    </p>
                    <p>
                      <strong>Visibility Policy:</strong>{' '}
                      {project.visibility === 'PUBLIC'
                        ? 'PUBLIC — Non-members may discover this workstream in the directory and request access.'
                        : 'PRIVATE — Strictly invisible in the public directory; joining requires an authorized invitation.'}
                    </p>
                    <p>
                      <strong>Integrated Capabilities:</strong> Live Kanban Board, Project Team Governance, and Real-Time Workstream Chat are fully connected to this project.
                    </p>
                  </div>
                </Card>
              </div>

              {/* Second Row: Team Preview & Tasks Preview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Project Team Card */}
                <Card className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-500" />
                      <h3 className="text-xs uppercase tracking-wider text-slate-700 font-bold">
                        Project Team ({members.length})
                      </h3>
                    </div>
                    {canManageWorkstream && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsInviteModalOpen(true)}
                        leftIcon={<UserPlus className="w-3.5 h-3.5 text-primary" />}
                        className="text-[11px] text-primary p-0 h-auto hover:bg-transparent"
                      >
                        Invite
                      </Button>
                    )}
                  </div>

                  {members.length === 0 ? (
                    <div className="text-xs text-slate-400 py-3 text-center">
                      No additional members yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {members.slice(0, 4).map((m) => {
                        const user = m.user;
                        if (!user) return null;
                        return (
                          <div key={m._id} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Avatar name={user.fullName} size="sm" />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-800 truncate">
                                  {user.fullName}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {user.email}
                                </div>
                              </div>
                            </div>
                            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {m.isPrimaryManager ? 'Primary PM' : 'Member'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('MEMBERS')}
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    className="w-full text-xs"
                  >
                    View Project Team ({members.length})
                  </Button>
                </Card>

                {/* Tasks & Kanban Summary Card */}
                <Card className="p-5 space-y-4 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ListTodo className="w-4 h-4 text-slate-500" />
                      <h3 className="text-xs uppercase tracking-wider text-slate-700 font-bold">
                        Kanban Tasks & Status ({tasks.length})
                      </h3>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setActiveTab('KANBAN')}
                      rightIcon={<ArrowRight className="w-3.5 h-3.5 text-primary" />}
                      className="text-[11px] text-primary p-0 h-auto hover:bg-transparent"
                    >
                      Open Board
                    </Button>
                  </div>

                  {/* Status Breakdown Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">TODO</span>
                      <span className="text-sm font-bold text-slate-700">
                        {tasks.filter((t) => t.status === 'TODO').length}
                      </span>
                    </div>
                    <div className="bg-blue-50/60 rounded-lg p-2.5 border border-blue-100 text-center">
                      <span className="text-[10px] uppercase font-bold text-blue-500 block">In Progress</span>
                      <span className="text-sm font-bold text-blue-700">
                        {tasks.filter((t) => t.status === 'IN_PROGRESS').length}
                      </span>
                    </div>
                    <div className="bg-amber-50/60 rounded-lg p-2.5 border border-amber-100 text-center">
                      <span className="text-[10px] uppercase font-bold text-amber-500 block">Testing</span>
                      <span className="text-sm font-bold text-amber-700">
                        {tasks.filter((t) => t.status === 'TESTING').length}
                      </span>
                    </div>
                    <div className="bg-emerald-50/60 rounded-lg p-2.5 border border-emerald-100 text-center">
                      <span className="text-[10px] uppercase font-bold text-emerald-500 block">Done</span>
                      <span className="text-sm font-bold text-emerald-700">
                        {tasks.filter((t) => t.status === 'DONE').length}
                      </span>
                    </div>
                  </div>

                  {/* Tasks Preview List */}
                  {tasks.length === 0 ? (
                    <div className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-xl">
                      No tasks created for this workstream yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tasks.slice(0, 3).map((task) => (
                        <div
                          key={task._id}
                          onClick={() => setActiveTab('KANBAN')}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 hover:bg-slate-100/80 transition-colors cursor-pointer border border-slate-100"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
                              {project.key}
                            </Badge>
                            <span className="text-xs font-semibold text-slate-800 truncate">
                              {task.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant={
                                task.status === 'DONE'
                                  ? 'success'
                                  : task.status === 'IN_PROGRESS'
                                  ? 'primary'
                                  : task.status === 'TESTING'
                                  ? 'warning'
                                  : 'neutral'
                              }
                              size="sm"
                            >
                              {task.status}
                            </Badge>
                            {task.assignee && (
                              <span className="text-[11px] text-slate-500 hidden sm:inline">
                                {task.assignee.fullName}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setActiveTab('KANBAN')}
                    leftIcon={<Layers className="w-3.5 h-3.5" />}
                    className="w-full text-xs"
                  >
                    Open Live Kanban Board
                  </Button>
                </Card>
              </div>
            </div>
          )}

          {/* Tab 2: Live Kanban Board */}
          {activeTab === 'KANBAN' && (
            <KanbanBoard
              projectId={project._id}
              projectKey={project.key}
              currentUser={currentUser}
              isAdmin={isAdmin}
              isPrimaryManager={isPrimaryPM}
              initialSelectedTaskId={initialTaskId}
              onTriggerToast={onTriggerToast}
            />
          )}

          {/* Tab 3: Members List */}
          {activeTab === 'MEMBERS' && (
            <MembersList
              key={`members-${refreshKey}`}
              projectId={project._id}
              currentUser={currentUser}
              isPrimaryManager={isPrimaryPM}
              isAdmin={isAdmin}
              onTriggerToast={onTriggerToast}
            />
          )}

          {/* Tab 3: Join Requests */}
          {activeTab === 'REQUESTS' && canManageWorkstream && (
            <JoinRequestsList
              key={`requests-${refreshKey}`}
              projectId={project._id}
              onMemberAdded={() => setRefreshKey((k) => k + 1)}
              onTriggerToast={onTriggerToast}
            />
          )}
        </div>
      ) : (
        /* Non-Member Public View */
        <Card className="p-8 text-center max-w-xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary flex items-center justify-center mx-auto">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Discoverable Public Project</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
              You are currently viewing public directory metadata. You must be an approved member
              to access internal resources, tasks, and discussions.
            </p>
          </div>
          <Button
            variant={hasRequested ? 'secondary' : 'primary'}
            disabled={hasRequested || isRequestingJoin}
            onClick={handlePublicJoinRequest}
            isLoading={isRequestingJoin}
            leftIcon={<UserPlus className="w-3.5 h-3.5" />}
          >
            {hasRequested ? 'Join Request Pending Review' : 'Submit Join Request'}
          </Button>
        </Card>
      )}

      {/* Edit Project Modal */}
      {isAdmin && detailedProject && (
        <EditProjectModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          project={detailedProject}
          onProjectUpdated={(updated) => setProject(updated)}
          onTriggerToast={onTriggerToast}
        />
      )}

      {/* Reassign PM Modal */}
      {isAdmin && detailedProject && (
        <ReassignManagerModal
          isOpen={isReassignModalOpen}
          onClose={() => setIsReassignModalOpen(false)}
          project={detailedProject}
          onManagerReassigned={(updated) => {
            setProject(updated);
            setRefreshKey((k) => k + 1);
          }}
          onTriggerToast={onTriggerToast}
        />
      )}

      {/* Create Invitation Modal */}
      {canManageWorkstream && (
        <CreateInvitationModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          projectId={project._id}
          projectName={project.name}
          onTriggerToast={onTriggerToast}
        />
      )}
    </div>
  );
};
