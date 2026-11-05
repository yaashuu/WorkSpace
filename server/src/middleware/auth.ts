import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { User, IUser, GlobalRole } from '../models/User';
import { AppError } from '../errors/AppError';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication token required', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AppError('Authentication token required', 401, 'UNAUTHORIZED');
    }

    let decoded: JwtPayload;
    try {
      decoded = verifyToken(token);
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'TokenExpiredError') {
        throw new AppError('Authentication token has expired', 401, 'TOKEN_EXPIRED');
      }
      throw new AppError('Invalid authentication token', 401, 'INVALID_TOKEN');
    }

    // Always fetch fresh user record from database to avoid stale permissions or status
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new AppError('Account no longer exists', 401, 'ACCOUNT_NOT_FOUND');
    }

    if (!user.isActive) {
      throw new AppError('Account is inactive', 403, 'ACCOUNT_INACTIVE');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (...roles: GlobalRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }

    if (!roles.includes(req.user.globalRole)) {
      return next(new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN'));
    }

    next();
  };
};

export const requireAdmin = requireRole('ADMIN');
