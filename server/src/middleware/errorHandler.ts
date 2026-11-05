import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { env } from '../config/env';

export const errorHandler: ErrorRequestHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: unknown = undefined;

  // 1. Known Operational Application Errors
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  }
  // 2. Zod Validation Errors
  else if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = err.flatten().fieldErrors;
  }
  // 3. Mongoose CastError (e.g., malformed ObjectId)
  else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Invalid resource identifier format';
  }
  // 4. MongoDB Duplicate Key Error (code 11000)
  else if ((err as { code?: number }).code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    const keyValue = (err as { keyValue?: Record<string, unknown> }).keyValue;
    const field = keyValue ? Object.keys(keyValue)[0] : 'field';
    const val = keyValue ? keyValue[field] : '';
    message = `A resource with ${field} '${val}' already exists`;
  }
  // 5. JSON parse error from express.json()
  else if ('type' in err && (err as { type?: string }).type === 'entity.parse.failed') {
    statusCode = 400;
    code = 'MALFORMED_JSON';
    message = 'Malformed JSON payload in request body';
  }
  // 6. Request payload too large from express.json()
  else if (
    ('type' in err && (err as { type?: string }).type === 'entity.too.large') ||
    ('status' in err && (err as { status?: number }).status === 413)
  ) {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body exceeds the maximum permitted size limit';
  }
  // 5. Unknown / Internal Errors
  else {
    if (env.NODE_ENV === 'development') {
      console.error('Unhandled Server Error:', err);
      message = err.message || message;
      details = err.stack;
    } else {
      console.error(`Unhandled Server Error [${new Date().toISOString()}]:`, err.message);
    }
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
    },
    timestamp: new Date().toISOString(),
  });
};
