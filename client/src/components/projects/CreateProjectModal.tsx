import React, { useState, useEffect } from 'react';
import { Plus, Lock, Globe, AlertCircle, UserCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { projectApi } from '../../lib/projectApi';
import { ApiClientError } from '../../lib/api';
import { EligibleManager, DetailedProject, ProjectVisibility } from '../../types/project';

export interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: DetailedProject) => void;
  onTriggerToast: (type: 'success' | 'error' | 'warning', title: string, message?: string) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
  onTriggerToast,
}) => {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<ProjectVisibility>('PRIVATE');
  const [primaryManagerId, setPrimaryManagerId] = useState('');

  // Eligible Managers State
  const [managers, setManagers] = useState<EligibleManager[]>([]);
  const [isLoadingManagers, setIsLoadingManagers] = useState(false);
  const [managersError, setManagersError] = useState<string | null>(null);

  // Form Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Fetch eligible managers when modal opens
  useEffect(() => {
    if (!isOpen) {
      // Reset form on close
      setName('');
      setKey('');
      setDescription('');
      setVisibility('PRIVATE');
      setPrimaryManagerId('');
      setFormError(null);
      setFieldErrors({});
      return;
    }

    let isMounted = true;
    const loadManagers = async () => {
      setIsLoadingManagers(true);
      setManagersError(null);
      try {
        const eligible = await projectApi.getEligibleManagers();
        if (isMounted) {
          setManagers(eligible);
          if (eligible.length > 0 && !primaryManagerId) {
            setPrimaryManagerId(eligible[0]._id);
          }
        }
      } catch (err) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Failed to load eligible managers';
          setManagersError(message);
        }
      } finally {
        if (isMounted) setIsLoadingManagers(false);
      }
    };

    loadManagers();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Project name is required';
    } else if (name.trim().length < 2) {
      errors.name = 'Project name must be at least 2 characters';
    } else if (name.trim().length > 100) {
      errors.name = 'Project name cannot exceed 100 characters';
    }

    const cleanKey = key.trim().toUpperCase();
    if (!cleanKey) {
      errors.key = 'Project key is required';
    } else if (cleanKey.length < 2 || cleanKey.length > 10) {
      errors.key = 'Project key must be between 2 and 10 characters';
    } else if (!/^[A-Z0-9]+$/.test(cleanKey)) {
      errors.key = 'Project key must contain only uppercase alphanumeric characters';
    }

    if (!primaryManagerId) {
      errors.primaryManagerId = 'Please select a primary project manager';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const created = await projectApi.createProject({
        name: name.trim(),
        key: key.trim().toUpperCase(),
        description: description.trim(),
        primaryManagerId,
      });

      // If user selected PUBLIC visibility, update visibility as specified in Spec 4.1
      // (Backend createProject strictly defaults to PRIVATE; admin modifies visibility)
      let finalProject = created;
      if (visibility === 'PUBLIC') {
        try {
          finalProject = await projectApi.updateVisibility(created._id, 'PUBLIC');
        } catch {
          // If visibility toggle fails, project was still created with default PRIVATE
          onTriggerToast(
            'warning',
            'Project Created as Private',
            'Project was created, but setting public visibility requires an update.'
          );
        }
      }

      onTriggerToast(
        'success',
        'Project Created',
        `Project "${finalProject.name}" (${finalProject.key}) was created successfully.`
      );
      onProjectCreated(finalProject);
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'DUPLICATE_KEY') {
          setFieldErrors((prev) => ({
            ...prev,
            key: `A project with key "${key.toUpperCase()}" already exists. Please choose a different key.`,
          }));
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError(err instanceof Error ? err.message : 'Failed to create project');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Project"
      description="Initialize a new project workstream with an assigned Primary Project Manager."
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
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Create Project
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{formError}</span>
          </div>
        )}

        <Input
          label="Project Name"
          placeholder="e.g. NextGen Microservices Platform"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' }));
          }}
          error={fieldErrors.name}
          required
        />

        <Input
          label="Project Key"
          placeholder="e.g. PLATFORM"
          helperText="2 to 10 uppercase letters or numbers (used for task keys like PLATFORM-101)"
          value={key}
          onChange={(e) => {
            setKey(e.target.value.toUpperCase());
            if (fieldErrors.key) setFieldErrors((prev) => ({ ...prev, key: '' }));
          }}
          error={fieldErrors.key}
          required
        />

        <div className="w-full flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700 tracking-wide select-none">
            Description
          </label>
          <textarea
            rows={3}
            placeholder="High-level description of objectives, deliverables, and team scope..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-colors"
          />
        </div>

        {/* Primary Project Manager Selection */}
        <div className="w-full flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 tracking-wide select-none">
              Designate Primary Project Manager <span className="text-red-500">*</span>
            </label>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <UserCheck className="w-3 h-3" />
              Eligible active employees
            </span>
          </div>

          {isLoadingManagers ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
              <Spinner size="sm" />
              <span>Loading eligible managers...</span>
            </div>
          ) : managersError ? (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center justify-between">
              <span>{managersError}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsLoadingManagers(true);
                  projectApi
                    .getEligibleManagers()
                    .then(setManagers)
                    .catch(() => {})
                    .finally(() => setIsLoadingManagers(false));
                }}
              >
                Retry
              </Button>
            </div>
          ) : managers.length === 0 ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
              No eligible employees found. Only active users with role <code>USER</code> can be designated as Primary Project Managers.
            </div>
          ) : (
            <select
              value={primaryManagerId}
              onChange={(e) => {
                setPrimaryManagerId(e.target.value);
                if (fieldErrors.primaryManagerId) {
                  setFieldErrors((prev) => ({ ...prev, primaryManagerId: '' }));
                }
              }}
              className="w-full h-9.5 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors cursor-pointer"
            >
              <option value="" disabled>
                Select an eligible employee...
              </option>
              {managers.map((mgr) => (
                <option key={mgr._id} value={mgr._id}>
                  {mgr.fullName} ({mgr.email})
                </option>
              ))}
            </select>
          )}

          {fieldErrors.primaryManagerId && (
            <p className="text-xs text-red-500 font-medium">{fieldErrors.primaryManagerId}</p>
          )}
          <p className="text-[11px] text-slate-400">
            Administrators are strictly excluded from being assigned as Project Managers per WorkSpace governance.
          </p>
        </div>

        {/* Visibility Scope */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-semibold text-slate-700 tracking-wide select-none">
            Initial Visibility Scope (Spec 4.1)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setVisibility('PRIVATE')}
              className={`p-3 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                visibility === 'PRIVATE'
                  ? 'border-primary bg-primary-50/50 text-primary font-semibold ring-2 ring-primary/20'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 font-bold">
                <Lock className="w-3.5 h-3.5" />
                <span>PRIVATE (Default)</span>
              </div>
              <span className="text-[11px] text-slate-500 font-normal">
                Strictly hidden from non-members. Access by authorized invitation only.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setVisibility('PUBLIC')}
              className={`p-3 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                visibility === 'PUBLIC'
                  ? 'border-primary bg-primary-50/50 text-primary font-semibold ring-2 ring-primary/20'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 font-bold">
                <Globe className="w-3.5 h-3.5" />
                <span>PUBLIC</span>
              </div>
              <span className="text-[11px] text-slate-500 font-normal">
                Discoverable in directory. Non-members can submit join requests.
              </span>
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
