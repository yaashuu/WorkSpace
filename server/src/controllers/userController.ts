import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';

export interface EligibleManagerResponse {
  _id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

/**
 * GET /api/v1/users/eligible-managers
 * Admin-only endpoint returning active standard user accounts eligible for Primary Project Manager designation.
 * Strictly excludes inactive accounts, administrator accounts, password hashes, and sensitive internal fields.
 */
export const getEligibleManagers = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Spec 3.1 & 3.2: Only active user accounts with globalRole 'USER' are eligible for Primary PM roles.
    const eligibleUsers = await User.find({
      globalRole: 'USER',
      isActive: true,
    })
      .select('_id fullName email avatarUrl')
      .sort({ fullName: 1, email: 1 });

    const managers: EligibleManagerResponse[] = eligibleUsers.map((u) => ({
      _id: u._id.toString(),
      fullName: u.fullName,
      email: u.email,
      avatarUrl: u.avatarUrl ?? null,
    }));

    res.status(200).json({
      success: true,
      data: {
        managers,
        total: managers.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
