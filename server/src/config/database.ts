import mongoose from 'mongoose';
import { env } from './env';

export const sanitizeMongoUri = (uri: string): string => {
  try {
    const parsed = new URL(uri);
    if (parsed.password) {
      parsed.password = '****';
    }
    return parsed.toString();
  } catch {
    return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+(@.+)/, '$1****$2');
  }
};

/**
 * Extracts database name from a MongoDB connection URI.
 */
export const extractDbNameFromUri = (uri: string): string => {
  try {
    const parsed = new URL(uri);
    return parsed.pathname.replace(/^\//, '').split('?')[0].trim();
  } catch {
    const match = uri.match(/\/([^/?]+)(?:\?|$)/);
    return match ? match[1].trim() : '';
  }
};

/**
 * Resolves the automated test database URI independently from development.
 * Strictly guarantees that test execution never falls back to the development database.
 * Throws immediately if MONGODB_TEST_URI is missing, identical to development, or non-test.
 */
export const getTestDatabaseUri = (): string => {
  const testUri = process.env.MONGODB_TEST_URI || env.MONGODB_TEST_URI;
  if (!testUri || testUri.trim().length === 0) {
    throw new Error(
      'CRITICAL_TEST_CONFIG_ERROR: Missing MONGODB_TEST_URI environment configuration. ' +
      'Automated tests require an explicit MONGODB_TEST_URI ending with "_test" (e.g. mongodb://localhost:27017/workspace_test).'
    );
  }

  const trimmed = testUri.trim();

  // Validate that testUri is not configured to point to development database
  const devUri = (process.env.MONGODB_URI || env.MONGODB_URI || '').trim();
  if (devUri && trimmed === devUri) {
    throw new Error(
      'CRITICAL_TEST_CONFIG_ERROR: MONGODB_TEST_URI cannot be identical to development MONGODB_URI. ' +
      'Automated tests must be isolated to a dedicated database ending with "_test".'
    );
  }

  const targetDb = extractDbNameFromUri(trimmed);
  const devDb = devUri ? extractDbNameFromUri(devUri) : 'workspace';

  if (!targetDb || targetDb === 'workspace' || targetDb === devDb || !targetDb.endsWith('_test')) {
    throw new Error(
      `CRITICAL_TEST_CONFIG_ERROR: MONGODB_TEST_URI database "${targetDb || 'UNKNOWN'}" is invalid. ` +
      `Automated test database name MUST end with "_test" (e.g. "workspace_test") and CANNOT be "${devDb || 'workspace'}".`
    );
  }

  return trimmed;
};

/**
 * Strict Database Safety Guard.
 * Enforces that any automated test suite MUST only execute against an isolated database
 * whose name ends with "_test" (e.g. "workspace_test"), and immediately aborts if
 * configured with "workspace" or any other non-test database.
 */
export const assertTestDatabaseConnection = (connection?: { name?: string | null }): void => {
  const conn = connection || mongoose.connection;
  const dbName = conn?.name?.trim() || '';

  // Extract development database name from env.MONGODB_URI
  let devDbName = 'workspace';
  const devUri = process.env.MONGODB_URI || env.MONGODB_URI || '';
  if (devUri) {
    const extracted = extractDbNameFromUri(devUri);
    if (extracted) devDbName = extracted;
  }

  if (!dbName || dbName === 'workspace' || dbName === devDbName || !dbName.endsWith('_test')) {
    const errorMsg =
      `\n================================================================================\n` +
      `❌ CRITICAL DATABASE SAFETY GUARD VIOLATION\n` +
      `================================================================================\n` +
      `Automated tests attempted to execute against a non-test database: "${dbName || 'UNKNOWN'}".\n` +
      `Automated tests are strictly forbidden from modifying or accessing "${dbName || 'UNKNOWN'}".\n` +
      `The active database name MUST end with "_test" (e.g. "workspace_test") and CANNOT be "${devDbName}".\n` +
      `Execution has been ABORTED immediately before any setup, cleanup, or data mutations.\n` +
      `================================================================================\n`;
    console.error(errorMsg);
    throw new Error(
      `CRITICAL_SAFETY_GUARD_BLOCK: Execution aborted. Database "${dbName}" is not an isolated test database.`
    );
  }
};

/**
 * Connects specifically to the isolated test database and executes the safety guard.
 */
export const connectTestDatabase = async (customUri?: string): Promise<void> => {
  process.env.NODE_ENV = 'test';

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // Pre-connection check: Resolve and validate test URI
  let testUri: string;
  if (customUri) {
    const trimmed = customUri.trim();
    const customDb = extractDbNameFromUri(trimmed);
    const devUri = process.env.MONGODB_URI || env.MONGODB_URI || '';
    const devDb = devUri ? extractDbNameFromUri(devUri) : 'workspace';

    if (!customDb || customDb === 'workspace' || customDb === devDb || !customDb.endsWith('_test')) {
      const errorMsg =
        `\n================================================================================\n` +
        `❌ CRITICAL DATABASE SAFETY GUARD VIOLATION (PRE-CONNECTION)\n` +
        `================================================================================\n` +
        `Target URI database "${customDb || 'UNKNOWN'}" is not an isolated test database.\n` +
        `Automated tests are strictly forbidden from connecting to "${customDb || 'UNKNOWN'}".\n` +
        `Execution has been ABORTED immediately before opening a connection.\n` +
        `================================================================================\n`;
      console.error(errorMsg);
      throw new Error(
        `CRITICAL_SAFETY_GUARD_BLOCK: Pre-connection aborted. Target database "${customDb}" is not an isolated test database.`
      );
    }
    testUri = trimmed;
  } else {
    testUri = getTestDatabaseUri();
  }

  try {
    const conn = await mongoose.connect(testUri, {
      serverSelectionTimeoutMS: 5000,
    });

    // Enforce safety guard immediately on the established connection
    assertTestDatabaseConnection(conn.connection);

    const host = conn.connection.host || 'unknown';
    const port = conn.connection.port || 27017;
    const dbName = conn.connection.name || 'unknown';

    console.log(`Connected to Isolated Test MongoDB: ${host}:${port}/${dbName}`);
  } catch (error) {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
    const sanitized = sanitizeMongoUri(testUri);
    console.error(`Test database connection failed at ${sanitized}: ${(error as Error).message}`);
    throw error;
  }
};

/**
 * Connects to MongoDB.
 * If NODE_ENV is "test", automatically delegates to connectTestDatabase to prevent
 * accidental connection to development/production data.
 */
export const connectDatabase = async (customUri?: string): Promise<void> => {
  if (process.env.NODE_ENV === 'test') {
    return connectTestDatabase(customUri);
  }

  try {
    const targetUri = customUri || env.MONGODB_URI;
    const conn = await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 5000,
    });

    const host = conn.connection.host || 'unknown';
    const port = conn.connection.port || 27017;
    const dbName = conn.connection.name || 'unknown';

    console.log(`Connected to MongoDB: ${host}:${port}/${dbName}`);
  } catch (error) {
    const sanitized = sanitizeMongoUri(customUri || env.MONGODB_URI);
    console.error(`Failed to connect to MongoDB at ${sanitized}: ${(error as Error).message}`);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
  }
};

export const isDatabaseConnected = (): boolean => {
  return mongoose.connection.readyState === 1;
};
