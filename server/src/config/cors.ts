import cors from 'cors';
import { env } from './env';
import { AppError } from '../errors/AppError';

/**
 * Parses and returns the list of allowed CORS origins based on environment.
 * Development environments automatically include standard local Vite/Express ports.
 * Production environments strictly enforce configured origins without wildcards.
 */
export const parseAllowedOrigins = (envOrigin?: string): string[] => {
  const defaultDevOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
  ];

  if (!envOrigin || envOrigin.trim() === '') {
    return defaultDevOrigins;
  }

  const parsed = envOrigin
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  // In development and test, permit local dev ports alongside explicitly configured origins
  if (env.NODE_ENV !== 'production') {
    return Array.from(new Set([...parsed, ...defaultDevOrigins]));
  }

  return parsed;
};

/**
 * Validates whether an incoming HTTP/WebSocket Origin header is permitted.
 * Requests without an Origin header (e.g. curl, Postman, internal health checks) are allowed.
 */
export const isOriginAllowed = (origin: string | undefined, allowedOrigins: string[]): boolean => {
  // Allow non-browser requests (no Origin header)
  if (!origin) {
    return true;
  }

  return allowedOrigins.includes(origin);
};

/**
 * Express CORS options factory.
 */
export const getCorsOptions = (): cors.CorsOptions => {
  const allowedOrigins = parseAllowedOrigins(env.CORS_ORIGIN);

  return {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
      } else {
        callback(new AppError(`Origin '${origin}' is not allowed by CORS policy`, 403, 'CORS_ERROR'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24 hours preflight cache
  };
};
