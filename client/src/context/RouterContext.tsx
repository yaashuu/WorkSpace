import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type AppRoute =
  | '/'
  | '/login'
  | '/register'
  | '/dashboard'
  | '/projects'
  | '/tasks'
  | '/chat'
  | '/notifications'
  | '/activity';

interface RouterContextType {
  currentPath: string;
  navigate: (path: string, options?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const initial = window.location.pathname;
    return initial || '/';
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((path: string, options?: { replace?: boolean }) => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    if (options?.replace) {
      window.history.replaceState(null, '', normalized);
    } else {
      window.history.pushState(null, '', normalized);
    }
    setCurrentPath(normalized);
  }, []);

  return (
    <RouterContext.Provider value={{ currentPath, navigate }}>
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = (): RouterContextType => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
};
