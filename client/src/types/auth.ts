export type GlobalRole = 'ADMIN' | 'USER';

export interface AuthUser {
  _id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  globalRole: GlobalRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  fullName: string;
  email: string;
  password: string;
  avatarUrl?: string;
}

export interface AuthSuccessData {
  user: AuthUser;
  token: string;
}

export interface AuthApiResponse {
  success: boolean;
  data: AuthSuccessData;
  timestamp: string;
}

export interface UserApiResponse {
  success: boolean;
  data: {
    user: AuthUser;
  };
  timestamp: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, string[] | string>;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
  timestamp: string;
}
