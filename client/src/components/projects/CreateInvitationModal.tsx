import React, { useState } from 'react';
import { Mail, Link2, Copy, Check, AlertCircle, ShieldCheck, Clock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { projectApi } from '../../lib/projectApi';
import { ApiClientError } from '../../lib/api';
import { CreateInvitationResponseData } from '../../types/project';

export interface CreateInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  onTriggerToast: (type: 'success' | 'error' | 'warning', title: string, message?: string) => void;
}

export const CreateInvitationModal: React.FC<CreateInvitationModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  onTriggerToast,
}) => {
  const [inviteType, setInviteType] = useState<'GENERAL' | 'EMAIL'>('GENERAL');
  const [invitedEmail, setInvitedEmail] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(7);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Result State (Displayed after token creation)
  const [createdResult, setCreatedResult] = useState<CreateInvitationResponseData | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleReset = () => {
    setInviteType('GENERAL');
    setInvitedEmail('');
    setMaxUses(1);
    setExpiresInDays(7);
    setError(null);
    setCreatedResult(null);
    setIsCopied(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (inviteType === 'EMAIL' && !invitedEmail.trim()) {
      setError('Please provide a valid email address for email-restricted invitation');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await projectApi.createInvitation({
        projectId,
        invitedEmail: inviteType === 'EMAIL' ? invitedEmail.trim().toLowerCase() : null,
        maxUses: inviteType === 'EMAIL' ? 1 : maxUses,
        expiresInDays,
      });

      setCreatedResult(data);
      onTriggerToast(
        'success',
        'Invitation Link Generated',
        inviteType === 'EMAIL'
          ? `Restricted invitation generated for ${invitedEmail.trim()}.`
          : `General invitation link created (max uses: ${maxUses}).`
      );
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to generate invitation');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!createdResult) return;
    const fullUrl = `${window.location.origin}${createdResult.inviteLink}`;
    navigator.clipboard.writeText(fullUrl);
    setIsCopied(true);
    onTriggerToast('success', 'Link Copied', 'Invitation URL copied to clipboard.');
    setTimeout(() => setIsCopied(false), 3000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={createdResult ? 'Invitation Link Ready' : 'Invite Members to Project'}
      description={
        createdResult
          ? `Share this secure link with intended team members to join "${projectName}".`
          : `Generate a cryptographically secure invitation token for "${projectName}".`
      }
      size="md"
      footer={
        createdResult ? (
          <Button variant="primary" onClick={handleClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerate}
              isLoading={isSubmitting}
              leftIcon={<Link2 className="w-3.5 h-3.5" />}
            >
              Generate Invitation
            </Button>
          </>
        )
      }
    >
      {createdResult ? (
        <div className="space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Secure 32-byte cryptographic token generated. Raw token is displayed once.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 tracking-wide select-none">
              Invitation Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}${createdResult.inviteLink}`}
                className="w-full h-9.5 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono select-all focus:outline-none"
              />
              <Button
                variant={isCopied ? 'secondary' : 'primary'}
                size="md"
                onClick={handleCopyLink}
                className="shrink-0"
                leftIcon={isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {isCopied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 text-slate-600">
            <div>
              <strong>Expires in:</strong> {expiresInDays} days ({new Date(createdResult.invitation.expiresAt).toLocaleDateString()})
            </div>
            <div>
              <strong>Usage limit:</strong> {createdResult.invitation.maxUses} use(s) (used: {createdResult.invitation.usedCount})
            </div>
            {createdResult.invitation.invitedEmail && (
              <div>
                <strong>Restricted to:</strong> {createdResult.invitation.invitedEmail}
              </div>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleGenerate} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Invitation Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 tracking-wide select-none">
              Invitation Restriction Mode (Spec 5.1)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setInviteType('GENERAL')}
                className={`p-3 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                  inviteType === 'GENERAL'
                    ? 'border-primary bg-primary-50/50 text-primary font-semibold ring-2 ring-primary/20'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 font-bold">
                  <Link2 className="w-3.5 h-3.5" />
                  <span>General Link</span>
                </div>
                <span className="text-[11px] text-slate-500 font-normal">
                  Shareable link with max usage count. Any authenticated user can join.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setInviteType('EMAIL')}
                className={`p-3 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                  inviteType === 'EMAIL'
                    ? 'border-primary bg-primary-50/50 text-primary font-semibold ring-2 ring-primary/20'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 font-bold">
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email-Restricted</span>
                </div>
                <span className="text-[11px] text-slate-500 font-normal">
                  Strictly tied to a specific email. Rejecting mismatching accounts.
                </span>
              </button>
            </div>
          </div>

          {inviteType === 'EMAIL' ? (
            <Input
              label="Recipient Email Address"
              type="email"
              placeholder="e.g. employee@company.com"
              value={invitedEmail}
              onChange={(e) => setInvitedEmail(e.target.value)}
              helperText="Only an authenticated user whose email exactly matches this address can accept this invitation."
              required
            />
          ) : (
            <div className="w-full flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 tracking-wide select-none">
                Maximum Number of Uses
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={maxUses}
                onChange={(e) => setMaxUses(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full h-9.5 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
              <p className="text-[11px] text-slate-400">
                Single-use (1) marks invitation accepted on first join. Multi-use allows N team members.
              </p>
            </div>
          )}

          {/* Expiration In Days */}
          <div className="w-full flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 tracking-wide select-none flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Token Expiration (Days)
            </label>
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(parseInt(e.target.value, 10))}
              className="w-full h-9.5 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors cursor-pointer"
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days (Standard)</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days (Maximum)</option>
            </select>
          </div>
        </form>
      )}
    </Modal>
  );
};
