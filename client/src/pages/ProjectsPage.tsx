import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Plus,
  Users,
  Calendar,
  Lock,
  Globe,
  UserPlus,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Search,
  Mail,
  Link2,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Avatar } from '../components/ui/Avatar';
import { projectApi } from '../lib/projectApi';
import { ApiClientError } from '../lib/api';
import { ProjectItem, isDetailedProject } from '../types/project';
import { AuthUser } from '../types/auth';

export interface ProjectsPageProps {
  currentUser: AuthUser;
  onOpenNewProjectModal: () => void;
  onSelectProject: (projectId: string) => void;
  onTriggerToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  currentUser,
  onOpenNewProjectModal,
  onSelectProject,
  onTriggerToast,
}) => {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterMode, setFilterMode] = useState<'ALL' | 'JOINED' | 'PUBLIC'>('ALL');
  const [searchFilter, setSearchFilter] = useState('');

  // Join Request pending tracking
  const [requestingProjectId, setRequestingProjectId] = useState<string | null>(null);
  const [requestedProjectIds, setRequestedProjectIds] = useState<Set<string>>(new Set());

  // Join project by invitation link state
  const [inviteUrl, setInviteUrl] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  const isAdmin = currentUser.globalRole === 'ADMIN';

  // Helper to extract and validate token from an invitation link
  const extractInvitationToken = (rawInput: string): { token?: string; error?: string } => {
    const input = rawInput.trim();
    if (!input) {
      return { error: 'Please enter an invitation link.' };
    }

    try {
      let parsedUrl: URL;
      if (input.startsWith('/') || input.startsWith('?')) {
        parsedUrl = new URL(input, window.location.origin);
      } else if (/^https?:\/\//i.test(input)) {
        parsedUrl = new URL(input);
      } else if (input.includes('/invite') || input.includes('/invitations')) {
        parsedUrl = new URL(`http://${input}`);
      } else {
        return {
          error: 'Invalid invitation link format. Please paste a valid invitation URL (e.g. /invite?token=...).',
        };
      }

      // Validate that the URL belongs to expected WorkSpace invitation routes
      const pathname = parsedUrl.pathname.toLowerCase().replace(/\/+$/, '');
      const isExpectedRoute =
        pathname === '/invite' ||
        pathname === '/invitations/accept' ||
        pathname.startsWith('/invite') ||
        pathname.startsWith('/invitations');

      if (!isExpectedRoute) {
        return {
          error: 'The provided URL is not a valid WorkSpace invitation route (expected /invite?token=...).',
        };
      }

      const token = parsedUrl.searchParams.get('token');
      if (!token || !token.trim()) {
        return {
          error: 'The invitation link does not contain a valid invitation token.',
        };
      }

      return { token: token.trim() };
    } catch {
      return {
        error: 'Invalid URL. Please check the invitation link and try again.',
      };
    }
  };

  const handleJoinProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    setJoinSuccess(null);

    const { token, error: parseError } = extractInvitationToken(inviteUrl);
    if (parseError || !token) {
      setJoinError(parseError || 'Invalid invitation link.');
      onTriggerToast('error', 'Invalid Link', parseError || 'Invalid invitation link.');
      return;
    }

    setIsJoining(true);
    try {
      const result = await projectApi.acceptInvitation(token);
      const successMsg = `You have successfully joined "${result.project.name}".`;
      setJoinSuccess(successMsg);
      onTriggerToast('success', 'Joined Project', successMsg);
      setInviteUrl('');
      await loadProjects();
    } catch (err) {
      let msg = 'Failed to accept invitation. Please verify the link.';
      if (err instanceof ApiClientError) {
        if (err.code === 'ALREADY_MEMBER') {
          msg = 'You are already an active member of this project.';
        } else if (err.code === 'FORBIDDEN_EMAIL_MISMATCH') {
          msg = `This invitation is restricted to a different email address. You are signed in as ${currentUser.email}.`;
        } else if (err.code === 'INVITATION_EXPIRED') {
          msg = 'This invitation link has expired. Please request a new invitation.';
        } else if (err.code === 'INVITATION_REVOKED') {
          msg = 'This invitation has been revoked by the project manager.';
        } else if (err.code === 'INVITATION_EXHAUSTED') {
          msg = 'This invitation link has reached its maximum usage limit.';
        } else if (err.code === 'INVITATION_NOT_FOUND') {
          msg = 'Invitation not found. Please verify the invitation link.';
        } else if (err.isNetworkError) {
          msg = 'Unable to reach the server. Please check your network connection and retry.';
        } else {
          msg = err.message || msg;
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setJoinError(msg);
      onTriggerToast('error', 'Join Failed', msg);
    } finally {
      setIsJoining(false);
    }
  };

  const loadProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await projectApi.getProjects();
      setProjects(data);
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

  const handleRequestToJoin = async (project: ProjectItem) => {
    setRequestingProjectId(project._id);
    try {
      await projectApi.submitJoinRequest(project._id);
      setRequestedProjectIds((prev) => new Set(prev).add(project._id));
      onTriggerToast(
        'success',
        'Join Request Submitted',
        `Your request to join "${project.name}" has been sent to the Project Manager.`
      );
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'DUPLICATE_PENDING_REQUEST') {
        setRequestedProjectIds((prev) => new Set(prev).add(project._id));
        onTriggerToast('info', 'Request Already Pending', 'You already have a pending join request for this project.');
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to submit join request';
        onTriggerToast('error', 'Request Failed', msg);
      }
    } finally {
      setRequestingProjectId(null);
    }
  };

  // Filter projects by tab and search
  const filteredProjects = projects.filter((p) => {
    // 1. Tab filtering
    if (filterMode === 'JOINED') {
      if (!isDetailedProject(p)) return false;
    } else if (filterMode === 'PUBLIC') {
      if (p.visibility !== 'PUBLIC') return false;
    }

    // 2. Search query filtering
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(q);
      const matchKey = p.key.toLowerCase().includes(q);
      const matchDesc = p.description.toLowerCase().includes(q);
      return matchName || matchKey || matchDesc;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-primary" />
            Projects Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAdmin
              ? 'Organization Administrator overview across all public and private workstreams.'
              : 'Browse assigned team projects, managed workstreams, and discoverable public projects.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadProjects}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenNewProjectModal}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              New Project
            </Button>
          )}
        </div>
      </div>

      {/* Join a Project Section */}
      <Card className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-primary-50/20 border border-slate-200/90 rounded-2xl shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              Join a Project
            </h3>
            <p className="text-xs text-slate-500">
              Have an invitation link for a team workstream? Paste it below to join the project immediately.
            </p>
          </div>

          <form
            onSubmit={handleJoinProject}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto lg:min-w-[500px]"
          >
            <div className="relative flex-1">
              <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Paste your project invitation link"
                value={inviteUrl}
                onChange={(e) => {
                  setInviteUrl(e.target.value);
                  if (joinError) setJoinError(null);
                  if (joinSuccess) setJoinSuccess(null);
                }}
                disabled={isJoining}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-slate-900 placeholder:text-slate-400 shadow-inner-xs"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isJoining}
              disabled={isJoining}
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
              className="shrink-0 text-xs px-4"
            >
              Join Project
            </Button>
          </form>
        </div>

        {joinError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="font-medium">{joinError}</span>
          </div>
        )}

        {joinSuccess && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{joinSuccess}</span>
          </div>
        )}
      </Card>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterMode === 'ALL'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
            }`}
          >
            All Visible ({projects.length})
          </button>

          <button
            onClick={() => setFilterMode('JOINED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterMode === 'JOINED'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
            }`}
          >
            {isAdmin ? 'Managed / All Active' : 'My Projects'}
          </button>

          <button
            onClick={() => setFilterMode('PUBLIC')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterMode === 'PUBLIC'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
            }`}
          >
            Public Directory
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, key, or desc..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full h-8.5 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-500 gap-3">
          <Spinner size="lg" />
          <span className="text-xs font-medium">Fetching projects from WorkSpace API...</span>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-red-700 text-sm font-semibold">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="outline" onClick={loadProjects}>
            Try Again
          </Button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="w-6 h-6" />}
          title={searchFilter ? 'No matching projects' : 'No projects found'}
          description={
            searchFilter
              ? `No workstreams match "${searchFilter}". Try adjusting your query.`
              : isAdmin
              ? 'No projects exist yet. Click "New Project" to create your organization\'s first workstream.'
              : 'You have not joined any workstreams yet, and no public projects are discoverable.'
          }
          actionLabel={isAdmin && !searchFilter ? 'Create First Project' : undefined}
          onAction={isAdmin && !searchFilter ? onOpenNewProjectModal : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => {
            const hasDetailedAccess = isDetailedProject(project);
            const isPM =
              hasDetailedAccess &&
              project.primaryManagerId === currentUser._id;
            const pmName =
              project.primaryManager?.fullName ||
              (hasDetailedAccess ? 'Assigned PM' : 'Manager');
            const isPublicNonMember = !hasDetailedAccess && project.visibility === 'PUBLIC';
            const isRequested = requestedProjectIds.has(project._id);
            const isRequesting = requestingProjectId === project._id;

            return (
              <Card
                key={project._id}
                hoverable
                className="flex flex-col justify-between border-slate-200/80 hover:border-primary-200 transition-all shadow-xs hover:shadow-card"
              >
                <CardHeader className="py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-primary-50 text-primary border border-primary-200">
                          {project.key}
                        </span>
                        {hasDetailedAccess && project.status === 'ARCHIVED' && (
                          <Badge variant="neutral" size="sm">
                            Archived
                          </Badge>
                        )}
                        {isPM && (
                          <Badge variant="primary" size="sm">
                            Primary PM
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-sm font-bold text-slate-900 truncate">
                        {project.name}
                      </CardTitle>
                    </div>

                    <Badge
                      variant={project.visibility === 'PUBLIC' ? 'primary' : 'neutral'}
                      dot
                      size="sm"
                    >
                      {project.visibility === 'PUBLIC' ? (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          Public
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Private
                        </span>
                      )}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-3 flex-1 flex flex-col justify-between">
                  <p className="text-xs text-slate-600 line-clamp-2 min-h-8">
                    {project.description || 'No description provided.'}
                  </p>

                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    {/* Primary Manager & Metadata */}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <Avatar name={pmName} size="sm" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">
                            Primary PM
                          </span>
                          <span className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
                            {pmName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Member Count & Action Buttons */}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {!hasDetailedAccess
                          ? `${(project as any).activeMemberCount || 0} members`
                          : 'Team Workstream'}
                      </span>

                      {/* Action CTA */}
                      {hasDetailedAccess ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSelectProject(project._id)}
                          className="text-xs h-8 text-primary border-primary-200 hover:bg-primary-50"
                          rightIcon={<ArrowRight className="w-3 h-3" />}
                        >
                          View Workstream
                        </Button>
                      ) : isPublicNonMember ? (
                        <Button
                          size="sm"
                          variant={isRequested ? 'secondary' : 'primary'}
                          disabled={isRequested || isRequesting}
                          onClick={() => handleRequestToJoin(project)}
                          isLoading={isRequesting}
                          className="text-xs h-8"
                          leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                        >
                          {isRequested ? 'Requested' : 'Request to Join'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
