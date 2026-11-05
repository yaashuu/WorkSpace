import { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema } from '../validations/auth';
import { User, toUserProfile } from '../models/User';
import { hashPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { AppError } from '../errors/AppError';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body);

    const existingUser = await User.findOne({ email: validatedData.email });
    if (existingUser) {
      throw new AppError('An account with this email already exists', 409, 'DUPLICATE_EMAIL');
    }

    const passwordHash = await hashPassword(validatedData.password);

    // Strictly hardcode globalRole: 'USER' for public registrations
    // Client-supplied role values are completely ignored
    const user = await User.create({
      email: validatedData.email,
      passwordHash,
      fullName: validatedData.fullName,
      avatarUrl: validatedData.avatarUrl ?? null,
      globalRole: 'USER',
      isActive: true,
    });

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      globalRole: user.globalRole,
    });

    res.status(201).json({
      success: true,
      data: {
        user: toUserProfile(user),
        token,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);

    const user = await User.findOne({ email: validatedData.email });
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await user.comparePassword(validatedData.password);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new AppError('Your account has been deactivated. Please contact support.', 403, 'ACCOUNT_INACTIVE');
    }

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      globalRole: user.globalRole,
    });

    res.status(200).json({
      success: true,
      data: {
        user: toUserProfile(user),
        token,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    res.status(200).json({
      success: true,
      data: {
        user: toUserProfile(req.user),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
