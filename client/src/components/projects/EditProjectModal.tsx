import React, { useState } from 'react';
import { Settings2, AlertCircle, Lock, Globe } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { projectApi } from '../../lib/projectApi';
import { ApiClientError } from '../../lib/api';
import { DetailedProject, ProjectStatus, ProjectVisibility } from '../../types/project';

export interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: DetailedProject;
  onProjectUpdated: (updatedProject: DetailedProject) => void;
  onTriggerToast: (type: 'success' | 'error' | 'warning', title: string, message?: string) => void;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  onProjectUpdated,
  onTriggerToast,
}) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [visibility, setVisibility] = useState<ProjectVisibility>(project.visibility);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Update general project details (name, description, status)
      let updated = await projectApi.updateProject(project._id, {
        name: name.trim(),
        description: description.trim(),
        status,
      });

      // 2. If visibility changed, call visibility endpoint
      if (visibility !== project.visibility) {
        updated = await projectApi.updateVisibility(project._id, visibility);
      }

      onTriggerToast(
        'success',
        'Project Settings Updated',
        `Changes saved for project "${updated.name}".`
      );
      onProjectUpdated(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to update project settings');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Project Settings"
      description="Update workstream metadata, lifecycle status, and visibility scope."
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
            leftIcon={<Settings2 className="w-3.5 h-3.5" />}
          >
            Save Changes
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

        <Input
          label="Project Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="w-full flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700 tracking-wide select-none">
            Project Key
          </label>
          <input
            type="text"
            disabled
            value={project.key}
            className="w-full h-9.5 px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed font-mono font-bold"
          />
          <p className="text-[11px] text-slate-400">
            Project keys are immutable once created to preserve task link integrity.
          </p>
        </div>

        <div className="w-full flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700 tracking-wide select-none">
            Description
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-colors"
          />
        </div>

        {/* Lifecycle Status */}
        <div className="w-full flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700 tracking-wide select-none">
            Workstream Status
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStatus('ACTIVE')}
              className={`p-2.5 rounded-lg border text-left text-xs font-semibold transition-colors cursor-pointer ${
                status === 'ACTIVE'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              Active Workstream
            </button>
            <button
              type="button"
              onClick={() => setStatus('ARCHIVED')}
              className={`p-2.5 rounded-lg border text-left text-xs font-semibold transition-colors cursor-pointer ${
                status === 'ARCHIVED'
                  ? 'border-slate-500 bg-slate-100 text-slate-800 ring-2 ring-slate-200'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              Archived (Read-Only)
            </button>
          </div>
        </div>

        {/* Visibility Scope */}
        <div className="w-full flex flex-col gap-1.5 pt-1">
          <label className="text-xs font-semibold text-slate-700 tracking-wide select-none">
            Visibility Scope (Administrator exclusive)
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
                <span>PRIVATE</span>
              </div>
              <span className="text-[11px] text-slate-500 font-normal">
                Hidden from non-members. Invitation link only.
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
                Public in directory. Standard users can request to join.
              </span>
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
