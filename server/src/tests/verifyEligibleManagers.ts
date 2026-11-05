process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../app';
import { connectTestDatabase, disconnectDatabase, assertTestDatabaseConnection } from '../config/database';
import { User } from '../models/User';
import { hashPassword } from '../utils/password';
import { signToken } from '../utils/jwt';

const TEST_PORT = 5070;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

const runTests = async () => {
  console.log('====================================================');
  console.log('WorkSpace — Eligible Managers Endpoint Verification');
  console.log('====================================================\n');

  await connectTestDatabase();
  assertTestDatabaseConnection();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(TEST_PORT, () => {
      console.log(`Test HTTP server listening on ${BASE_URL}\n`);
      resolve();
    });
  });

  try {
    // Safety guard assertion before any cleanup or mutations
    assertTestDatabaseConnection();

    // ------------------------------------------------------------------------
    // Setup Isolated Test Users
    // ------------------------------------------------------------------------
    const testDomain = 'eligible-mgr-test.com';
    const pwdHash = await hashPassword('TestPass123!');

    // Cleanup any lingering records from previous test runs (strictly scoped)
    await User.deleteMany({ email: new RegExp(`@${testDomain}$`) });

    // 1. Test Admin
    const testAdmin = await User.create({
      email: `admin@${testDomain}`,
      fullName: 'Test Administrator',
      passwordHash: pwdHash,
      avatarUrl: 'https://images.example.com/admin.png',
      globalRole: 'ADMIN',
      isActive: true,
    });
    const adminToken = signToken({
      userId: testAdmin._id.toString(),
      email: testAdmin.email,
      globalRole: 'ADMIN',
    });

    // 2. Test Regular Employee User (Active)
    const testEmployee = await User.create({
      email: `employee@${testDomain}`,
      fullName: 'Active Test Employee',
      passwordHash: pwdHash,
      avatarUrl: 'https://images.example.com/emp.png',
      globalRole: 'USER',
      isActive: true,
    });
    const employeeToken = signToken({
      userId: testEmployee._id.toString(),
      email: testEmployee.email,
      globalRole: 'USER',
    });

    // 3. Test Inactive User
    const testInactive = await User.create({
      email: `inactive@${testDomain}`,
      fullName: 'Deactivated User',
      passwordHash: pwdHash,
      avatarUrl: null,
      globalRole: 'USER',
      isActive: false,
    });

    let passedTests = 0;

    // ------------------------------------------------------------------------
    // Test 1: Unauthenticated request is rejected with 401 UNAUTHORIZED
    // ------------------------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/users/eligible-managers`);
      const body = await res.json();

      assert.equal(res.status, 401, 'Expected 401 for unauthenticated request');
      assert.equal(body.success, false, 'Expected success === false');
      assert.equal(body.error.code, 'UNAUTHORIZED', 'Expected UNAUTHORIZED error code');
      passedTests++;
      console.log('✔ Test 1: Unauthenticated request cleanly rejected (401 UNAUTHORIZED).');
    }

    // ------------------------------------------------------------------------
    // Test 2: Invalid / Malformed token is rejected with 401
    // ------------------------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/users/eligible-managers`, {
        headers: { Authorization: 'Bearer invalid.token.payload' },
      });
      const body = await res.json();

      assert.equal(res.status, 401, 'Expected 401 for invalid token');
      assert.equal(body.success, false);
      passedTests++;
      console.log('✔ Test 2: Invalid token cleanly rejected (401).');
    }

    // ------------------------------------------------------------------------
    // Test 3: Non-admin user (Regular Employee) is rejected with 403 FORBIDDEN
    // ------------------------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/users/eligible-managers`, {
        headers: { Authorization: `Bearer ${employeeToken}` },
      });
      const body = await res.json();

      assert.equal(res.status, 403, 'Expected 403 for non-admin user');
      assert.equal(body.success, false, 'Expected success === false');
      assert.equal(body.error.code, 'FORBIDDEN', 'Expected FORBIDDEN error code');
      passedTests++;
      console.log('✔ Test 3: Non-admin user rejected with 403 FORBIDDEN.');
    }

    // ------------------------------------------------------------------------
    // Test 4: Administrator can retrieve eligible managers (200 OK)
    // ------------------------------------------------------------------------
    let managersList: any[] = [];
    {
      const res = await fetch(`${BASE_URL}/users/eligible-managers`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const body = await res.json();

      assert.equal(res.status, 200, 'Expected 200 OK for admin request');
      assert.equal(body.success, true, 'Expected success === true');
      assert.ok(Array.isArray(body.data.managers), 'Expected data.managers array');
      assert.equal(body.data.total, body.data.managers.length, 'Expected total to equal array length');
      assert.ok(body.data.total >= 1, 'Expected at least one eligible manager in the system');

      managersList = body.data.managers;
      passedTests++;
      console.log(`✔ Test 4: Administrator retrieved ${body.data.total} eligible managers (200 OK).`);
    }

    // ------------------------------------------------------------------------
    // Test 5: Inactive or ineligible accounts are strictly excluded
    // ------------------------------------------------------------------------
    {
      const returnedEmails = managersList.map((m: any) => m.email);

      // Active employee must be present
      assert.ok(
        returnedEmails.includes(testEmployee.email),
        `Expected active employee ${testEmployee.email} to be in eligible list`
      );

      // Inactive user must NOT be present
      assert.ok(
        !returnedEmails.includes(testInactive.email),
        `Inactive user ${testInactive.email} must NOT be in eligible list`
      );

      // Administrator must NOT be in eligible managers list
      assert.ok(
        !returnedEmails.includes(testAdmin.email),
        `Administrator ${testAdmin.email} must NOT be in eligible managers list`
      );

      passedTests++;
      console.log('✔ Test 5: Inactive users and administrators strictly excluded from eligible managers.');
    }

    // ------------------------------------------------------------------------
    // Test 6: Sensitive fields are NOT exposed in API response
    // ------------------------------------------------------------------------
    {
      for (const m of managersList) {
        assert.equal(m.passwordHash, undefined, 'passwordHash must never be exposed');
        assert.equal(m.__v, undefined, '__v must never be exposed');
        assert.ok(typeof m._id === 'string' && m._id.length === 24, 'Valid string _id required');
        assert.ok(typeof m.fullName === 'string' && m.fullName.length > 0, 'Valid fullName required');
        assert.ok(typeof m.email === 'string' && m.email.includes('@'), 'Valid email required');
        assert.ok(
          m.avatarUrl === null || typeof m.avatarUrl === 'string',
          'avatarUrl must be null or string'
        );
      }
      passedTests++;
      console.log('✔ Test 6: Response payload strictly sanitized (no password hashes or sensitive internal fields).');
    }

    // ------------------------------------------------------------------------
    // Cleanup Test Records (safely in test database)
    // ------------------------------------------------------------------------
    assertTestDatabaseConnection();
    await User.deleteMany({ email: new RegExp(`@${testDomain}$`) });

    console.log('\n====================================================');
    console.log(`All ${passedTests} verification tests PASSED successfully!`);
    console.log('====================================================\n');
  } finally {
    assertTestDatabaseConnection();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectDatabase();
  }
};

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
