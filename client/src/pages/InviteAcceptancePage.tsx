import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { projectApi } from '../lib/projectApi';
import { ApiClientError } from '../lib/api';
import { AuthUser } from '../types/auth';

export interface InviteAcceptancePageProps {
  currentUser: AuthUser;
  onNavigateToProject: (projectId: string) => void;
  onNavigateToProjects: () => void;
  onTriggerToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

export const InviteAcceptancePage: React.FC<InviteAcceptancePageProps> = ({
  currentUser,
  onNavigateToProject,
  onNavigateToProjects,
  onTriggerToast,
}) => {
  const [token, setToken] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    projectName: string;
    projectId: string;
  } | null>(null);

  // Extract token from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const storedToken = sessionStorage.getItem('workspace_pending_invite_token');

    if (urlToken) {
      setToken(urlToken);
      sessionStorage.removeItem('workspace_pending_invite_token');
    } else if (storedToken) {
      setToken(storedToken);
      sessionStorage.removeItem('workspace_pending_invite_token');
    }
  }, []);

  const handleAccept = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!token.trim()) {
      setError('Please provide an invitation token');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await projectApi.acceptInvitation(token.trim());
      setSuccessData({
        projectName: result.project.name,
        projectId: result.project._id,
      });

      onTriggerToast(
        'success',
        'Joined Project Workstream',
        `You have successfully joined "${result.project.name}".`
      );
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'ALREADY_MEMBER') {
          setError('You are already an active member of this project.');
        } else if (err.code === 'FORBIDDEN_EMAIL_MISMATCH') {
          setError(
            `This invitation is restricted to a different email address. You are signed in as ${currentUser.email}.`
          );
        } else if (err.code === 'INVITATION_EXPIRED') {
          setError('This invitation link has expired. Please request a new invitation.');
        } else if (err.code === 'INVITATION_REVOKED') {
          setError('This invitation has been revoked by the project manager.');
        } else if (err.code === 'INVITATION_EXHAUSTED') {
          setError('This invitation link has reached its maximum usage limit.');
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to accept invitation');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 shadow-xl border-slate-200/80 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center text-white mx-auto shadow-md shadow-primary/20">
            <Mail className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            WorkSpace Team Invitation
          </h2>
          <p className="text-xs text-slate-500">
            Accept this invitation to join the project team as{' '}
            <strong className="text-slate-700">{currentUser.fullName}</strong> ({currentUser.email}).
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Invitation Error</span>
              <p className="leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {successData ? (
          <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-900">Welcome to the Team!</h3>
              <p className="text-xs text-emerald-700 mt-1">
                You are now an active member of <strong>"{successData.projectName}"</strong>.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => onNavigateToProject(successData.projectId)}
              className="w-full justify-center"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Go to Project Workstream
            </Button>
          </div>
        ) : (
          <form onSubmit={handleAccept} className="space-y-4">
            {!new URLSearchParams(window.location.search).get('token') && (
              <div className="w-full flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 tracking-wide select-none">
                  Invitation Token
                </label>
                <input
                  type="text"
                  placeholder="Paste 64-character token..."
                  value={token}
                  onChange={(e) => setToken(e.target.value.trim())}
                  className="w-full h-9.5 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  required
                />
              </div>
            )}

            <Button
              variant="primary"
              size="md"
              type="submit"
              isLoading={isSubmitting}
              disabled={!token}
              className="w-full justify-center"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Accept Invitation & Join
            </Button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onNavigateToProjects}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
              >
                Cancel and return to projects directory
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
};
