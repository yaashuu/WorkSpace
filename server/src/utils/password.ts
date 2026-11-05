import bcrypt from 'bcryptjs';

export const BCRYPT_COST_FACTOR = 12;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, BCRYPT_COST_FACTOR);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};
