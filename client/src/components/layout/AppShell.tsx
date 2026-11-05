import React, { useState } from 'react';
import { Sidebar, NavigationItem } from './Sidebar';
import { Header } from './Header';
import { AuthUser } from '../../types/auth';
import { NotificationResponse } from '../../types/notification';

export interface AppShellProps {
  activeNav: NavigationItem;
  onSelectNav: (item: NavigationItem) => void;
  onOpenNewProjectModal: () => void;
  currentUser: AuthUser;
  onLogout: () => void;
  notifications: NotificationResponse[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onNavigateToLink?: (link: string) => void;
  onViewAllNotifications?: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onTriggerToast: (type: 'info' | 'success', title: string, message?: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeNav,
  onSelectNav,
  onOpenNewProjectModal,
  currentUser,
  onLogout,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onNavigateToLink,
  onViewAllNotifications,
  searchQuery,
  onSearchChange,
  onTriggerToast,
  children,
}) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const getPageTitle = (nav: NavigationItem) => {
    switch (nav) {
      case 'dashboard':
        return 'Operations Dashboard';
      case 'projects':
        return 'Projects Directory';
      case 'tasks':
        return 'Kanban Workflows';
      case 'chat':
        return 'Team Chat Channels';
      case 'notifications':
        return 'Notification Stream';
      case 'activity':
        return 'Activity Audit Logs';
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar
          activeItem={activeNav}
          onSelect={onSelectNav}
          onOpenNewProjectModal={onOpenNewProjectModal}
          unreadCount={unreadCount}
          isAdmin={currentUser.globalRole === 'ADMIN'}
        />
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative z-10 animate-slide-in">
            <Sidebar
              activeItem={activeNav}
              onSelect={(item) => {
                onSelectNav(item);
                setIsMobileSidebarOpen(false);
              }}
              onOpenNewProjectModal={() => {
                onOpenNewProjectModal();
                setIsMobileSidebarOpen(false);
              }}
              unreadCount={unreadCount}
              isAdmin={currentUser.globalRole === 'ADMIN'}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header
          pageTitle={getPageTitle(activeNav)}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          currentUser={currentUser}
          onLogout={onLogout}
          notifications={notifications}
          onMarkNotificationRead={onMarkNotificationRead}
          onMarkAllNotificationsRead={onMarkAllNotificationsRead}
          onNavigateToLink={onNavigateToLink}
          onViewAllNotifications={onViewAllNotifications}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onTriggerToast={onTriggerToast}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
