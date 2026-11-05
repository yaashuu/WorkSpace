import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  userId: string;
  email: string;
  globalRole: string;
}

export const signToken = (payload: JwtPayload, options?: SignOptions): string => {
  const expiresIn = (options?.expiresIn ?? env.JWT_EXPIRES_IN) as SignOptions['expiresIn'];
  return jwt.sign(payload, env.JWT_SECRET, {
    ...options,
    algorithm: 'HS256',
    expiresIn,
  });
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
  }) as JwtPayload;
};
