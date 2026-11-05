import mongoose from 'mongoose';
import {
  connectTestDatabase,
  disconnectDatabase,
  assertTestDatabaseConnection,
  getTestDatabaseUri,
  extractDbNameFromUri,
  sanitizeMongoUri,
} from '../config/database';

export interface SetupTestDbOptions {
  customUri?: string;
}

/**
 * Centralized test database initializer.
 * Sets NODE_ENV='test', establishes an isolated test database connection,
 * and asserts that the active database ends with '_test' and is not 'workspace'.
 */
export const setupTestDatabase = async (options?: SetupTestDbOptions): Promise<void> => {
  process.env.NODE_ENV = 'test';
  await connectTestDatabase(options?.customUri);
  assertTestDatabaseConnection();
};

/**
 * Centralized test database teardown.
 * Asserts safety guard before disconnecting to guarantee no dangling operations.
 */
export const teardownTestDatabase = async (): Promise<void> => {
  assertTestDatabaseConnection();
  await disconnectDatabase();
};

/**
 * Centralized safe scoped cleanup wrapper.
 * Runs assertTestDatabaseConnection() before invoking the scoped cleanup callback.
 */
export const safeTestCleanup = async (cleanupFn: () => Promise<void>): Promise<void> => {
  assertTestDatabaseConnection();
  await cleanupFn();
};

export {
  assertTestDatabaseConnection,
  connectTestDatabase,
  disconnectDatabase,
  getTestDatabaseUri,
  extractDbNameFromUri,
  sanitizeMongoUri,
};
