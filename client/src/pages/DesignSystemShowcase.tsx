import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  Mail,
  Lock,
  Plus,
  Send,
  Trash2,
  Bell,
  CheckCircle2,
  FolderPlus,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge, TaskStatusBadge, TaskPriorityBadge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { ToastContainer, ToastItem } from '../components/ui/Toast';

export const DesignSystemShowcase: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (type: 'success' | 'error' | 'warning' | 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = {
      id,
      type,
      title: `${type.toUpperCase()}: Action Executed`,
      message: 'Design token demonstration alert auto-dismisses on action.',
    };
    setToasts((prev) => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Toast Alert Portal */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Header Banner */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
          <Sparkles className="w-4 h-4" />
          <span>WorkSpace Design System & Tokens</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Visual Identity & Component Foundation
        </h1>
        <p className="text-sm text-slate-500">
          Reusable, accessible design tokens and UI primitives aligned with the WorkSpace reference specifications.
        </p>
      </div>

      {/* 1. Color Palette Tokens */}
      <Card>
        <CardHeader>
          <CardTitle>Core Design Palette & Tokens</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          <div className="flex flex-col gap-2">
            <div className="h-16 rounded-lg bg-primary border border-slate-200 shadow-xs flex items-end p-2">
              <span className="text-[10px] font-mono text-white">#6558D9</span>
            </div>
            <span className="text-xs font-semibold text-slate-800">Primary Purple</span>
            <span className="text-[11px] text-slate-400">Accent & Active CTAs</span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="h-16 rounded-lg bg-sidebar border border-slate-700 shadow-xs flex items-end p-2">
              <span className="text-[10px] font-mono text-white">#1F2937</span>
            </div>
            <span className="text-xs font-semibold text-slate-800">Sidebar Navy</span>
            <span className="text-[11px] text-slate-400">Navigation Shell</span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="h-16 rounded-lg bg-canvas border border-slate-200 shadow-xs flex items-end p-2">
              <span className="text-[10px] font-mono text-slate-600">#F5F6FA</span>
            </div>
            <span className="text-xs font-semibold text-slate-800">Page Canvas</span>
            <span className="text-[11px] text-slate-400">Background Layer</span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="h-16 rounded-lg bg-emerald-600 border border-emerald-700 shadow-xs flex items-end p-2">
              <span className="text-[10px] font-mono text-white">#16A34A</span>
            </div>
            <span className="text-xs font-semibold text-slate-800">Success State</span>
            <span className="text-[11px] text-slate-400">Done / Approved</span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="h-16 rounded-lg bg-amber-500 border border-amber-600 shadow-xs flex items-end p-2">
              <span className="text-[10px] font-mono text-white">#F59E0B</span>
            </div>
            <span className="text-xs font-semibold text-slate-800">Warning State</span>
            <span className="text-[11px] text-slate-400">Testing / Review</span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="h-16 rounded-lg bg-red-500 border border-red-600 shadow-xs flex items-end p-2">
              <span className="text-[10px] font-mono text-white">#EF4444</span>
            </div>
            <span className="text-xs font-semibold text-slate-800">Error State</span>
            <span className="text-[11px] text-slate-400">Urgent / Overdue</span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Button Components */}
      <Card>
        <CardHeader>
          <CardTitle>Button Primitives & Variants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
              Primary Button
            </Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="outline" leftIcon={<Search className="w-4 h-4" />}>
              Outline Button
            </Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="danger" leftIcon={<Trash2 className="w-4 h-4" />}>
              Danger Action
            </Button>
            <Button variant="primary" isLoading>
              Loading State
            </Button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button variant="primary" size="sm">
              Small (sm)
            </Button>
            <Button variant="primary" size="md">
              Medium (md)
            </Button>
            <Button variant="primary" size="lg">
              Large (lg)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Form Input Primitives */}
      <Card>
        <CardHeader>
          <CardTitle>Form Inputs & States</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Input
            label="Email Address"
            placeholder="e.g. sarah@workspace.com"
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            leftIcon={<Lock className="w-4 h-4" />}
            helperText="Minimum 8 characters with numbers"
            required
          />
          <Input
            label="Project Key"
            defaultValue="INVALID_KEY_12345"
            error="Project key must be at most 10 uppercase alphanumeric characters"
            required
          />
        </CardContent>
      </Card>

      {/* 4. Badges, Task Statuses & Priorities */}
      <Card>
        <CardHeader>
          <CardTitle>Status, Kanban Columns & Priority Badges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
              Task Kanban Status Columns
            </h4>
            <div className="flex flex-wrap items-center gap-2.5">
              <TaskStatusBadge status="BACKLOG" />
              <TaskStatusBadge status="TODO" />
              <TaskStatusBadge status="IN_PROGRESS" />
              <TaskStatusBadge status="TESTING" />
              <TaskStatusBadge status="DONE" />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
              Task Priority Indicators
            </h4>
            <div className="flex flex-wrap items-center gap-2.5">
              <TaskPriorityBadge priority="LOW" />
              <TaskPriorityBadge priority="MEDIUM" />
              <TaskPriorityBadge priority="HIGH" />
              <TaskPriorityBadge priority="URGENT" />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
              Project Visibility Badges
            </h4>
            <div className="flex items-center gap-2.5">
              <Badge variant="primary" dot>
                PUBLIC PROJECT
              </Badge>
              <Badge variant="neutral" dot>
                PRIVATE PROJECT
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Avatars & User Presence */}
      <Card>
        <CardHeader>
          <CardTitle>Avatars & Presence Indicators</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <Avatar size="xs" name="Alex Rivera" status="online" />
            <Avatar size="sm" name="Elena Rostova" status="busy" />
            <Avatar size="md" name="Sarah Chen" status="online" />
            <Avatar
              size="lg"
              name="Marcus Vance"
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"
              status="online"
            />
            <Avatar
              size="xl"
              name="Sarah Chen"
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150"
              status="online"
            />
          </div>
          <div className="text-xs text-slate-500 border-l border-slate-200 pl-6">
            Supports photo URLs with graceful fallback to user initials and online presence dots.
          </div>
        </CardContent>
      </Card>

      {/* 6. Interactive Modal & Toast Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Interactive Dialogs & Toast Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(true)}
              leftIcon={<FolderPlus className="w-4 h-4 text-primary" />}
            >
              Trigger Demonstration Modal
            </Button>
            <Button
              variant="secondary"
              onClick={() => addToast('success')}
              leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            >
              Toast Success
            </Button>
            <Button
              variant="secondary"
              onClick={() => addToast('warning')}
              leftIcon={<Bell className="w-4 h-4 text-amber-500" />}
            >
              Toast Warning
            </Button>
            <Button
              variant="secondary"
              onClick={() => addToast('error')}
              leftIcon={<Trash2 className="w-4 h-4 text-red-500" />}
            >
              Toast Error
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 7. Empty State Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Empty State Pattern</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<FolderPlus className="w-6 h-6" />}
            title="No tasks in Backlog"
            description="All backlog tasks have been triaged or scheduled into active sprints."
            actionLabel="Create Backlog Task"
            onAction={() => addToast('info')}
          />
        </CardContent>
      </Card>

      {/* Demo Modal Instance */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Project"
        description="Configure project key and assign the primary project manager."
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setIsModalOpen(false);
                addToast('success');
              }}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Create Project
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Project Name" placeholder="e.g. Cloud Infrastructure Modernization" required />
          <Input label="Project Key" placeholder="e.g. CLOUD" helperText="2-10 uppercase characters" required />
          <Input label="Description" placeholder="Project goals and target milestones..." />
        </div>
      </Modal>
    </div>
  );
};
