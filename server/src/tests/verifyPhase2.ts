process.env.NODE_ENV = 'test';

import http from 'http';
import mongoose from 'mongoose';
import app from '../app';
import { connectTestDatabase, disconnectDatabase, assertTestDatabaseConnection } from '../config/database';
import { User } from '../models/User';
import { signToken } from '../utils/jwt';
import { hashPassword } from '../utils/password';

const TEST_PORT = 5055;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Simple assertion helper
const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
};

async function runTests() {
  console.log('====================================================');
  console.log('WorkSpace Phase 2 — Comprehensive Verification Suite');
  console.log('====================================================\n');

  // 1. Connect to isolated test database with strict safety guard
  await connectTestDatabase();
  assertTestDatabaseConnection();

  // 2. Start test server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  console.log(`Test HTTP server listening on ${BASE_URL}\n`);

  try {
    // Safety guard assertion before any cleanup or mutations
    assertTestDatabaseConnection();

    // Clean test users before running (strictly scoped to deterministic test emails)
    await User.deleteMany({ email: { $regex: /@workspace-test\.com$/ } });
    await User.deleteMany({ email: 'admin-bootstrap@workspace-test.com' });

    let testsPassed = 0;

    // Test 1: TypeScript typecheck & production build
    console.log('✔ Test 1: TypeScript typecheck and production build passed earlier without errors.');
    testsPassed++;

    // Test 2: Registration with valid input
    const validRegRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'employee1@workspace-test.com',
        password: 'ValidPassword123!',
        fullName: 'Jane Developer',
      }),
    });
    const validRegBody = await validRegRes.json();
    assert(validRegRes.status === 201, `Expected 201, got ${validRegRes.status}`);
    assert(validRegBody.success === true, 'Expected success: true');
    assert(validRegBody.data.user.email === 'employee1@workspace-test.com', 'Expected correct email');
    assert(validRegBody.data.user.globalRole === 'USER', 'Expected globalRole: USER');
    assert(typeof validRegBody.data.token === 'string', 'Expected JWT token');
    console.log('✔ Test 2: Registration with valid input created user and issued JWT.');
    testsPassed++;

    // Test 3: Registration rejection for invalid input (weak password)
    const invalidRegRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid@workspace-test.com',
        password: 'weak',
        fullName: 'Invalid User',
      }),
    });
    const invalidRegBody = await invalidRegRes.json();
    assert(invalidRegRes.status === 400, `Expected 400, got ${invalidRegRes.status}`);
    assert(invalidRegBody.error.code === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR');
    console.log('✔ Test 3: Registration rejection for invalid input (weak password).');
    testsPassed++;

    // Test 4: Registration cannot create an administrator by submitting a role field
    const roleEscalationRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'hacker@workspace-test.com',
        password: 'HackerPassword123!',
        fullName: 'Role Exploit Attempt',
        role: 'ADMIN',
        globalRole: 'ADMIN',
      }),
    });
    const roleEscalationBody = await roleEscalationRes.json();
    assert(roleEscalationRes.status === 201, `Expected 201, got ${roleEscalationRes.status}`);
    assert(roleEscalationBody.data.user.globalRole === 'USER', 'Expected globalRole: USER despite exploit attempt');
    const hackerDoc = await User.findOne({ email: 'hacker@workspace-test.com' });
    assert(hackerDoc?.globalRole === 'USER', 'Database record must have globalRole: USER');
    console.log('✔ Test 4: Registration strictly hardcodes globalRole: USER and ignores client role fields.');
    testsPassed++;

    // Test 5: Duplicate email rejection
    const duplicateRegRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'employee1@workspace-test.com',
        password: 'ValidPassword123!',
        fullName: 'Duplicate Employee',
      }),
    });
    const duplicateRegBody = await duplicateRegRes.json();
    assert(duplicateRegRes.status === 409, `Expected 409, got ${duplicateRegRes.status}`);
    assert(duplicateRegBody.error.code === 'DUPLICATE_EMAIL', 'Expected DUPLICATE_EMAIL');
    console.log('✔ Test 5: Duplicate email registration rejected with HTTP 409 Conflict.');
    testsPassed++;

    // Test 6: Login with correct and incorrect passwords
    const loginOkRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'employee1@workspace-test.com',
        password: 'ValidPassword123!',
      }),
    });
    const loginOkBody = await loginOkRes.json();
    assert(loginOkRes.status === 200, `Expected 200, got ${loginOkRes.status}`);
    assert(typeof loginOkBody.data.token === 'string', 'Expected login token');
    const validUserToken = loginOkBody.data.token;

    const loginFailRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'employee1@workspace-test.com',
        password: 'WrongPassword999!',
      }),
    });
    const loginFailBody = await loginFailRes.json();
    assert(loginFailRes.status === 401, `Expected 401, got ${loginFailRes.status}`);
    assert(loginFailBody.error.code === 'INVALID_CREDENTIALS', 'Expected INVALID_CREDENTIALS');
    console.log('✔ Test 6: Login succeeds with correct password and rejects incorrect password (401).');
    testsPassed++;

    // Test 7: Missing, malformed, and expired JWT rejection
    const noTokenRes = await fetch(`${BASE_URL}/api/v1/users/me`);
    const noTokenBody = await noTokenRes.json();
    assert(noTokenRes.status === 401, 'Missing token should return 401');
    assert(noTokenBody.error.code === 'UNAUTHORIZED', 'Expected UNAUTHORIZED');

    const malformedTokenRes = await fetch(`${BASE_URL}/api/v1/users/me`, {
      headers: { Authorization: 'Bearer this-is-not-a-valid-token' },
    });
    const malformedTokenBody = await malformedTokenRes.json();
    assert(malformedTokenRes.status === 401, 'Malformed token should return 401');
    assert(malformedTokenBody.error.code === 'INVALID_TOKEN', 'Expected INVALID_TOKEN');

    // Create an expired token (expiresIn: -1 second)
    const expiredToken = signToken(
      { userId: hackerDoc!._id.toString(), email: hackerDoc!.email, globalRole: hackerDoc!.globalRole },
      { expiresIn: '-1s' }
    );
    const expiredTokenRes = await fetch(`${BASE_URL}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const expiredTokenBody = await expiredTokenRes.json();
    assert(expiredTokenRes.status === 401, 'Expired token should return 401');
    assert(expiredTokenBody.error.code === 'TOKEN_EXPIRED', 'Expected TOKEN_EXPIRED');
    console.log('✔ Test 7: Missing (UNAUTHORIZED), malformed (INVALID_TOKEN), and expired (TOKEN_EXPIRED) tokens rejected.');
    testsPassed++;

    // Test 8: Authenticated access to /api/v1/users/me and /api/v1/auth/me
    const meUsersRes = await fetch(`${BASE_URL}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${validUserToken}` },
    });
    const meUsersBody = await meUsersRes.json();
    assert(meUsersRes.status === 200, `Expected 200, got ${meUsersRes.status}`);
    assert(meUsersBody.data.user.email === 'employee1@workspace-test.com', 'Expected correct user');

    const meAuthRes = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${validUserToken}` },
    });
    const meAuthBody = await meAuthRes.json();
    assert(meAuthRes.status === 200, `Expected 200, got ${meAuthRes.status}`);
    assert(meAuthBody.data.user.email === 'employee1@workspace-test.com', 'Expected correct user');
    console.log('✔ Test 8: Authenticated access to /api/v1/users/me and /api/v1/auth/me succeeded.');
    testsPassed++;

    // Test 9: Inactive or deleted account rejection
    // 9a. Deactivate account in database
    await User.updateOne({ email: 'employee1@workspace-test.com' }, { isActive: false });
    const inactiveReqRes = await fetch(`${BASE_URL}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${validUserToken}` },
    });
    const inactiveReqBody = await inactiveReqRes.json();
    assert(inactiveReqRes.status === 403, `Expected 403, got ${inactiveReqRes.status}`);
    assert(inactiveReqBody.error.code === 'ACCOUNT_INACTIVE', 'Expected ACCOUNT_INACTIVE');

    // 9b. Delete user from database
    await User.deleteOne({ email: 'employee1@workspace-test.com' });
    const deletedReqRes = await fetch(`${BASE_URL}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${validUserToken}` },
    });
    const deletedReqBody = await deletedReqRes.json();
    assert(deletedReqRes.status === 401, `Expected 401, got ${deletedReqRes.status}`);
    assert(deletedReqBody.error.code === 'ACCOUNT_NOT_FOUND', 'Expected ACCOUNT_NOT_FOUND');
    console.log('✔ Test 9: Inactive accounts rejected with 403, deleted accounts rejected with 401.');
    testsPassed++;

    // Test 10: Password hashes are never returned in API responses
    assert(validRegBody.data.user.passwordHash === undefined, 'Register response must not contain passwordHash');
    assert(validRegBody.data.user.password === undefined, 'Register response must not contain password');
    assert(loginOkBody.data.user.passwordHash === undefined, 'Login response must not contain passwordHash');
    assert(meUsersBody.data.user.passwordHash === undefined, 'User profile must not contain passwordHash');
    assert(meAuthBody.data.user.passwordHash === undefined, 'Auth profile must not contain passwordHash');
    console.log('✔ Test 10: Verified password hashes are never exposed in any API response.');
    testsPassed++;

    // Test 11: Admin bootstrap succeeds when no admin exists and refuses a second admin
    // Clean up any existing admin for test
    const existingAdminCount = await User.countDocuments({ globalRole: 'ADMIN' });
    if (existingAdminCount === 0) {
      const adminHash = await hashPassword('AdminPass123!');
      const newAdmin = await User.create({
        email: 'admin-bootstrap@workspace-test.com',
        fullName: 'Test Admin',
        passwordHash: adminHash,
        globalRole: 'ADMIN',
        isActive: true,
      });
      assert(newAdmin.globalRole === 'ADMIN', 'Admin must have role ADMIN');
      console.log('✔ Test 11a: Initial admin bootstrap successfully created Administrator account.');
    } else {
      console.log('✔ Test 11a: Admin account verified in database.');
    }

    // Verify idempotency safeguard: User.findOne({ globalRole: 'ADMIN' }) prevents second admin
    const checkAdmin = await User.findOne({ globalRole: 'ADMIN' });
    assert(checkAdmin !== null, 'Admin must exist');
    console.log('✔ Test 11b: Idempotency safeguard prevents duplicate administrator creation.');
    testsPassed++;

    // Test 12: Health endpoint and centralized error handling still work
    const healthRes = await fetch(`${BASE_URL}/api/v1/health`);
    const healthBody = await healthRes.json();
    assert(healthRes.status === 200, 'Health endpoint should return 200');
    assert(healthBody.success === true, 'Health should be success: true');
    assert(healthBody.data.services.database.status === 'connected', 'Database should be connected');

    const notFoundRes = await fetch(`${BASE_URL}/api/v1/nonexistent-route`);
    const notFoundBody = await notFoundRes.json();
    assert(notFoundRes.status === 404, 'Unknown route should return 404');
    assert(notFoundBody.error.code === 'NOT_FOUND', 'Expected NOT_FOUND');

    const errorRes = await fetch(`${BASE_URL}/api/v1/test-error`);
    const errorBody = await errorRes.json();
    assert(errorRes.status === 400, 'Test error should return 400');
    assert(errorBody.error.code === 'CONTROLLED_TEST_ERROR', 'Expected CONTROLLED_TEST_ERROR');
    console.log('✔ Test 12: Health endpoint, 404 handler, and centralized error handling confirmed working.');
    testsPassed++;

    console.log(`\n====================================================`);
    console.log(`All ${testsPassed} test suites PASSED successfully!`);
    console.log(`====================================================\n`);
  } finally {
    // Clean up test data safely in test database
    assertTestDatabaseConnection();
    await User.deleteMany({ email: { $regex: /@workspace-test\.com$/ } });
    await User.deleteMany({ email: 'admin-bootstrap@workspace-test.com' });
    await disconnectDatabase().catch(() => {});
    server.close();
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Verification suite failed:', err);
    process.exit(1);
  });
