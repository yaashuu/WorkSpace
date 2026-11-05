import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Menu, CheckCircle2, X, ChevronDown, LogOut, ShieldCheck, User, ArrowRight } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { AuthUser } from '../../types/auth';
import { NotificationResponse } from '../../types/notification';

export interface HeaderProps {
  pageTitle: string;
  onOpenMobileSidebar?: () => void;
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
}

export const Header: React.FC<HeaderProps> = ({
  pageTitle,
  onOpenMobileSidebar,
  currentUser,
  onLogout,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onNavigateToLink,
  onViewAllNotifications,
  searchQuery,
  onSearchChange,
}) => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Click outside listener to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAdmin = currentUser.globalRole === 'ADMIN';

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between gap-3 sm:gap-4 shrink-0 select-none z-20 relative">
      {/* Left: Mobile trigger & Page Title & Search */}
      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 max-w-xl">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
          aria-label="Open navigation sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex flex-col shrink-0">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Workspace
          </span>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight leading-none mt-0.5">
            {pageTitle}
          </h2>
        </div>

        {/* Functional Search Bar */}
        <div className="relative flex-1 min-w-[140px] max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter projects, tasks, or team members..."
            className="w-full h-9 pl-9 pr-8 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 placeholder:truncate focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right Controls: Notifications & Profile Menu */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* Notification Bell with Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setIsNotifOpen(!isNotifOpen);
              setIsProfileOpen(false);
            }}
            className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4.5 h-4.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Popover */}
          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-84 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-30">
              <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">Notifications</span>
                  {unreadCount > 0 && (
                    <Badge variant="primary" size="sm">
                      {unreadCount} new
                    </Badge>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllNotificationsRead}
                    className="text-[11px] font-semibold text-primary hover:text-primary-hover transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No active notifications.
                  </div>
                ) : (
                  notifications.map((n) => {
                    const timeAgo = new Date(n.createdAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={n._id}
                        onClick={() => {
                          if (!n.isRead) onMarkNotificationRead(n._id);
                          if (n.link && onNavigateToLink) {
                            onNavigateToLink(n.link);
                            setIsNotifOpen(false);
                          }
                        }}
                        className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                          !n.isRead ? 'bg-primary-50/30 hover:bg-primary-50/50' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h5 className="text-xs font-semibold text-slate-900 truncate">
                              {n.title}
                            </h5>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {timeAgo}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{n.body}</p>
                        </div>
                        {!n.isRead && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkNotificationRead(n._id);
                            }}
                            className="text-primary hover:text-primary-hover p-1"
                            title="Mark as read"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {onViewAllNotifications && (
                <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                  <button
                    onClick={() => {
                      setIsNotifOpen(false);
                      onViewAllNotifications();
                    }}
                    className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center justify-center gap-1 mx-auto"
                  >
                    View All in Notification Center <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-5 w-px bg-slate-200" />

        {/* User Profile Area with Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => {
              setIsProfileOpen(!isProfileOpen);
              setIsNotifOpen(false);
            }}
            className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-slate-100 transition-colors text-left"
          >
            <Avatar
              name={currentUser.fullName}
              src={currentUser.avatarUrl || undefined}
              size="sm"
              status="online"
            />
            <div className="hidden md:flex flex-col">
              <span className="text-xs font-semibold text-slate-800 leading-tight">
                {currentUser.fullName}
              </span>
              <span className="text-[10px] text-slate-500 leading-tight truncate max-w-[130px]">
                {isAdmin ? 'Org Administrator' : 'Team Member'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Profile Dropdown Menu */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-30 animate-fade-in">
              <div className="p-4 border-b border-slate-100 bg-slate-50/60">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={currentUser.fullName}
                    src={currentUser.avatarUrl || undefined}
                    size="md"
                    status="online"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {currentUser.fullName}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                          <ShieldCheck className="w-3 h-3" />
                          ORGANIZATION ADMIN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <User className="w-3 h-3" />
                          TEAM MEMBER
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Metadata */}
              <div className="px-4 py-2.5 border-b border-slate-100 text-[11px] text-slate-500 space-y-1 bg-white">
                <div className="flex justify-between">
                  <span className="text-slate-400">Account Status:</span>
                  <span className="text-emerald-600 font-semibold">Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Contextual PM:</span>
                  <span className="text-slate-600">Per-Project Role</span>
                </div>
              </div>

              {/* Working Logout Action */}
              <div className="p-2">
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    onLogout();
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
