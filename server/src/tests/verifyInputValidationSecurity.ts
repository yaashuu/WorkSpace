process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../app';
import {
  connectTestDatabase,
  disconnectDatabase,
  assertTestDatabaseConnection,
} from '../config/database';
import { signToken } from '../utils/jwt';
import bcrypt from 'bcryptjs';

import { User } from '../models/User';
import { Project } from '../models/Project';
import { ProjectMembership } from '../models/ProjectMembership';
import { Task } from '../models/Task';
import { TaskComment } from '../models/TaskComment';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { Notification } from '../models/Notification';
import { ActivityLog } from '../models/ActivityLog';

const TEST_PORT = 5090;
const BASE_URL = `http://localhost:${TEST_PORT}`;

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

async function testCase(name: string, category: string, fn: () => Promise<void>) {
  testsRun++;
  try {
    await fn();
    testsPassed++;
    console.log(`  ✔ [PASS] [${category}] ${name}`);
  } catch (err: any) {
    testsFailed++;
    console.error(`  ✘ [FAIL] [${category}] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function cleanupValidationTestData() {
  assertTestDatabaseConnection();

  const testUsers = await User.find({ email: { $regex: /@val-test\.com$/i } });
  const testUserIds = testUsers.map((u) => u._id);

  const testProjects = await Project.find({
    name: { $regex: /^Val Test/ },
  });
  const testProjectIds = testProjects.map((p) => p._id);

  if (testUserIds.length > 0 || testProjectIds.length > 0) {
    await TaskComment.deleteMany({
      $or: [{ authorId: { $in: testUserIds } }, { projectId: { $in: testProjectIds } }],
    });
    await Task.deleteMany({
      $or: [{ projectId: { $in: testProjectIds } }, { assigneeId: { $in: testUserIds } }],
    });
    await ProjectMembership.deleteMany({
      $or: [{ projectId: { $in: testProjectIds } }, { userId: { $in: testUserIds } }],
    });
    await Message.deleteMany({
      senderId: { $in: testUserIds },
    });
    await Conversation.deleteMany({
      $or: [{ projectId: { $in: testProjectIds } }, { participants: { $in: testUserIds } }],
    });
    await Notification.deleteMany({
      recipientId: { $in: testUserIds },
    });
    await ActivityLog.deleteMany({
      $or: [{ projectId: { $in: testProjectIds } }, { actorId: { $in: testUserIds } }],
    });
    await Project.deleteMany({ _id: { $in: testProjectIds } });
    await User.deleteMany({ _id: { $in: testUserIds } });
  }
}

async function runValidationSecurityTests() {
  console.log('================================================================');
  console.log('WorkSpace Phase 9.4 — Input Validation & Data Integrity Tests');
  console.log('================================================================\n');

  // 1. Establish isolated test database connection with Phase 9.1 safety guard
  await connectTestDatabase();
  assertTestDatabaseConnection();

  // 2. Initial scoped cleanup
  await cleanupValidationTestData();

  // 3. Start test HTTP server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  console.log(`Test HTTP server listening on ${BASE_URL}\n`);

  try {
    assertTestDatabaseConnection();

    // --------------------------------------------------------------------------
    // SEED TEST USERS & PROJECTS
    // --------------------------------------------------------------------------
    console.log('--- Seeding Isolated Validation Test Fixtures ---');
    const passwordHash = await bcrypt.hash('ValTest123!', 4);

    const adminUser = await User.create({
      email: 'admin@val-test.com',
      passwordHash,
      fullName: 'Validation Admin',
      globalRole: 'ADMIN',
      isActive: true,
    });

    const pmUser = await User.create({
      email: 'pm@val-test.com',
      passwordHash,
      fullName: 'Validation Project Manager',
      globalRole: 'USER',
      isActive: true,
    });

    const empUserA = await User.create({
      email: 'empa@val-test.com',
      passwordHash,
      fullName: 'Validation Member A',
      globalRole: 'USER',
      isActive: true,
    });

    const empUserB = await User.create({
      email: 'empb@val-test.com',
      passwordHash,
      fullName: 'Validation Member B (Isolated Project B)',
      globalRole: 'USER',
      isActive: true,
    });

    const inactiveUser = await User.create({
      email: 'inactive@val-test.com',
      passwordHash,
      fullName: 'Validation Inactive Account',
      globalRole: 'USER',
      isActive: false,
    });

    const adminToken = signToken({
      userId: adminUser._id.toString(),
      email: adminUser.email,
      globalRole: adminUser.globalRole,
    });
    const pmToken = signToken({
      userId: pmUser._id.toString(),
      email: pmUser.email,
      globalRole: pmUser.globalRole,
    });
    const empAToken = signToken({
      userId: empUserA._id.toString(),
      email: empUserA.email,
      globalRole: empUserA.globalRole,
    });

    // Project A: PM: pmUser, Member: empUserA
    const projectA = await Project.create({
      name: 'Val Test Project A',
      key: 'VALA',
      description: 'Project for input validation tests',
      visibility: 'PUBLIC',
      primaryManagerId: pmUser._id,
      createdBy: adminUser._id,
      status: 'ACTIVE',
    });
    await ProjectMembership.create({
      projectId: projectA._id,
      userId: pmUser._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });
    await ProjectMembership.create({
      projectId: projectA._id,
      userId: empUserA._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });

    // Project B: Member: empUserB
    const projectB = await Project.create({
      name: 'Val Test Project B',
      key: 'VALB',
      description: 'Isolated Project B',
      visibility: 'PRIVATE',
      primaryManagerId: adminUser._id,
      createdBy: adminUser._id,
      status: 'ACTIVE',
    });
    await ProjectMembership.create({
      projectId: projectB._id,
      userId: empUserB._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });

    // Seed task in Project A
    const taskA1 = await Task.create({
      projectId: projectA._id,
      title: 'Initial Valid Task',
      description: 'Initial Description',
      status: 'TODO',
      priority: 'MEDIUM',
      assigneeId: empUserA._id,
      creatorId: pmUser._id,
      position: 1000,
      version: 0,
    });

    // Seed conversation for Project A
    const convA = await Conversation.create({
      type: 'PROJECT_GROUP',
      projectId: projectA._id,
      participants: [pmUser._id, empUserA._id],
      lastMessageAt: new Date(),
    });

    console.log('✔ Validation test fixtures seeded successfully.\n');

    // --------------------------------------------------------------------------
    // Suite 1: NoSQL Injection Protection
    // --------------------------------------------------------------------------
    console.log('--- Suite 1: NoSQL Injection Protection ---');

    await testCase(
      'Login rejecting $ne operator injection in body (expects 400 VALIDATION_ERROR)',
      'NOSQL_INJECTION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: { $ne: null },
            password: 'ValTest123!',
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 400);
        assert.equal(body.error?.code, 'VALIDATION_ERROR');
      }
    );

    await testCase(
      'Registration rejecting $gt operator injection in email (expects 400 VALIDATION_ERROR)',
      'NOSQL_INJECTION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: { $gt: '' },
            password: 'HackerPassword123!',
            fullName: 'NoSQL Attacker',
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 400);
        assert.equal(body.error?.code, 'VALIDATION_ERROR');
      }
    );

    await testCase(
      'URL parameter injection with malformed / operator ObjectId (expects 400 INVALID_ID)',
      'NOSQL_INJECTION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/%24ne`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const body = await res.json();
        assert.equal(res.status, 400);
        assert.equal(body.error?.code, 'INVALID_ID');
      }
    );

    await testCase(
      'URL parameter with nested array / invalid format (expects 400 INVALID_ID)',
      'NOSQL_INJECTION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/tasks/123-not-an-objectid`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const body = await res.json();
        assert.equal(res.status, 400);
        assert.equal(body.error?.code, 'INVALID_ID');
      }
    );

    await testCase(
      'Task query filter with nested $ne operator ignored/safely handled (expects 200 OK)',
      'NOSQL_INJECTION',
      async () => {
        // Query param status[$ne]=DONE
        const res = await fetch(
          `${BASE_URL}/api/v1/projects/${projectA._id}/tasks?status[%24ne]=DONE`,
          {
            headers: { Authorization: `Bearer ${pmToken}` },
          }
        );
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(Array.isArray(body.data));
      }
    );

    await testCase(
      'Task creation rejecting $where operator in assigneeId (expects 400 VALIDATION_ERROR)',
      'NOSQL_INJECTION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectA._id}/tasks`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Task with NoSQL assignee',
            assigneeId: { $where: 'sleep(1000)' },
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 400);
        assert.equal(body.error?.code, 'VALIDATION_ERROR');
      }
    );

    // --------------------------------------------------------------------------
    // Suite 2: Cross-Site Scripting (XSS) & Dangerous Protocols
    // --------------------------------------------------------------------------
    console.log('\n--- Suite 2: Cross-Site Scripting (XSS) & Dangerous Protocol Protection ---');

    await testCase(
      'Registration rejecting javascript: scheme in avatarUrl (expects 400 VALIDATION_ERROR)',
      'XSS_PROTOCOL_INJECTION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'xss-avatar@val-test.com',
            password: 'ValidPassword123!',
            fullName: 'XSS Target',
            avatarUrl: 'javascript:alert(document.cookie)',
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 400);
        assert.equal(body.error?.code, 'VALIDATION_ERROR');
      }
    );

    await testCase(
      'Registration rejecting data: scheme in avatarUrl (expects 400 VALIDATION_ERROR)',
      'XSS_PROTOCOL_INJECTION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'data-avatar@val-test.com',
            password: 'ValidPassword123!',
            fullName: 'Data Target',
            avatarUrl: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 400);
        assert.equal(body.error?.code, 'VALIDATION_ERROR');
      }
    );

    await testCase(
      'Task creation safely storing <script> and HTML payloads as literal text (expects 201 OK)',
      'XSS_CONTENT_HANDLING',
      async () => {
        const xssTitle = '<script>alert("XSS")</script>';
        const xssDesc = '<img src=x onerror=alert("img-xss")>';
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectA._id}/tasks`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: xssTitle,
            description: xssDesc,
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 201);
        assert.equal(body.data?.title, xssTitle, 'Title must be preserved as literal plain text');
        assert.equal(body.data?.description, xssDesc, 'Description must be preserved as literal plain text');
      }
    );

    await testCase(
      'Task comment safely storing SVG and event handler payloads (expects 201 OK)',
      'XSS_CONTENT_HANDLING',
      async () => {
        const svgPayload = '<svg onload=alert(document.domain)>';
        const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskA1._id}/comments`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${empAToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: svgPayload,
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 201);
        assert.equal(body.data?.content, svgPayload);
      }
    );

    await testCase(
      'Chat message preserving complex Unicode and punctuation intact (expects 201 Created)',
      'UNICODE_INTEGRITY',
      async () => {
        const complexMsg = 'Hello 世界! 🚀 Special punctuation: & < > " \' / \\ $100 — 100% functional.';
        const res = await fetch(`${BASE_URL}/api/v1/conversations/${convA._id}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${empAToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: complexMsg,
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 201);
        assert.equal(body.data?.content, complexMsg);
      }
    );

    // --------------------------------------------------------------------------
    // Suite 3: Zod Schema Hardening & Whitespace Validation
    // --------------------------------------------------------------------------
    console.log('\n--- Suite 3: Zod Schema Hardening & String Boundaries ---');

    await testCase(
      'Project creation rejecting whitespace-only name (expects 400 VALIDATION_ERROR)',
      'WHITESPACE_VALIDATION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: '     ',
            key: 'WSKEY',
            primaryManagerId: pmUser._id.toString(),
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 400);
        assert.equal(body.error?.code, 'VALIDATION_ERROR');
      }
    );

    await testCase(
      'Task creation rejecting whitespace-only title (expects 400 VALIDATION_ERROR)',
      'WHITESPACE_VALIDATION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectA._id}/tasks`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: '    ',
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 400);
        assert.equal(body.error?.code, 'VALIDATION_ERROR');
      }
    );

    await testCase(
      'Comment creation rejecting empty / whitespace-only content (expects 400 VALIDATION_ERROR)',
      'WHITESPACE_VALIDATION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskA1._id}/comments`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${empAToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: '    ',
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 400);
        assert.equal(body.error?.code, 'VALIDATION_ERROR');
      }
    );

    await testCase(
      'Chat message rejecting whitespace-only message (expects 400 VALIDATION_ERROR)',
      'WHITESPACE_VALIDATION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/conversations/${convA._id}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${empAToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: '   ',
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 400);
        assert.equal(body.error?.code, 'VALIDATION_ERROR');
      }
    );

    await testCase(
      'Project key boundary: 1 char rejected (expects 400 VALIDATION_ERROR)',
      'STRING_BOUNDARY',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Short Key Project',
            key: 'A',
            primaryManagerId: pmUser._id.toString(),
          }),
        });
        assert.equal(res.status, 400);
      }
    );

    await testCase(
      'Project key boundary: 11 chars rejected (expects 400 VALIDATION_ERROR)',
      'STRING_BOUNDARY',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Long Key Project',
            key: 'TOOLONGKEY1',
            primaryManagerId: pmUser._id.toString(),
          }),
        });
        assert.equal(res.status, 400);
      }
    );

    await testCase(
      'Project key rejecting lowercase or special characters (expects 400 VALIDATION_ERROR)',
      'STRING_BOUNDARY',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Invalid Key Project',
            key: 'KEY-1',
            primaryManagerId: pmUser._id.toString(),
          }),
        });
        assert.equal(res.status, 400);
      }
    );

    await testCase(
      'Task title boundary: 201 characters rejected (expects 400 VALIDATION_ERROR)',
      'STRING_BOUNDARY',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectA._id}/tasks`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'T'.repeat(201),
          }),
        });
        assert.equal(res.status, 400);
      }
    );

    await testCase(
      'Enum strictness: unsupported task priority rejected (expects 400 VALIDATION_ERROR)',
      'ENUM_VALIDATION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectA._id}/tasks`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Valid Title',
            priority: 'ULTRA_CRITICAL',
          }),
        });
        assert.equal(res.status, 400);
      }
    );

    await testCase(
      'Strict schema rejecting unexpected/injected fields on task update (expects 400 VALIDATION_ERROR)',
      'STRICT_SCHEMA',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskA1._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Allowed Update',
            injectedField: 'malicious payload',
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 400);
        assert.equal(body.error?.code, 'VALIDATION_ERROR');
      }
    );

    // --------------------------------------------------------------------------
    // Suite 4: Date, Numeric & Bounds Constraints
    // --------------------------------------------------------------------------
    console.log('\n--- Suite 4: Date, Numeric & Boundary Constraints ---');

    await testCase(
      'Task creation rejecting invalid date string in dueDate (expects 400 VALIDATION_ERROR)',
      'DATE_VALIDATION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectA._id}/tasks`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Invalid Date Task',
            dueDate: 'not-an-iso-date',
          }),
        });
        assert.equal(res.status, 400);
      }
    );

    await testCase(
      'Chat message pagination rejecting invalid before date string (expects 400 VALIDATION_ERROR)',
      'DATE_VALIDATION',
      async () => {
        const res = await fetch(
          `${BASE_URL}/api/v1/conversations/${convA._id}/messages?before=not-a-date`,
          {
            headers: { Authorization: `Bearer ${empAToken}` },
          }
        );
        assert.equal(res.status, 400);
      }
    );

    await testCase(
      'Task status transition rejecting negative version number (expects 400 VALIDATION_ERROR)',
      'NUMERIC_BOUNDS',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskA1._id}/status`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'IN_PROGRESS',
            version: -1,
          }),
        });
        assert.equal(res.status, 400);
      }
    );

    await testCase(
      'Task status transition rejecting non-finite targetPosition (expects 400 VALIDATION_ERROR)',
      'NUMERIC_BOUNDS',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskA1._id}/status`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'IN_PROGRESS',
            version: 0,
            targetPosition: Infinity,
          }),
        });
        assert.equal(res.status, 400);
      }
    );

    await testCase(
      'Invitation generation rejecting maxUses: 0 (expects 400 VALIDATION_ERROR)',
      'NUMERIC_BOUNDS',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/invitations`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId: projectA._id.toString(),
            maxUses: 0,
          }),
        });
        assert.equal(res.status, 400);
      }
    );

    await testCase(
      'Invitation generation rejecting maxUses exceeding 1000 (expects 400 VALIDATION_ERROR)',
      'NUMERIC_BOUNDS',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/invitations`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId: projectA._id.toString(),
            maxUses: 1001,
          }),
        });
        assert.equal(res.status, 400);
      }
    );

    await testCase(
      'Invitation generation rejecting non-integer maxUses: 2.5 (expects 400 VALIDATION_ERROR)',
      'NUMERIC_BOUNDS',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/invitations`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId: projectA._id.toString(),
            maxUses: 2.5,
          }),
        });
        assert.equal(res.status, 400);
      }
    );

    await testCase(
      'Notification query rejecting limit: 0 (expects 400 VALIDATION_ERROR)',
      'PAGINATION_BOUNDS',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/notifications?limit=0`, {
          headers: { Authorization: `Bearer ${empAToken}` },
        });
        assert.equal(res.status, 400);
      }
    );

    await testCase(
      'Notification query rejecting limit: 101 exceeding max 100 (expects 400 VALIDATION_ERROR)',
      'PAGINATION_BOUNDS',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/notifications?limit=101`, {
          headers: { Authorization: `Bearer ${empAToken}` },
        });
        assert.equal(res.status, 400);
      }
    );

    await testCase(
      'Notification query rejecting page: 0 (expects 400 VALIDATION_ERROR)',
      'PAGINATION_BOUNDS',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/notifications?page=0`, {
          headers: { Authorization: `Bearer ${empAToken}` },
        });
        assert.equal(res.status, 400);
      }
    );

    await testCase(
      'Notification query rejecting page exceeding 10000 (expects 400 VALIDATION_ERROR)',
      'PAGINATION_BOUNDS',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/notifications?page=10001`, {
          headers: { Authorization: `Bearer ${empAToken}` },
        });
        assert.equal(res.status, 400);
      }
    );

    // --------------------------------------------------------------------------
    // Suite 5: JSON & Request-Body Protection
    // --------------------------------------------------------------------------
    console.log('\n--- Suite 5: JSON & Request-Body Protection ---');

    await testCase(
      'Malformed JSON syntax returning controlled 400 MALFORMED_JSON (expects 400, no stack trace)',
      'MALFORMED_JSON_PROTECTION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"email": "broken-json@val-test.com", "password": ', // broken syntax
        });
        const body = await res.json();
        assert.equal(res.status, 400);
        assert.equal(body.error?.code, 'MALFORMED_JSON');
        assert.equal(body.error?.details, undefined, 'Must not expose parser internals or stack');
      }
    );

    await testCase(
      'Oversized request body rejected with 413 PAYLOAD_TOO_LARGE (expects 413, no stack trace)',
      'REQUEST_BODY_SIZE_LIMIT',
      async () => {
        // Generate payload slightly over 1MB
        const largeString = 'X'.repeat(1024 * 1024 + 100);
        const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'admin@val-test.com',
            password: 'ValTest123!',
            padding: largeString,
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 413);
        assert.equal(body.error?.code, 'PAYLOAD_TOO_LARGE');
        assert.equal(body.error?.details, undefined, 'Must not leak stack trace');
      }
    );

    // --------------------------------------------------------------------------
    // Suite 6: Database Data Integrity & Relational Invariants
    // --------------------------------------------------------------------------
    console.log('\n--- Suite 6: Database Data Integrity & Relational Invariants ---');

    await testCase(
      'Cross-project assignee rejected (member of Project B cannot be assigned in Project A) (expects 400 INVALID_ASSIGNEE)',
      'RELATIONAL_INTEGRITY',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectA._id}/tasks`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Cross-Project Assignment Attempt',
            assigneeId: empUserB._id.toString(), // member of Project B only
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 400);
        assert.equal(body.error?.code, 'INVALID_ASSIGNEE');
      }
    );

    await testCase(
      'Nonexistent user assignee rejected (expects 400 INVALID_ASSIGNEE)',
      'RELATIONAL_INTEGRITY',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectA._id}/tasks`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Ghost Assignee Attempt',
            assigneeId: '507f1f77bcf86cd799439011', // valid ObjectId, nonexistent user
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 400);
        assert.equal(body.error?.code, 'INVALID_ASSIGNEE');
      }
    );

    await testCase(
      'Inactive user assignee rejected (expects 400 INVALID_ASSIGNEE)',
      'RELATIONAL_INTEGRITY',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectA._id}/tasks`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Inactive User Assignee Attempt',
            assigneeId: inactiveUser._id.toString(),
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 400);
        assert.equal(body.error?.code, 'INVALID_ASSIGNEE');
      }
    );

    await testCase(
      'Database unique compound index prevents duplicate ProjectMembership (expects Mongo code 11000)',
      'DATABASE_UNIQUE_CONSTRAINT',
      async () => {
        // Attempt direct insertion of duplicate membership
        let caughtError: any = null;
        try {
          await ProjectMembership.create({
            projectId: projectA._id,
            userId: empUserA._id,
            role: 'MEMBER',
            status: 'ACTIVE',
          });
        } catch (err: any) {
          caughtError = err;
        }
        assert.ok(caughtError, 'Database must reject duplicate membership');
        assert.equal(caughtError.code, 11000, 'Expected MongoDB duplicate key error code 11000');
      }
    );
  } finally {
    // --------------------------------------------------------------------------
    // TEARDOWN & CLEANUP
    // --------------------------------------------------------------------------
    console.log('\n--- Teardown: Performing Scoped Test Cleanup ---');
    try {
      await cleanupValidationTestData();
      console.log('✔ Scoped test data cleaned up.');
    } catch (cleanupErr: any) {
      console.error('Teardown cleanup error:', cleanupErr.message);
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.log('✔ Test HTTP server closed.');

    await disconnectDatabase();
    console.log('✔ Disconnected from test database.\n');
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('================================================================');
  console.log(`Phase 9.4 Validation Testing Complete`);
  console.log(`Total Tests Run:    ${testsRun}`);
  console.log(`Total Tests Passed: ${testsPassed}`);
  console.log(`Total Tests Failed: ${testsFailed}`);
  console.log('================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runValidationSecurityTests().catch((err) => {
  console.error('Fatal unhandled error during input validation security verification:', err);
  process.exit(1);
});
