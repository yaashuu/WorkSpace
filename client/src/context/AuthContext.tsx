import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  AuthUser,
  LoginCredentials,
  RegisterCredentials,
  AuthApiResponse,
  UserApiResponse,
} from '../types/auth';
import { apiClient, ApiClientError, getToken, setToken, removeToken } from '../lib/api';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  networkError: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  register: (credentials: RegisterCredentials) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [networkError, setNetworkError] = useState<boolean>(false);

  // Restore session on application startup
  const restoreSession = useCallback(async () => {
    const existingToken = getToken();

    if (!existingToken) {
      setUser(null);
      setTokenState(null);
      setIsLoading(false);
      return;
    }

    try {
      // Validate token against backend current-user endpoint
      const response = await apiClient<UserApiResponse>('/auth/me');
      if (response && response.data && response.data.user) {
        setUser(response.data.user);
        setTokenState(existingToken);
        setNetworkError(false);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        // Check if the error is specifically an unauthenticated/invalid session error
        // e.g. TOKEN_EXPIRED, INVALID_TOKEN, UNAUTHORIZED, ACCOUNT_NOT_FOUND, or ACCOUNT_INACTIVE
        const isSessionAuthFailure =
          err.statusCode === 401 ||
          (err.statusCode === 403 && err.code === 'ACCOUNT_INACTIVE');

        if (isSessionAuthFailure) {
          removeToken();
          setUser(null);
          setTokenState(null);
        } else if (err.isNetworkError || err.statusCode >= 500) {
          // Temporary server outage or network error: preserve token and session
          setNetworkError(true);
        }
      } else {
        // Unknown exception: preserve token to prevent accidental session loss
        console.error('Unexpected error during session restoration:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = async (credentials: LoginCredentials): Promise<AuthUser> => {
    const response = await apiClient<AuthApiResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    const { user: authUser, token: authToken } = response.data;
    setToken(authToken);
    setTokenState(authToken);
    setUser(authUser);
    setNetworkError(false);
    return authUser;
  };

  const register = async (credentials: RegisterCredentials): Promise<AuthUser> => {
    const response = await apiClient<AuthApiResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName: credentials.fullName,
        email: credentials.email,
        password: credentials.password,
        avatarUrl: credentials.avatarUrl || null,
      }),
    });

    const { user: authUser, token: authToken } = response.data;
    setToken(authToken);
    setTokenState(authToken);
    setUser(authUser);
    setNetworkError(false);
    return authUser;
  };

  const logout = useCallback(() => {
    removeToken();
    setUser(null);
    setTokenState(null);
    setNetworkError(false);
  }, []);

  const refreshUser = async () => {
    if (!getToken()) return;
    try {
      const response = await apiClient<UserApiResponse>('/auth/me');
      if (response && response.data && response.data.user) {
        setUser(response.data.user);
      }
    } catch (err) {
      if (
        err instanceof ApiClientError &&
        (err.statusCode === 401 || (err.statusCode === 403 && err.code === 'ACCOUNT_INACTIVE'))
      ) {
        logout();
      }
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: Boolean(user && token),
    networkError,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
