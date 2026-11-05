import React, { useState, useEffect } from 'react';
import { Users, UserMinus, ShieldCheck, Crown, AlertCircle } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';
import { projectApi } from '../../lib/projectApi';
import { ApiClientError } from '../../lib/api';
import { ProjectMember } from '../../types/project';
import { AuthUser } from '../../types/auth';

export interface MembersListProps {
  projectId: string;
  currentUser: AuthUser;
  isPrimaryManager: boolean;
  isAdmin: boolean;
  onTriggerToast: (type: 'success' | 'error' | 'warning', title: string, message?: string) => void;
}

export const MembersList: React.FC<MembersListProps> = ({
  projectId,
  currentUser,
  isPrimaryManager,
  isAdmin,
  onTriggerToast,
}) => {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Removal state
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const canManageMembers = isAdmin || isPrimaryManager;

  const loadMembers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await projectApi.getProjectMembers(projectId);
      setMembers(data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch project members');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [projectId]);

  const handleConfirmRemove = async () => {
    if (!memberToRemove || !memberToRemove.user) return;

    setIsRemoving(true);
    try {
      await projectApi.removeProjectMember(projectId, memberToRemove.user._id);
      onTriggerToast(
        'success',
        'Member Removed',
        `${memberToRemove.user.fullName} was removed from the project.`
      );
      setMemberToRemove(null);
      await loadMembers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove member';
      onTriggerToast('error', 'Removal Failed', msg);
    } finally {
      setIsRemoving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 gap-2">
        <Spinner size="md" />
        <span className="text-xs">Loading project members...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-700">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
        <Button size="sm" variant="outline" onClick={loadMembers}>
          Retry
        </Button>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <EmptyState
        icon={<Users className="w-6 h-6" />}
        title="No members yet"
        description="This project currently has no active members."
      />
    );
  }

  return (
    <>
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-800">
              Active Project Team ({members.length})
            </span>
          </div>
          {canManageMembers && (
            <span className="text-[11px] text-slate-400">
              You have manager permissions to remove team members.
            </span>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {members.map((member) => {
            const user = member.user;
            if (!user) return null;

            const isCurrentAuthUser = user._id === currentUser._id;
            const isTargetPM = member.isPrimaryManager;

            return (
              <div
                key={member._id}
                className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={user.fullName} size="md" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {user.fullName}
                      </span>
                      {isCurrentAuthUser && (
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                          You
                        </span>
                      )}
                      {isTargetPM ? (
                        <Badge variant="primary" size="sm" className="gap-1">
                          <Crown className="w-3 h-3 text-primary" />
                          Primary PM
                        </Badge>
                      ) : user.globalRole === 'ADMIN' ? (
                        <Badge variant="neutral" size="sm" className="gap-1">
                          <ShieldCheck className="w-3 h-3 text-slate-500" />
                          Administrator
                        </Badge>
                      ) : (
                        <Badge variant="default" size="sm">
                          Team Member
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5">
                      <span>{user.email}</span>
                      <span>•</span>
                      <span>Joined {new Date(member.joinedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {canManageMembers && (
                  <div>
                    {isTargetPM ? (
                      <span className="text-[11px] font-medium text-slate-400 italic">
                        Primary Manager (Protected)
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setMemberToRemove(member)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs h-7"
                        leftIcon={<UserMinus className="w-3 h-3" />}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        title="Remove Member from Project"
        description="Are you sure you want to remove this member from the project workstream?"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setMemberToRemove(null)}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmRemove}
              isLoading={isRemoving}
            >
              Confirm Removal
            </Button>
          </>
        }
      >
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>{memberToRemove?.user?.fullName}</strong> will lose access to project tasks, group chat channels, and workstream resources immediately.
        </p>
      </Modal>
    </>
  );
};
