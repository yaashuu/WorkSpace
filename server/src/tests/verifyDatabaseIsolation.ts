process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  connectTestDatabase,
  disconnectDatabase,
  assertTestDatabaseConnection,
  getTestDatabaseUri,
  sanitizeMongoUri,
  extractDbNameFromUri,
} from '../config/database';
import { setupTestDatabase, teardownTestDatabase, safeTestCleanup } from './testDatabaseHelper';
import { env } from '../config/env';
import { User } from '../models/User';

async function runIsolationTests() {
  console.log('================================================================');
  console.log('WorkSpace Phase 9.1 — Automated Test Database Isolation Verification');
  console.log('================================================================\n');

  let passedTests = 0;

  // --------------------------------------------------------------------------
  // Test 1: Test database URI resolution and strict validation
  // --------------------------------------------------------------------------
  const originalTestUri = process.env.MONGODB_TEST_URI;
  const originalDevUri = process.env.MONGODB_URI;

  try {
    // 1a. Valid resolution
    const resolvedUri = getTestDatabaseUri();
    assert.ok(
      resolvedUri.includes('workspace_test'),
      `Expected resolved URI to target workspace_test, got: ${resolvedUri}`
    );
    assert.ok(
      !resolvedUri.endsWith('/workspace'),
      `Resolved test URI must NEVER target /workspace`
    );

    // 1b. Missing test database configuration aborts
    delete process.env.MONGODB_TEST_URI;
    const originalEnvTestUri = env.MONGODB_TEST_URI;
    (env as any).MONGODB_TEST_URI = undefined;

    let blockedMissing = false;
    try {
      getTestDatabaseUri();
    } catch (err) {
      blockedMissing = true;
      assert.ok(
        (err as Error).message.includes('CRITICAL_TEST_CONFIG_ERROR'),
        `Expected CRITICAL_TEST_CONFIG_ERROR on missing URI, got: ${(err as Error).message}`
      );
    }
    assert.ok(blockedMissing, 'Missing MONGODB_TEST_URI must throw and abort test initialization');

    // 1c. Test URI pointing to development database aborts
    process.env.MONGODB_TEST_URI = 'mongodb://localhost:27017/workspace';
    let blockedDevCollision = false;
    try {
      getTestDatabaseUri();
    } catch (err) {
      blockedDevCollision = true;
      assert.ok(
        (err as Error).message.includes('CRITICAL_TEST_CONFIG_ERROR'),
        `Expected collision error, got: ${(err as Error).message}`
      );
    }
    assert.ok(blockedDevCollision, 'Test URI pointing to workspace must be rejected by getTestDatabaseUri');

    // 1d. Test URI identical to dev URI aborts
    process.env.MONGODB_TEST_URI = env.MONGODB_URI;
    let blockedIdentical = false;
    try {
      getTestDatabaseUri();
    } catch (err) {
      blockedIdentical = true;
      assert.ok(
        (err as Error).message.includes('CRITICAL_TEST_CONFIG_ERROR'),
        `Expected identical URI error, got: ${(err as Error).message}`
      );
    }
    assert.ok(blockedIdentical, 'Test URI identical to development URI must be rejected');

    // Restore env values
    (env as any).MONGODB_TEST_URI = originalEnvTestUri;
  } finally {
    if (originalTestUri !== undefined) {
      process.env.MONGODB_TEST_URI = originalTestUri;
    } else {
      delete process.env.MONGODB_TEST_URI;
    }
    if (originalDevUri !== undefined) {
      process.env.MONGODB_URI = originalDevUri;
    }
  }

  console.log('✔ Test 1: Test database URI resolution, strict validation, and missing config aborts verified.');
  passedTests++;

  // --------------------------------------------------------------------------
  // Test 2: Database URI credential sanitization
  // --------------------------------------------------------------------------
  const rawUriWithCreds = 'mongodb://app_user:super_secret_pw@localhost:27017/workspace_test';
  const sanitized = sanitizeMongoUri(rawUriWithCreds);
  assert.ok(!sanitized.includes('super_secret_pw'), 'Credentials must not be exposed in logs');
  assert.ok(sanitized.includes('****'), 'Credentials must be masked with ****');

  const srvUri = 'mongodb+srv://admin_user:my_secret_token@cluster0.abcde.mongodb.net/workspace_test?retryWrites=true';
  const sanitizedSrv = sanitizeMongoUri(srvUri);
  assert.ok(!sanitizedSrv.includes('my_secret_token'), 'SRV password must not be exposed in logs');
  assert.ok(sanitizedSrv.includes('****'), 'SRV password must be masked with ****');

  console.log('✔ Test 2: Database credentials strictly masked in all logging utilities.');
  passedTests++;

  // --------------------------------------------------------------------------
  // Test 3: Pure In-Memory Unit Verification of assertTestDatabaseConnection
  // (Executes safety guard validation without touching any database)
  // --------------------------------------------------------------------------
  // 3a. Valid test database names accepted
  assert.doesNotThrow(() => {
    assertTestDatabaseConnection({ name: 'workspace_test' });
  }, 'Guard must accept "workspace_test"');

  assert.doesNotThrow(() => {
    assertTestDatabaseConnection({ name: 'integration_test' });
  }, 'Guard must accept any database ending with "_test"');

  // 3b. Development database "workspace" strictly rejected
  assert.throws(
    () => {
      assertTestDatabaseConnection({ name: 'workspace' });
    },
    /CRITICAL_SAFETY_GUARD_BLOCK/,
    'Guard must reject "workspace" with CRITICAL_SAFETY_GUARD_BLOCK'
  );

  // 3c. Non-test databases strictly rejected
  const nonTestDbs = ['production', 'workspace_dev', 'staging_db', 'workspace_prod', 'test_db', ''];
  for (const badDb of nonTestDbs) {
    assert.throws(
      () => {
        assertTestDatabaseConnection({ name: badDb });
      },
      /CRITICAL_SAFETY_GUARD_BLOCK/,
      `Guard must reject "${badDb}" with CRITICAL_SAFETY_GUARD_BLOCK`
    );
  }

  // 3d. Null/undefined connection names strictly rejected
  assert.throws(
    () => {
      assertTestDatabaseConnection({ name: null });
    },
    /CRITICAL_SAFETY_GUARD_BLOCK/,
    'Guard must reject null connection name'
  );

  assert.throws(
    () => {
      assertTestDatabaseConnection(undefined); // Mongoose disconnected
    },
    /CRITICAL_SAFETY_GUARD_BLOCK/,
    'Guard must reject disconnected connection state'
  );

  console.log('✔ Test 3: Safety guard unit assertions verified in-memory (accepts _test, rejects workspace, dev, prod, and empty).');
  passedTests++;

  // --------------------------------------------------------------------------
  // Test 4: Pre-connection safety guard blocks non-test URIs before connection
  // --------------------------------------------------------------------------
  let blockedWorkspaceConn = false;
  try {
    await connectTestDatabase('mongodb://localhost:27017/workspace');
  } catch (err) {
    blockedWorkspaceConn = true;
    assert.ok(
      (err as Error).message.includes('CRITICAL_SAFETY_GUARD_BLOCK'),
      `Expected CRITICAL_SAFETY_GUARD_BLOCK, got: ${(err as Error).message}`
    );
  }
  assert.ok(blockedWorkspaceConn, 'Pre-connection guard must block attempt to connect to "workspace"');
  assert.equal(mongoose.connection.readyState, 0, 'Connection must remain closed after pre-connection block');

  let blockedProdConn = false;
  try {
    await connectTestDatabase('mongodb://localhost:27017/production');
  } catch (err) {
    blockedProdConn = true;
    assert.ok(
      (err as Error).message.includes('CRITICAL_SAFETY_GUARD_BLOCK'),
      `Expected CRITICAL_SAFETY_GUARD_BLOCK for production, got: ${(err as Error).message}`
    );
  }
  assert.ok(blockedProdConn, 'Pre-connection guard must block attempt to connect to "production"');
  assert.equal(mongoose.connection.readyState, 0, 'Connection must remain closed after pre-connection block');

  console.log('✔ Test 4: Pre-connection safety guard blocked connection attempts to workspace and production.');
  passedTests++;

  // --------------------------------------------------------------------------
  // Test 5: Live connection to isolated test database "workspace_test" succeeds
  // --------------------------------------------------------------------------
  await setupTestDatabase();
  assertTestDatabaseConnection();
  assert.equal(mongoose.connection.name, 'workspace_test', 'Active database must be workspace_test');
  console.log('✔ Test 5: Live connection established to isolated workspace_test; safety guard passed.');
  passedTests++;

  // --------------------------------------------------------------------------
  // Test 6: Scoped CRUD and safe cleanup in workspace_test
  // --------------------------------------------------------------------------
  const testEmail = 'isolation-guard@workspace-test.com';

  // Safe cleanup before creating
  await safeTestCleanup(async () => {
    await User.deleteMany({ email: testEmail });
  });

  const createdTestUser = await User.create({
    email: testEmail,
    fullName: 'Isolation Guard User',
    passwordHash: 'dummy_hash_for_test',
    globalRole: 'USER',
    isActive: true,
  });
  assert.ok(createdTestUser._id, 'Record should be created in workspace_test');

  const fetched = await User.findOne({ email: testEmail });
  assert.ok(fetched !== null, 'Record must exist in workspace_test');
  assert.equal(fetched?.email, testEmail, 'Email must match');

  // Safe cleanup after test
  await safeTestCleanup(async () => {
    await User.deleteMany({ email: testEmail });
  });

  const cleaned = await User.findOne({ email: testEmail });
  assert.equal(cleaned, null, 'Record cleanly removed from workspace_test');

  await teardownTestDatabase();
  assert.equal(mongoose.connection.readyState, 0, 'Mongoose disconnected cleanly');
  console.log('✔ Test 6: Scoped CRUD and safeTestCleanup lifecycle in workspace_test verified.');
  passedTests++;

  // --------------------------------------------------------------------------
  // Test 7: Centralized test database helper API verification
  // --------------------------------------------------------------------------
  assert.equal(typeof setupTestDatabase, 'function', 'setupTestDatabase helper exported');
  assert.equal(typeof teardownTestDatabase, 'function', 'teardownTestDatabase helper exported');
  assert.equal(typeof safeTestCleanup, 'function', 'safeTestCleanup helper exported');
  assert.equal(typeof assertTestDatabaseConnection, 'function', 'assertTestDatabaseConnection helper exported');
  console.log('✔ Test 7: Centralized test database helper functions verified and ready for all test suites.');
  passedTests++;

  console.log('\n================================================================');
  console.log(`All ${passedTests} Automated Test Database Isolation tests PASSED!`);
  console.log('================================================================\n');
}

runIsolationTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Isolation test failed:', err);
    process.exit(1);
  });
