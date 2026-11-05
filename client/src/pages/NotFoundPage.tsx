import React from 'react';
import { Layers, ArrowLeft, LayoutDashboard, Home, Search } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';

export interface NotFoundPageProps {
  standalone?: boolean;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ standalone = false }) => {
  const { navigate } = useRouter();
  const { isAuthenticated } = useAuth();

  const content = (
    <div className="flex flex-col items-center justify-center text-center px-4 py-16 sm:py-24">
      {/* 404 Visual Indicator */}
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-primary-50 border border-primary-200/80 flex items-center justify-center text-primary mb-6 shadow-sm">
        <Layers className="w-8 h-8 sm:w-10 sm:h-10 text-primary animate-pulse" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-mono text-xs font-semibold mb-3">
        <span>ERROR 404</span>
        <span className="text-slate-400">•</span>
        <span>ROUTE NOT FOUND</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
        We couldn&apos;t find that page
      </h1>

      <p className="text-sm text-slate-500 max-w-md mb-8 leading-relaxed">
        The URL you requested doesn&apos;t match any active WorkSpace workstream, route, or resource. Please check the address or return to the main application.
      </p>

      {/* Navigation Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {isAuthenticated ? (
          <>
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/dashboard')}
              leftIcon={<LayoutDashboard className="w-4 h-4" />}
            >
              Back to Dashboard
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/projects')}
              leftIcon={<Search className="w-4 h-4" />}
            >
              Browse Projects
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/')}
              leftIcon={<Home className="w-4 h-4" />}
            >
              Return to Home
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/login')}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Sign In to WorkSpace
            </Button>
          </>
        )}
      </div>
    </div>
  );

  if (standalone) {
    return (
      <div className="min-h-screen w-full bg-canvas flex flex-col justify-between font-sans">
        <header className="h-16 px-6 sm:px-10 border-b border-slate-200 bg-white flex items-center justify-between">
          <div
            onClick={() => navigate(isAuthenticated ? '/dashboard' : '/')}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Layers className="w-4.5 h-4.5" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-slate-900">
              WorkSpace
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
          >
            {isAuthenticated ? 'Dashboard' : 'Sign In'}
          </Button>
        </header>

        <main className="flex-1 flex items-center justify-center">{content}</main>

        <footer className="py-4 border-t border-slate-200 text-center text-xs text-slate-400 bg-white">
          &copy; {new Date().getFullYear()} WorkSpace SaaS Platform. All rights reserved.
        </footer>
      </div>
    );
  }

  return content;
};
