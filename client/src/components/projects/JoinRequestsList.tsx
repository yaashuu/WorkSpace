import React, { useState, useEffect } from 'react';
import { UserPlus, Check, X, AlertCircle, Clock } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';
import { projectApi } from '../../lib/projectApi';
import { ApiClientError } from '../../lib/api';
import { JoinRequest, JoinRequestUser } from '../../types/project';

export interface JoinRequestsListProps {
  projectId: string;
  onMemberAdded?: () => void;
  onTriggerToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

export const JoinRequestsList: React.FC<JoinRequestsListProps> = ({
  projectId,
  onMemberAdded,
  onTriggerToast,
}) => {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Approval / Rejection action state
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<JoinRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadRequests = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await projectApi.getProjectJoinRequests(projectId);
      setRequests(data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load join requests');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [projectId]);

  const handleApprove = async (request: JoinRequest) => {
    setProcessingId(request._id);
    try {
      await projectApi.approveJoinRequest(request._id);
      const applicantName =
        typeof request.userId === 'object' && request.userId
          ? (request.userId as JoinRequestUser).fullName
          : 'User';

      onTriggerToast(
        'success',
        'Join Request Approved',
        `${applicantName} was approved and added to the project.`
      );

      // Re-fetch requests and notify parent to refresh members
      await loadRequests();
      if (onMemberAdded) onMemberAdded();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'JOIN_REQUEST_ALREADY_RESOLVED') {
        onTriggerToast('warning', 'Already Resolved', 'This join request was already resolved.');
        await loadRequests();
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to approve join request';
        onTriggerToast('error', 'Approval Failed', msg);
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingRequest) return;

    setProcessingId(rejectingRequest._id);
    try {
      await projectApi.rejectJoinRequest(rejectingRequest._id, rejectionReason.trim());
      const applicantName =
        typeof rejectingRequest.userId === 'object' && rejectingRequest.userId
          ? (rejectingRequest.userId as JoinRequestUser).fullName
          : 'User';

      onTriggerToast('info', 'Join Request Rejected', `Request for ${applicantName} was rejected.`);
      setRejectingRequest(null);
      setRejectionReason('');
      await loadRequests();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'JOIN_REQUEST_ALREADY_RESOLVED') {
        onTriggerToast('warning', 'Already Resolved', 'This join request was already resolved.');
        setRejectingRequest(null);
        await loadRequests();
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to reject join request';
        onTriggerToast('error', 'Rejection Failed', msg);
      }
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 gap-2">
        <Spinner size="md" />
        <span className="text-xs">Loading pending join requests...</span>
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
        <Button size="sm" variant="outline" onClick={loadRequests}>
          Retry
        </Button>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<UserPlus className="w-6 h-6" />}
        title="No pending requests"
        description="There are currently no employee join requests awaiting manager review."
      />
    );
  }

  return (
    <>
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-slate-800">
              Pending Join Requests ({requests.length})
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Review and grant employee access to this workstream.
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {requests.map((req) => {
            const user = typeof req.userId === 'object' && req.userId ? req.userId : null;
            const applicantName = user?.fullName || 'Employee';
            const applicantEmail = user?.email || 'Registered User';
            const isProcessing = processingId === req._id;

            return (
              <div
                key={req._id}
                className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={applicantName} size="md" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">{applicantName}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{applicantEmail}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Requested {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isProcessing}
                    onClick={() => {
                      setRejectingRequest(req);
                      setRejectionReason('');
                    }}
                    className="text-slate-600 hover:text-red-700 hover:bg-red-50 text-xs h-8"
                    leftIcon={<X className="w-3.5 h-3.5" />}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    isLoading={isProcessing}
                    onClick={() => handleApprove(req)}
                    className="text-xs h-8"
                    leftIcon={<Check className="w-3.5 h-3.5" />}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reject Modal with Optional Reason */}
      <Modal
        isOpen={!!rejectingRequest}
        onClose={() => setRejectingRequest(null)}
        title="Reject Join Request"
        description="Provide an optional reason for rejecting this join request."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setRejectingRequest(null)}
              disabled={!!processingId}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmReject}
              isLoading={!!processingId}
            >
              Confirm Rejection
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-600">
            Rejecting request from{' '}
            <strong>
              {typeof rejectingRequest?.userId === 'object' && rejectingRequest?.userId
                ? rejectingRequest.userId.fullName
                : 'this user'}
            </strong>
            .
          </p>

          <div className="w-full flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 tracking-wide select-none">
              Rejection Reason (Optional)
            </label>
            <textarea
              rows={2}
              maxLength={300}
              placeholder="e.g. This project workstream is currently limited to core backend engineers."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-colors"
            />
          </div>
        </div>
      </Modal>
    </>
  );
};
