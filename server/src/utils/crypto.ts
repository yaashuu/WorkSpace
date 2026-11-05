import crypto from 'crypto';

/**
 * Computes the SHA-256 hex digest of a raw token.
 * Raw invitation tokens are never stored in the database.
 */
export const hashToken = (rawToken: string): string => {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

/**
 * Generates a cryptographically secure 32-byte hex token (64 hex characters)
 * along with its SHA-256 hash.
 */
export const generateInvitationToken = (): { rawToken: string; tokenHash: string } => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
};
