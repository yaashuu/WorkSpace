import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  MessageSquare,
  Bell,
  Activity,
  Plus,
  Layers,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

export type NavigationItem =
  | 'dashboard'
  | 'projects'
  | 'tasks'
  | 'chat'
  | 'notifications'
  | 'activity';

export interface SidebarProps {
  activeItem: NavigationItem;
  onSelect: (item: NavigationItem) => void;
  onOpenNewProjectModal: () => void;
  unreadCount?: number;
  className?: string;
  isAdmin?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeItem,
  onSelect,
  onOpenNewProjectModal,
  unreadCount = 0,
  className,
  isAdmin = false,
}) => {
  const mainNav = [
    {
      id: 'dashboard' as NavigationItem,
      label: 'Dashboard',
      icon: LayoutDashboard,
      statusTag: null,
    },
    {
      id: 'projects' as NavigationItem,
      label: 'Projects',
      icon: FolderKanban,
      statusTag: null,
    },
    {
      id: 'tasks' as NavigationItem,
      label: 'My Tasks',
      icon: CheckSquare,
      statusTag: null,
    },
    {
      id: 'chat' as NavigationItem,
      label: 'Chat',
      icon: MessageSquare,
      statusTag: null,
    },
    {
      id: 'notifications' as NavigationItem,
      label: 'Notifications',
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : undefined,
      statusTag: null,
    },
    {
      id: 'activity' as NavigationItem,
      label: 'Activity',
      icon: Activity,
      statusTag: null,
    },
  ];

  return (
    <aside
      className={cn(
        'w-64 bg-sidebar text-white flex flex-col h-screen shrink-0 border-r border-sidebar-border/40 select-none transition-all',
        className
      )}
    >
      {/* Brand Header */}
      <div
        onClick={() => onSelect('dashboard')}
        className="h-16 px-5 flex items-center gap-3 border-b border-sidebar-border/30 cursor-pointer hover:bg-sidebar-hover/40 transition-colors"
        title="Go to Operations Dashboard"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center text-white shadow-xs">
          <Layers className="w-4.5 h-4.5" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
            WorkSpace
            <span className="text-[9px] font-semibold bg-primary/20 text-primary-200 px-1.5 py-0.2 rounded border border-primary/30">
              SaaS
            </span>
          </span>
          <span className="text-[10px] text-slate-400 font-medium tracking-wide">
            Team Collaboration Suite
          </span>
        </div>
      </div>

      {/* New Project Action CTA (Organization Administrator Exclusive) */}
      {isAdmin && (
        <div className="px-4 pt-4 pb-2">
          <Button
            variant="primary"
            size="md"
            className="w-full justify-center shadow-xs text-xs font-semibold"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={onOpenNewProjectModal}
          >
            New Project
          </Button>
        </div>
      )}

      {/* Navigation Sections */}
      <div className="flex-1 px-3 py-3 space-y-5 overflow-y-auto">
        <div>
          <div className="px-3 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Workspace Operations
          </div>

          <div className="space-y-0.5">
            {mainNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeItem === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group',
                    isActive
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={cn('w-4 h-4', isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200')} />
                    <span>{item.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.statusTag && !isActive && (
                      <span className="text-[9px] text-slate-400 bg-sidebar-hover/80 px-1.5 py-0.5 rounded font-mono">
                        {item.statusTag}
                      </span>
                    )}
                    {item.badge && (
                      <span
                        className={cn(
                          'px-1.5 py-0.5 text-[10px] font-bold rounded-full',
                          isActive ? 'bg-white/20 text-white' : 'bg-red-500 text-white'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};
