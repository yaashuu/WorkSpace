process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import app from '../app';
import {
  connectTestDatabase,
  disconnectDatabase,
  assertTestDatabaseConnection,
} from '../config/database';
import { env, envSchema } from '../config/env';
import { parseAllowedOrigins, isOriginAllowed } from '../config/cors';
import { signToken, verifyToken } from '../utils/jwt';
import { User } from '../models/User';

const TEST_PORT = 5088;
const BASE_URL = `http://localhost:${TEST_PORT}`;

async function runSecurityTests() {
  console.log('================================================================');
  console.log('WorkSpace Phase 9.2 — Backend Security Hardening Verification');
  console.log('================================================================\n');

  // 1. Establish isolated test database connection with Phase 9.1 safety guard
  await connectTestDatabase();
  assertTestDatabaseConnection();

  // 2. Start test server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  console.log(`Test HTTP server listening on ${BASE_URL}\n`);

  let testsPassed = 0;

  try {
    assertTestDatabaseConnection();

    // --------------------------------------------------------------------------
    // Test Suite 1: Helmet Security Headers Verification
    // --------------------------------------------------------------------------
    console.log('--- Suite 1: Helmet Security Headers ---');
    const healthRes = await fetch(`${BASE_URL}/api/v1/health`);
    assert.equal(healthRes.status, 200, 'Health endpoint should return 200');

    // 1a. X-Content-Type-Options: nosniff
    const nosniff = healthRes.headers.get('x-content-type-options');
    assert.equal(nosniff, 'nosniff', 'Expected X-Content-Type-Options: nosniff');

    // 1b. X-Frame-Options: SAMEORIGIN
    const frameOptions = healthRes.headers.get('x-frame-options');
    assert.equal(frameOptions, 'SAMEORIGIN', 'Expected X-Frame-Options: SAMEORIGIN');

    // 1c. X-Download-Options: noopen
    const downloadOptions = healthRes.headers.get('x-download-options');
    assert.equal(downloadOptions, 'noopen', 'Expected X-Download-Options: noopen');

    // 1d. X-DNS-Prefetch-Control: off
    const dnsPrefetch = healthRes.headers.get('x-dns-prefetch-control');
    assert.equal(dnsPrefetch, 'off', 'Expected X-DNS-Prefetch-Control: off');

    // 1e. X-Powered-By header strictly omitted/disabled
    const poweredBy = healthRes.headers.get('x-powered-by');
    assert.equal(poweredBy, null, 'X-Powered-By header must be completely removed');

    // 1f. Cross-Origin-Resource-Policy: cross-origin
    const corp = healthRes.headers.get('cross-origin-resource-policy');
    assert.equal(corp, 'cross-origin', 'Expected Cross-Origin-Resource-Policy: cross-origin');

    console.log('✔ Test 1: Helmet security headers applied (nosniff, SAMEORIGIN, noopen, dns off, x-powered-by stripped).');
    testsPassed++;

    // --------------------------------------------------------------------------
    // Test Suite 2: CORS Hardening Verification
    // --------------------------------------------------------------------------
    console.log('\n--- Suite 2: CORS Hardening ---');

    // 2a. Permitted frontend origin (http://localhost:5173)
    const allowedOrigin = 'http://localhost:5173';
    const corsValidRes = await fetch(`${BASE_URL}/api/v1/health`, {
      method: 'GET',
      headers: { Origin: allowedOrigin },
    });
    assert.equal(corsValidRes.status, 200, 'Request from allowed origin should succeed');
    assert.equal(
      corsValidRes.headers.get('access-control-allow-origin'),
      allowedOrigin,
      'Access-Control-Allow-Origin must match approved origin'
    );
    assert.equal(
      corsValidRes.headers.get('access-control-allow-credentials'),
      'true',
      'Access-Control-Allow-Credentials must be true'
    );

    // 2b. Preflight OPTIONS request for approved origin
    const preflightRes = await fetch(`${BASE_URL}/api/v1/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: allowedOrigin,
        'Access-Control-Request-Method': 'GET',
      },
    });
    assert.equal(preflightRes.status, 204, 'CORS preflight should return 204');
    assert.equal(
      preflightRes.headers.get('access-control-allow-origin'),
      allowedOrigin,
      'Preflight must echo approved origin'
    );

    // 2c. Non-browser client without Origin header (e.g. curl / Postman / health check)
    const noOriginRes = await fetch(`${BASE_URL}/api/v1/health`);
    assert.equal(noOriginRes.status, 200, 'Requests without Origin header must be accepted');

    // 2d. Rejected unauthorized origin (http://evil-attacker.com)
    const evilOrigin = 'http://evil-attacker.com';
    const corsRejectRes = await fetch(`${BASE_URL}/api/v1/health`, {
      method: 'GET',
      headers: { Origin: evilOrigin },
    });
    assert.equal(corsRejectRes.status, 403, 'Request from unauthorized origin must be rejected with 403');
    const corsRejectBody = await corsRejectRes.json();
    assert.equal(corsRejectBody.success, false, 'Expected success: false for CORS rejection');
    assert.equal(corsRejectBody.error.code, 'CORS_ERROR', 'Expected CORS_ERROR code');

    // 2e. Socket.IO origin parsing utility verification
    const devOrigins = parseAllowedOrigins();
    assert.ok(devOrigins.includes('http://localhost:5173'), 'Dev origins must include port 5173');
    assert.ok(devOrigins.includes('http://localhost:5000'), 'Dev origins must include port 5000');
    assert.equal(isOriginAllowed('http://localhost:5173', devOrigins), true, 'Allowed origin check');
    assert.equal(isOriginAllowed('http://evil.com', devOrigins), false, 'Rejected origin check');
    assert.equal(isOriginAllowed(undefined, devOrigins), true, 'No origin allowed for non-browser clients');

    console.log('✔ Test 2: CORS policy strictly enforced (approved origin accepted, evil origin rejected with 403 CORS_ERROR, non-browser clients allowed).');
    testsPassed++;

    // --------------------------------------------------------------------------
    // Test Suite 3: JWT Security & Algorithm Confusion Protection
    // --------------------------------------------------------------------------
    console.log('\n--- Suite 3: JWT Security & Cryptographic Integrity ---');

    // 3a. Token signed with HS256 verifies correctly
    const validPayload = {
      userId: '65a000000000000000000001',
      email: 'sec-user@workspace-test.com',
      globalRole: 'USER',
    };
    const validToken = signToken(validPayload);
    const decoded = verifyToken(validToken);
    assert.equal(decoded.userId, validPayload.userId, 'Decoded userId should match');
    assert.equal(decoded.email, validPayload.email, 'Decoded email should match');
    assert.equal(decoded.globalRole, validPayload.globalRole, 'Decoded globalRole should match');

    // 3b. Expired token is rejected
    const expiredToken = jwt.sign(validPayload, env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '-10s', // expired 10 seconds ago
    });
    assert.throws(
      () => verifyToken(expiredToken),
      (err: any) => err.name === 'TokenExpiredError',
      'verifyToken must throw TokenExpiredError on expired tokens'
    );

    // 3c. Malformed token is rejected
    assert.throws(
      () => verifyToken('not.a.valid.jwt.token'),
      (err: any) => err.name === 'JsonWebTokenError',
      'verifyToken must throw JsonWebTokenError on malformed tokens'
    );

    // 3d. Token signed with wrong secret is rejected
    const wrongSecretToken = jwt.sign(validPayload, 'wrong_secret_key_1234567890_abcdef', {
      algorithm: 'HS256',
      expiresIn: '1h',
    });
    assert.throws(
      () => verifyToken(wrongSecretToken),
      (err: any) => err.name === 'JsonWebTokenError',
      'verifyToken must throw JsonWebTokenError on invalid signature'
    );

    // 3e. Algorithm confusion: token with 'none' algorithm is rejected
    const noneAlgToken = jwt.sign(validPayload, '', {
      algorithm: 'none' as any,
    });
    assert.throws(
      () => verifyToken(noneAlgToken),
      /invalid algorithm|JsonWebTokenError/,
      'verifyToken must strictly reject algorithm "none"'
    );

    // 3f. Authentication middleware response envelope on invalid token
    const authFailRes = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${wrongSecretToken}` },
    });
    assert.equal(authFailRes.status, 401, 'Invalid signature should return 401');
    const authFailBody = await authFailRes.json();
    assert.equal(authFailBody.error.code, 'INVALID_TOKEN', 'Expected INVALID_TOKEN error code');

    // 3g. Authentication middleware response envelope on expired token
    const authExpiredRes = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(authExpiredRes.status, 401, 'Expired token should return 401');
    const authExpiredBody = await authExpiredRes.json();
    assert.equal(authExpiredBody.error.code, 'TOKEN_EXPIRED', 'Expected TOKEN_EXPIRED error code');

    console.log('✔ Test 3: JWT algorithm locked to HS256; expired, malformed, wrong signature, and "none" algorithm rejected.');
    testsPassed++;

    // --------------------------------------------------------------------------
    // Test Suite 4: Production Configuration Validation
    // --------------------------------------------------------------------------
    console.log('\n--- Suite 4: Production Configuration Security ---');

    // 4a. Production fails if JWT_SECRET is less than 32 characters
    const weakProdConfig = {
      PORT: 5000,
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://localhost:27017/workspace',
      JWT_SECRET: 'short_secret_only_16ch', // only 22 chars
      CORS_ORIGIN: 'https://workspace.app',
    };
    const weakProdParsed = envSchema.safeParse(weakProdConfig);
    assert.equal(weakProdParsed.success, false, 'Production configuration must reject weak JWT_SECRET');
    const secretErrors = weakProdParsed.error?.flatten().fieldErrors.JWT_SECRET;
    assert.ok(
      secretErrors && secretErrors.some((m) => m.includes('32 characters')),
      'Error message must specify minimum 32 characters for production'
    );

    // 4b. Production fails if CORS_ORIGIN is wildcard '*'
    const wildcardProdConfig = {
      PORT: 5000,
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://localhost:27017/workspace',
      JWT_SECRET: 'a_very_secure_random_key_of_at_least_32_characters_for_production',
      CORS_ORIGIN: '*',
    };
    const wildcardProdParsed = envSchema.safeParse(wildcardProdConfig);
    assert.equal(wildcardProdParsed.success, false, 'Production configuration must reject wildcard CORS_ORIGIN');
    const corsErrors = wildcardProdParsed.error?.flatten().fieldErrors.CORS_ORIGIN;
    assert.ok(
      corsErrors && corsErrors.some((m) => m.includes('cannot be a wildcard')),
      'Error message must forbid wildcard in production'
    );

    // 4c. Valid production configuration passes
    const validProdConfig = {
      PORT: 5000,
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://localhost:27017/workspace',
      JWT_SECRET: 'a_very_secure_random_key_of_at_least_32_characters_for_production',
      CORS_ORIGIN: 'https://workspace.app,https://admin.workspace.app',
    };
    const validProdParsed = envSchema.safeParse(validProdConfig);
    assert.equal(validProdParsed.success, true, 'Valid production config should succeed');

    console.log('✔ Test 4: Production security invariants enforced (JWT_SECRET min 32 chars, wildcard CORS rejected).');
    testsPassed++;

    // --------------------------------------------------------------------------
    // Test Suite 5: Rate Limiting Verification
    // --------------------------------------------------------------------------
    console.log('\n--- Suite 5: Rate Limiting Enforcement ---');

    // Temporarily enable rate limiter for testing rate limiting behavior
    process.env.ENABLE_TEST_RATE_LIMIT = 'true';

    try {
      // 5a. Repeated login requests to trigger login rate limiter
      const loginAttempts = [];
      for (let i = 0; i < env.RATE_LIMIT_LOGIN_MAX + 3; i++) {
        loginAttempts.push(
          fetch(`${BASE_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'nonexistent@workspace-test.com',
              password: 'WrongPassword123!',
            }),
          })
        );
      }

      const loginResponses = await Promise.all(loginAttempts);
      const rateLimitedRes = loginResponses[loginResponses.length - 1];

      assert.equal(rateLimitedRes.status, 429, 'Excessive login attempts must return 429 Too Many Requests');
      const rateLimitBody = await rateLimitedRes.json();
      assert.equal(rateLimitBody.success, false, 'Expected success: false for rate limit');
      assert.equal(rateLimitBody.error.code, 'RATE_LIMIT_EXCEEDED', 'Expected RATE_LIMIT_EXCEEDED error code');
      assert.ok(
        rateLimitBody.error.message.includes('Too many login attempts'),
        'Informative non-sensitive error message'
      );
      assert.ok(
        rateLimitedRes.headers.get('ratelimit-remaining') !== null ||
          rateLimitedRes.headers.get('retry-after') !== null,
        'Standard RateLimit headers should be present'
      );
    } finally {
      delete process.env.ENABLE_TEST_RATE_LIMIT;
    }

    console.log('✔ Test 5: Login rate limiter triggered at threshold; returned HTTP 429 with standard RATE_LIMIT_EXCEEDED error envelope.');
    testsPassed++;

    console.log('\n================================================================');
    console.log(`All ${testsPassed} Security Hardening test suites PASSED successfully!`);
    console.log('================================================================\n');
  } finally {
    assertTestDatabaseConnection();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectDatabase().catch(() => {});
  }
}

runSecurityTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Security verification failed:', err);
    process.exit(1);
  });
