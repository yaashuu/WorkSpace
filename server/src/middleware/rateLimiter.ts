import rateLimit, { Options } from 'express-rate-limit';
import { Request, Response } from 'express';
import { env } from '../config/env';

/**
 * Standard error formatter for rate limit violations conforming to the WorkSpace API spec.
 */
const rateLimitHandler = (message: string) => {
  return (_req: Request, res: Response): void => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message,
      },
      timestamp: new Date().toISOString(),
    });
  };
};

/**
 * Determines whether rate limiting should be skipped.
 * Automatically bypassed in test mode unless ENABLE_TEST_RATE_LIMIT is explicitly set,
 * preventing test suites from encountering artificial throttling.
 */
const shouldSkip = (): boolean => {
  if (process.env.NODE_ENV === 'test') {
    return process.env.ENABLE_TEST_RATE_LIMIT !== 'true';
  }
  return false;
};

/**
 * Global API rate limiter applied to all /api/v1 routes.
 * Protects against basic volumetric DoS without hindering Kanban, chat, or notification polling.
 */
export const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.RATE_LIMIT_API_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: shouldSkip,
  handler: rateLimitHandler('Too many requests from this IP. Please try again later.'),
});

/**
 * Strict rate limiter for authentication login endpoint (POST /api/v1/auth/login).
 * Defends against brute-force credential stuffing and password guessing attacks.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.RATE_LIMIT_LOGIN_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: shouldSkip,
  handler: rateLimitHandler('Too many login attempts. Please try again after 15 minutes.'),
});

/**
 * Rate limiter for registration endpoint (POST /api/v1/auth/register).
 * Protects against mass automated account creation and resource exhaustion.
 */
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.RATE_LIMIT_REGISTER_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: shouldSkip,
  handler: rateLimitHandler('Too many accounts created from this IP. Please try again later.'),
});

/**
 * Rate limiter for invitation acceptance and creation endpoints.
 * Defends against invitation token brute-forcing and invitation spam.
 */
export const invitationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per 15 minutes
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: shouldSkip,
  handler: rateLimitHandler('Too many invitation requests. Please try again later.'),
});
