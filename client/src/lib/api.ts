import { ApiErrorDetail, ApiErrorResponse } from '../types/auth';

export const WORKSPACE_TOKEN_KEY = 'workspace_token';

export class ApiClientError extends Error {
  public statusCode: number;
  public code: string;
  public details?: Record<string, string[] | string>;
  public isNetworkError: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = 'UNKNOWN_ERROR',
    details?: Record<string, string[] | string>,
    isNetworkError = false
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isNetworkError = isNetworkError;
  }
}

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(WORKSPACE_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token: string): void => {
  try {
    localStorage.setItem(WORKSPACE_TOKEN_KEY, token);
  } catch (err) {
    console.error('Failed to persist auth token in localStorage:', err);
  }
};

export const removeToken = (): void => {
  try {
    localStorage.removeItem(WORKSPACE_TOKEN_KEY);
  } catch (err) {
    console.error('Failed to remove auth token from localStorage:', err);
  }
};

/**
 * Centralized API client for all WorkSpace backend requests.
 * Uses relative `/api/v1` routes proxied by Vite in development.
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('/api')
    ? endpoint
    : `/api/v1${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const token = getToken();

  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (fetchErr) {
    // Network failure (server down, CORS/proxy connection refused, DNS failure)
    const errMessage =
      fetchErr instanceof Error ? fetchErr.message : 'Network connection failed';
    throw new ApiClientError(
      `Unable to connect to WorkSpace API: ${errMessage}`,
      0,
      'NETWORK_ERROR',
      undefined,
      true
    );
  }

  // Handle empty responses (e.g. 204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorBody = data as ApiErrorResponse | null;
    const errorDetail: ApiErrorDetail | undefined = errorBody?.error;

    const message =
      errorDetail?.message ||
      `Request failed with HTTP status ${response.status} (${response.statusText})`;
    const code = errorDetail?.code || `HTTP_${response.status}`;
    const details = errorDetail?.details;

    throw new ApiClientError(message, response.status, code, details, false);
  }

  return data as T;
}
