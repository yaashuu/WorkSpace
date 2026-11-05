import React, { useState, useEffect } from 'react';
import { UserCheck, AlertCircle, ShieldAlert } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { projectApi } from '../../lib/projectApi';
import { ApiClientError } from '../../lib/api';
import { EligibleManager, DetailedProject } from '../../types/project';

export interface ReassignManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: DetailedProject;
  onManagerReassigned: (updatedProject: DetailedProject) => void;
  onTriggerToast: (type: 'success' | 'error' | 'warning', title: string, message?: string) => void;
}

export const ReassignManagerModal: React.FC<ReassignManagerModalProps> = ({
  isOpen,
  onClose,
  project,
  onManagerReassigned,
  onTriggerToast,
}) => {
  const [managers, setManagers] = useState<EligibleManager[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [isLoadingManagers, setIsLoadingManagers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedManagerId('');
      setError(null);
      return;
    }

    let isMounted = true;
    const loadManagers = async () => {
      setIsLoadingManagers(true);
      setError(null);
      try {
        const eligible = await projectApi.getEligibleManagers();
        if (isMounted) {
          // Filter out the current primary manager
          const candidateManagers = eligible.filter((m) => m._id !== project.primaryManagerId);
          setManagers(candidateManagers);
          if (candidateManagers.length > 0) {
            setSelectedManagerId(candidateManagers[0]._id);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch eligible managers');
        }
      } finally {
        if (isMounted) setIsLoadingManagers(false);
      }
    };

    loadManagers();

    return () => {
      isMounted = false;
    };
  }, [isOpen, project.primaryManagerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManagerId) {
      setError('Please select an eligible manager');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await projectApi.replacePrimaryManager(project._id, selectedManagerId);
      const newManagerName = updated.primaryManager?.fullName || 'New Manager';

      onTriggerToast(
        'success',
        'Primary Manager Reassigned',
        `${newManagerName} has been assigned as the Primary PM for project "${project.name}". Outgoing manager retained as active regular member.`
      );

      onManagerReassigned(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to replace primary manager');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reassign Primary Project Manager"
      description="Designate a new Primary Project Manager for this project workstream."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={!selectedManagerId || managers.length === 0}
            leftIcon={<UserCheck className="w-3.5 h-3.5" />}
          >
            Confirm Reassignment
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Current Manager Summary */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Current Primary Project Manager
          </div>
          <div className="text-sm font-bold text-slate-900">
            {project.primaryManager?.fullName || 'Assigned Manager'}
          </div>
          {project.primaryManager?.email && (
            <div className="text-xs text-slate-500">{project.primaryManager.email}</div>
          )}
        </div>

        {/* Governance Demotion Notice (Spec 4.2) */}
        <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <strong className="font-semibold block">WorkSpace Governance Demotion Policy:</strong>
            <p className="text-[11px] leading-relaxed text-amber-700">
              When a new manager is assigned, the outgoing manager will lose PM privileges and will
              be automatically retained as an active regular project member. The new manager will
              receive primary management privileges immediately.
            </p>
          </div>
        </div>

        {/* New Manager Selector */}
        <div className="w-full flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700 tracking-wide select-none">
            Select New Primary Project Manager
          </label>

          {isLoadingManagers ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
              <Spinner size="sm" />
              <span>Loading eligible employees...</span>
            </div>
          ) : managers.length === 0 ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
              No other eligible employees found.
            </div>
          ) : (
            <select
              value={selectedManagerId}
              onChange={(e) => setSelectedManagerId(e.target.value)}
              className="w-full h-9.5 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors cursor-pointer"
            >
              {managers.map((mgr) => (
                <option key={mgr._id} value={mgr._id}>
                  {mgr.fullName} ({mgr.email})
                </option>
              ))}
            </select>
          )}
        </div>
      </form>
    </Modal>
  );
};
