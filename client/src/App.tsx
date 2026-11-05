import { useState, useEffect } from 'react';
import { RouterProvider, useRouter, AppRoute } from './context/RouterContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AppShell } from './components/layout/AppShell';
import { NavigationItem } from './components/layout/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailsPage } from './pages/ProjectDetailsPage';
import { TasksPage } from './pages/TasksPage';
import { ChatPage } from './pages/ChatPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ActivityPage } from './pages/ActivityPage';
import { InviteAcceptancePage } from './pages/InviteAcceptancePage';
import { CreateProjectModal } from './components/projects/CreateProjectModal';
import { ToastContainer, ToastItem } from './components/ui/Toast';
import { Spinner } from './components/ui/Spinner';
import { Layers, WifiOff } from 'lucide-react';
import { notificationApi } from './lib/notificationApi';
import { NotificationResponse } from './types/notification';
import { connectSocket, disconnectSocket, subscribeToNotification } from './lib/socket';
import { getToken } from './lib/api';

function AppContent() {
  const { user, isLoading, isAuthenticated, logout, networkError } = useAuth();
  const { currentPath, navigate } = useRouter();

  // Search Filter State (propagated across dashboard and header)
  const [searchQuery, setSearchQuery] = useState('');

  // Notifications State (Synchronized with Backend API and Socket.IO)
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);

  // Toast Alerts State
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Project Creation Modal State (Admin only)
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  // Interactive Toast Trigger Helper
  const triggerToast = (
    type: 'success' | 'info' | 'warning' | 'error',
    title: string,
    message?: string
  ) => {
    const id = Date.now().toString() + Math.random().toString().substring(2, 6);
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Socket.IO Real-Time Connection Lifecycle
  useEffect(() => {
    if (isAuthenticated) {
      const token = getToken();
      if (token) {
        connectSocket(token);

        // Real-time notification receiver
        const unsub = subscribeToNotification((incoming) => {
          setNotifications((prev) => {
            if (prev.some((n) => n._id === incoming._id)) return prev;
            return [incoming, ...prev];
          });
          triggerToast('info', incoming.title, incoming.body);
        });

        return () => {
          unsub();
        };
      }
    } else {
      disconnectSocket();
    }
  }, [isAuthenticated]);

  // Initial Notifications Load from MongoDB
  useEffect(() => {
    if (!isAuthenticated) return;
    let isMounted = true;
    async function loadInitialNotifications() {
      try {
        const data = await notificationApi.getNotifications({ limit: 20 });
        if (isMounted) {
          setNotifications(data.notifications);
        }
      } catch (err) {
        console.error('Failed to load initial notifications:', err);
      }
    }
    loadInitialNotifications();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  // Route Synchronization & Protection
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // If unauthenticated user opens an invitation link, remember token across login
      if (currentPath.startsWith('/invite')) {
        const params = new URLSearchParams(window.location.search);
        const inviteToken = params.get('token');
        if (inviteToken) {
          sessionStorage.setItem('workspace_pending_invite_token', inviteToken);
        }
        navigate('/login', { replace: true });
      }
    } else {
      // Authenticated users accessing auth forms or landing page are redirected to /dashboard or pending invite
      if (currentPath === '/login' || currentPath === '/register' || currentPath === '/') {
        const pendingToken = sessionStorage.getItem('workspace_pending_invite_token');
        if (pendingToken) {
          navigate(`/invite?token=${pendingToken}`, { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }
    }
  }, [isLoading, isAuthenticated, currentPath, navigate]);

  // Derive active navigation item from currentPath
  const getActiveNavFromPath = (path: string): NavigationItem => {
    if (path.startsWith('/projects') || path.startsWith('/invite')) {
      return 'projects';
    }
    if (path.startsWith('/tasks')) return 'tasks';
    if (path.startsWith('/chat')) return 'chat';
    if (path.startsWith('/notifications')) return 'notifications';
    if (path.startsWith('/activity')) return 'activity';
    return 'dashboard';
  };

  const activeNav = getActiveNavFromPath(currentPath);

  const handleSelectNav = (item: NavigationItem) => {
    const targetRoute: AppRoute = `/${item}` as AppRoute;
    navigate(targetRoute);
  };

  // Route analysis: Project Details (/projects/:id) or Invitation Acceptance (/invite)
  const isProjectDetailsRoute = currentPath.startsWith('/projects/') && currentPath.length > 10;
  const currentProjectId = isProjectDetailsRoute
    ? currentPath.replace('/projects/', '').split('/')[0].split('?')[0]
    : null;
  const queryParams = new URLSearchParams(window.location.search);
  const currentTaskId = queryParams.get('taskId');
  const currentTab = (queryParams.get('tab') as any) || (currentTaskId ? 'KANBAN' : 'OVERVIEW');
  const isInviteRoute = currentPath.startsWith('/invite');

  // Check if current authenticated route is a recognized application path
  const isKnownRoute =
    isInviteRoute ||
    (isProjectDetailsRoute && !!currentProjectId) ||
    currentPath === '/dashboard' ||
    currentPath === '/projects' ||
    currentPath === '/tasks' ||
    currentPath === '/chat' ||
    currentPath === '/notifications' ||
    currentPath === '/activity';

  // 1. Loading State (Full Screen Branded Screen)
  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-primary/30 animate-pulse mb-4">
          <Layers className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-700">
          <Spinner size="sm" />
          <span>Verifying authentication session...</span>
        </div>
        <span className="text-xs text-slate-400 mt-1">Connecting to WorkSpace Express API</span>
      </div>
    );
  }

  // 2. Unauthenticated State (Public Routes & Landing Page)
  if (!isAuthenticated || !user) {
    if (currentPath === '/') {
      return (
        <>
          <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
          <LandingPage />
        </>
      );
    }
    if (currentPath === '/register') {
      return (
        <>
          <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
          <RegisterPage onTriggerToast={triggerToast} />
        </>
      );
    }
    if (currentPath === '/login') {
      return (
        <>
          <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
          <LoginPage onTriggerToast={triggerToast} onClearToasts={() => setToasts([])} />
        </>
      );
    }
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
        <NotFoundPage standalone />
      </>
    );
  }

  // 3. Authenticated State: Handlers
  const handleMarkNotificationRead = async (id: string) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((notif) => (notif._id === id ? { ...notif, isRead: true } : notif))
      );
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((notif) => ({ ...notif, isRead: true })));
      triggerToast('success', 'Notifications Cleared', 'All active alerts marked as read.');
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  const handleNavigateToLink = (link: string) => {
    if (!link) return;
    if (link.includes('/tasks/')) {
      const parts = link.split('/tasks/');
      const projPart = parts[0].replace('/projects/', '');
      const taskPart = parts[1];
      navigate(`/tasks?projectId=${projPart}&taskId=${taskPart}`);
      return;
    }
    navigate(link as AppRoute);
  };

  const handleOpenNewProject = () => {
    if (user.globalRole !== 'ADMIN') {
      triggerToast(
        'warning',
        'Administrator Permission Required',
        'Only Organization Administrators can create new project workstreams.'
      );
      return;
    }
    setIsNewProjectModalOpen(true);
  };

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />

      {/* Network Warning Banner if server is unreachable */}
      {networkError && (
        <div className="bg-amber-500 text-white text-xs px-4 py-2 flex items-center justify-center gap-2 select-none shadow-sm z-50">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            <strong>Connection Warning:</strong> Backend server unreachable. Check that the Express server is running on port 5000.
          </span>
        </div>
      )}

      <AppShell
        activeNav={activeNav}
        onSelectNav={handleSelectNav}
        onOpenNewProjectModal={handleOpenNewProject}
        currentUser={user}
        onLogout={() => {
          disconnectSocket();
          logout();
          triggerToast('info', 'Signed Out', 'Your session has been securely ended.');
          navigate('/login', { replace: true });
        }}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onNavigateToLink={handleNavigateToLink}
        onViewAllNotifications={() => navigate('/notifications')}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onTriggerToast={triggerToast}
      >
        {!isKnownRoute ? (
          /* View: 404 Route Not Found */
          <NotFoundPage />
        ) : isInviteRoute ? (
          /* View: Invitation Acceptance Route (/invite?token=...) */
          <InviteAcceptancePage
            currentUser={user}
            onNavigateToProject={(projId) => navigate(`/projects/${projId}`)}
            onNavigateToProjects={() => navigate('/projects')}
            onTriggerToast={triggerToast}
          />
        ) : isProjectDetailsRoute && currentProjectId ? (
          /* View: Detailed Project View (/projects/:id) */
          <ProjectDetailsPage
            projectId={currentProjectId}
            currentUser={user}
            initialTab={currentTab}
            initialTaskId={currentTaskId}
            onBackToProjects={() => navigate('/projects')}
            onNavigateToChat={(projId) => navigate(`/chat?projectId=${projId}`)}
            onTriggerToast={triggerToast}
          />
        ) : activeNav === 'projects' ? (
          /* View: Real Backend Projects Directory (/projects) */
          <ProjectsPage
            currentUser={user}
            onOpenNewProjectModal={handleOpenNewProject}
            onSelectProject={(projId) => navigate(`/projects/${projId}`)}
            onTriggerToast={triggerToast}
          />
        ) : activeNav === 'dashboard' ? (
          /* View 1: Executive Operations Dashboard */
          <DashboardPage
            currentUser={user}
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery('')}
            onNavigateToProjects={() => handleSelectNav('projects')}
            onNavigateToTasks={() => handleSelectNav('tasks')}
            onNavigateToActivity={() => handleSelectNav('activity')}
            onNavigateToProject={(projId) => navigate(`/projects/${projId}`)}
            onNavigateToTask={(projId, taskId) =>
              navigate(`/projects/${projId}?tab=kanban&taskId=${taskId}`)
            }
            onOpenNewProjectModal={handleOpenNewProject}
            onTriggerToast={triggerToast}
          />
        ) : activeNav === 'tasks' ? (
          /* View 2: Live Kanban Tasks View */
          <TasksPage
            currentUser={user}
            initialProjectId={queryParams.get('projectId')}
            initialTaskId={queryParams.get('taskId')}
            onNavigateToProjects={() => navigate('/projects')}
            onTriggerToast={triggerToast}
          />
        ) : activeNav === 'chat' ? (
          /* View 5: Real-time Socket.IO Team Chat */
          <ChatPage
            currentUser={user}
            initialProjectId={queryParams.get('projectId')}
            onNavigateToProject={(projId) => navigate(`/projects/${projId}`)}
            onTriggerToast={triggerToast}
          />
        ) : activeNav === 'notifications' ? (
          /* View 6: Live Notification Center */
          <NotificationsPage
            onNavigateToLink={handleNavigateToLink}
            onTriggerToast={triggerToast}
            onUnreadCountChange={() => {
              notificationApi
                .getNotifications({ limit: 20 })
                .then((d) => setNotifications(d.notifications))
                .catch(() => {});
            }}
          />
        ) : activeNav === 'activity' ? (
          /* View 7: Activity History Audit Stream */
          <ActivityPage
            initialProjectId={queryParams.get('projectId')}
            onTriggerToast={triggerToast}
          />
        ) : null}
      </AppShell>

      {/* Real Backend Project Creation Modal (Organization Administrator exclusive) */}
      {user.globalRole === 'ADMIN' && (
        <CreateProjectModal
          isOpen={isNewProjectModalOpen}
          onClose={() => setIsNewProjectModalOpen(false)}
          onProjectCreated={(created) => {
            navigate(`/projects/${created._id}`);
          }}
          onTriggerToast={triggerToast}
        />
      )}
    </>
  );
}

export function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </RouterProvider>
  );
}

export default App;
