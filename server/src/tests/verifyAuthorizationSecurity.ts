process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { io as ioClient } from 'socket.io-client';
import app from '../app';
import {
  connectTestDatabase,
  disconnectDatabase,
  assertTestDatabaseConnection,
} from '../config/database';
import { initSocketServer, getIO } from '../sockets';
import { signToken } from '../utils/jwt';
import { hashToken } from '../utils/crypto';
import bcrypt from 'bcryptjs';

import { User } from '../models/User';
import { Project } from '../models/Project';
import { ProjectMembership } from '../models/ProjectMembership';
import { Task } from '../models/Task';
import { TaskComment } from '../models/TaskComment';
import { ProjectInvitation } from '../models/ProjectInvitation';
import { JoinRequest } from '../models/JoinRequest';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { Notification } from '../models/Notification';
import { ActivityLog } from '../models/ActivityLog';

const TEST_PORT = 5089;
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

async function cleanupAuthzTestData() {
  assertTestDatabaseConnection();

  const testUsers = await User.find({ email: { $regex: /@authz-test\.com$/i } });
  const testUserIds = testUsers.map((u) => u._id);

  const testProjects = await Project.find({
    name: { $regex: /^Authz Test/ },
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
    await ProjectInvitation.deleteMany({
      $or: [{ projectId: { $in: testProjectIds } }, { invitedBy: { $in: testUserIds } }],
    });
    await JoinRequest.deleteMany({
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

async function runAuthorizationSecurityTests() {
  console.log('================================================================');
  console.log('WorkSpace Phase 9.3 — Authentication & Authorization Verification');
  console.log('================================================================\n');

  // 1. Establish isolated test database connection with Phase 9.1 safety guard
  await connectTestDatabase();
  assertTestDatabaseConnection();

  // 2. Initial scoped cleanup
  await cleanupAuthzTestData();

  // 3. Start test HTTP server + Socket.IO
  const server = http.createServer(app);
  const io = initSocketServer(server);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  console.log(`Test HTTP server listening on ${BASE_URL}\n`);

  try {
    assertTestDatabaseConnection();

    // --------------------------------------------------------------------------
    // SEED TEST USERS & RESOURCES
    // --------------------------------------------------------------------------
    console.log('--- Seeding Isolated Test Users & Resources ---');
    const passwordHash = await bcrypt.hash('TestPass123!', 4);

    const adminUser = await User.create({
      email: 'admin@authz-test.com',
      passwordHash,
      fullName: 'Authz Admin User',
      globalRole: 'ADMIN',
      isActive: true,
    });

    const pmAUser = await User.create({
      email: 'pma@authz-test.com',
      passwordHash,
      fullName: 'Authz Project Manager A',
      globalRole: 'USER',
      isActive: true,
    });

    const pmBUser = await User.create({
      email: 'pmb@authz-test.com',
      passwordHash,
      fullName: 'Authz Project Manager B',
      globalRole: 'USER',
      isActive: true,
    });

    const empAUser = await User.create({
      email: 'empa@authz-test.com',
      passwordHash,
      fullName: 'Authz Employee A',
      globalRole: 'USER',
      isActive: true,
    });

    const empA2User = await User.create({
      email: 'empa2@authz-test.com',
      passwordHash,
      fullName: 'Authz Employee A2',
      globalRole: 'USER',
      isActive: true,
    });

    const empBUser = await User.create({
      email: 'empb@authz-test.com',
      passwordHash,
      fullName: 'Authz Employee B',
      globalRole: 'USER',
      isActive: true,
    });

    const outsiderUser = await User.create({
      email: 'outsider@authz-test.com',
      passwordHash,
      fullName: 'Authz Outsider User',
      globalRole: 'USER',
      isActive: true,
    });

    const adminToken = signToken({
      userId: adminUser._id.toString(),
      email: adminUser.email,
      globalRole: adminUser.globalRole,
    });
    const pmAToken = signToken({
      userId: pmAUser._id.toString(),
      email: pmAUser.email,
      globalRole: pmAUser.globalRole,
    });
    const pmBToken = signToken({
      userId: pmBUser._id.toString(),
      email: pmBUser.email,
      globalRole: pmBUser.globalRole,
    });
    const empAToken = signToken({
      userId: empAUser._id.toString(),
      email: empAUser.email,
      globalRole: empAUser.globalRole,
    });
    const empA2Token = signToken({
      userId: empA2User._id.toString(),
      email: empA2User.email,
      globalRole: empA2User.globalRole,
    });
    const empBToken = signToken({
      userId: empBUser._id.toString(),
      email: empBUser.email,
      globalRole: empBUser.globalRole,
    });
    const outsiderToken = signToken({
      userId: outsiderUser._id.toString(),
      email: outsiderUser.email,
      globalRole: outsiderUser.globalRole,
    });

    // Seed Projects
    // Project A: Private, managed by PM A, members: PM A, Employee A, Employee A2
    const projectA = await Project.create({
      name: 'Authz Test Project A (Private)',
      key: 'AUTHA',
      description: 'Private project for authz testing',
      visibility: 'PRIVATE',
      primaryManagerId: pmAUser._id,
      createdBy: adminUser._id,
      status: 'ACTIVE',
    });
    await ProjectMembership.create({
      projectId: projectA._id,
      userId: pmAUser._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });
    await ProjectMembership.create({
      projectId: projectA._id,
      userId: empAUser._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });
    await ProjectMembership.create({
      projectId: projectA._id,
      userId: empA2User._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });

    // Project B: Private, managed by PM B, members: PM B, Employee B
    const projectB = await Project.create({
      name: 'Authz Test Project B (Private)',
      key: 'AUTHB',
      description: 'Private project B for cross-boundary testing',
      visibility: 'PRIVATE',
      primaryManagerId: pmBUser._id,
      createdBy: adminUser._id,
      status: 'ACTIVE',
    });
    await ProjectMembership.create({
      projectId: projectB._id,
      userId: pmBUser._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });
    await ProjectMembership.create({
      projectId: projectB._id,
      userId: empBUser._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });

    // Project C: Public, managed by PM A, member: PM A
    const projectC = await Project.create({
      name: 'Authz Test Project C (Public)',
      key: 'AUTHC',
      description: 'Public project for visibility testing',
      visibility: 'PUBLIC',
      primaryManagerId: pmAUser._id,
      createdBy: adminUser._id,
      status: 'ACTIVE',
    });
    await ProjectMembership.create({
      projectId: projectC._id,
      userId: pmAUser._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });

    // Seed Tasks
    const taskA1 = await Task.create({
      projectId: projectA._id,
      title: 'Authz Task A1 (Assigned to Emp A)',
      status: 'TODO',
      priority: 'HIGH',
      assigneeId: empAUser._id,
      creatorId: pmAUser._id,
      position: 1000,
      version: 0,
    });

    const taskB1 = await Task.create({
      projectId: projectB._id,
      title: 'Authz Task B1 (Assigned to Emp B)',
      status: 'TODO',
      priority: 'MEDIUM',
      assigneeId: empBUser._id,
      creatorId: pmBUser._id,
      position: 1000,
      version: 0,
    });

    // Seed Task Comment on Task A1
    const commentA1 = await TaskComment.create({
      taskId: taskA1._id,
      projectId: projectA._id,
      authorId: empAUser._id,
      content: 'Initial comment on Task A1',
    });

    // Seed Conversations
    const convProjectA = await Conversation.create({
      type: 'PROJECT_GROUP',
      projectId: projectA._id,
      participants: [pmAUser._id, empAUser._id, empA2User._id],
      lastMessageAt: new Date(),
    });

    const convProjectB = await Conversation.create({
      type: 'PROJECT_GROUP',
      projectId: projectB._id,
      participants: [pmBUser._id, empBUser._id],
      lastMessageAt: new Date(),
    });

    const convAdminPm = await Conversation.create({
      type: 'ADMIN_PM_DM',
      projectId: null,
      participants: [adminUser._id, pmAUser._id],
      lastMessageAt: new Date(),
    });

    // Seed Notification for Employee B
    const notifB = await Notification.create({
      recipientId: empBUser._id,
      type: 'TASK_ASSIGNED',
      title: 'Task Assigned',
      body: 'You have been assigned to Task B1',
      link: `/projects/${projectB._id}/tasks`,
      isRead: false,
    });

    // Seed Pending Join Request for Project C by Outsider
    const joinReqC = await JoinRequest.create({
      projectId: projectC._id,
      userId: outsiderUser._id,
      status: 'PENDING',
    });

    // Seed Invitations for Project A
    const rawRestrictedToken = 'test-token-restricted-special-email-12345';
    const invRestricted = await ProjectInvitation.create({
      projectId: projectA._id,
      tokenHash: hashToken(rawRestrictedToken),
      invitedEmail: 'special@authz-test.com',
      invitedBy: pmAUser._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxUses: 1,
      usedCount: 0,
      status: 'PENDING',
    });

    const rawExpiredToken = 'test-token-expired-immediately-12345';
    const invExpired = await ProjectInvitation.create({
      projectId: projectA._id,
      tokenHash: hashToken(rawExpiredToken),
      invitedBy: pmAUser._id,
      expiresAt: new Date(Date.now() - 60 * 1000), // in the past
      maxUses: 1,
      usedCount: 0,
      status: 'EXPIRED',
    });

    const rawRevokedToken = 'test-token-revoked-immediately-12345';
    const invRevoked = await ProjectInvitation.create({
      projectId: projectA._id,
      tokenHash: hashToken(rawRevokedToken),
      invitedBy: pmAUser._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxUses: 1,
      usedCount: 0,
      status: 'REVOKED',
    });

    console.log('✔ Test fixtures seeded successfully.\n');

    // --------------------------------------------------------------------------
    // Category A: Project Access BOLA / IDOR Testing
    // --------------------------------------------------------------------------
    console.log('--- Category A: Project Access BOLA/IDOR Testing ---');

    await testCase(
      'Unauthorized outsider accessing private Project A by ID (expects 404 PROJECT_NOT_FOUND)',
      'PROJECT_BOLA',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectA._id}`, {
          headers: { Authorization: `Bearer ${outsiderToken}` },
        });
        const body = await res.json();
        assert.equal(res.status, 404);
        assert.equal(body.error?.code, 'PROJECT_NOT_FOUND');
      }
    );

    await testCase(
      'Member of Project B (Employee B) accessing private Project A by ID (expects 404 PROJECT_NOT_FOUND)',
      'PROJECT_BOLA',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectA._id}`, {
          headers: { Authorization: `Bearer ${empBToken}` },
        });
        const body = await res.json();
        assert.equal(res.status, 404);
        assert.equal(body.error?.code, 'PROJECT_NOT_FOUND');
      }
    );

    await testCase(
      'Employee A attempting to update settings of Project A (expects 403 FORBIDDEN - Admin only)',
      'PROJECT_RBAC',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectA._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${empAToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Tampered Name' }),
        });
        assert.equal(res.status, 403);
      }
    );

    await testCase(
      'PM A attempting to update general settings of Project A (expects 403 FORBIDDEN - Admin only)',
      'PROJECT_RBAC',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectA._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${pmAToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'PM Tampered Name' }),
        });
        assert.equal(res.status, 403);
      }
    );

    await testCase(
      'PM B attempting to manage Project A visibility (expects 403 FORBIDDEN - Admin only)',
      'PROJECT_BOLA',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectA._id}/visibility`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${pmBToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ visibility: 'PUBLIC' }),
        });
        assert.equal(res.status, 403);
      }
    );

    await testCase(
      'Non-member attempting to list tasks of private Project A (expects 404 PROJECT_NOT_FOUND)',
      'PROJECT_BOLA',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectA._id}/tasks`, {
          headers: { Authorization: `Bearer ${outsiderToken}` },
        });
        const body = await res.json();
        assert.equal(res.status, 404);
        assert.equal(body.error?.code, 'PROJECT_NOT_FOUND');
      }
    );

    await testCase(
      'Non-member attempting to list members of private Project A (expects 404 PROJECT_NOT_FOUND)',
      'PROJECT_BOLA',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectA._id}/members`, {
          headers: { Authorization: `Bearer ${outsiderToken}` },
        });
        const body = await res.json();
        assert.equal(res.status, 404);
        assert.equal(body.error?.code, 'PROJECT_NOT_FOUND');
      }
    );

    await testCase(
      'Non-member viewing public Project C by ID receives limited public metadata (expects 200 with public metadata only)',
      'PROJECT_PUBLIC_ACCESS',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectC._id}`, {
          headers: { Authorization: `Bearer ${outsiderToken}` },
        });
        const body = await res.json();
        assert.equal(res.status, 200);
        assert.equal(body.data?.project?.visibility, 'PUBLIC');
        assert.equal(body.data?.project?.name, 'Authz Test Project C (Public)');
        assert.equal(body.data?.project?.status, undefined, 'Sensitive project status omitted from public metadata');
      }
    );

    await testCase(
      'Non-member attempting to view tasks of public Project C without membership (expects 403 FORBIDDEN)',
      'PROJECT_PUBLIC_ACCESS',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectC._id}/tasks`, {
          headers: { Authorization: `Bearer ${outsiderToken}` },
        });
        const body = await res.json();
        assert.equal(res.status, 403);
        assert.equal(body.error?.code, 'FORBIDDEN');
      }
    );

    await testCase(
      'Non-member attempting to view members of public Project C without membership (expects 403 FORBIDDEN)',
      'PROJECT_PUBLIC_ACCESS',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectC._id}/members`, {
          headers: { Authorization: `Bearer ${outsiderToken}` },
        });
        const body = await res.json();
        assert.equal(res.status, 403);
        assert.equal(body.error?.code, 'FORBIDDEN');
      }
    );

    // --------------------------------------------------------------------------
    // Category B: Task Access & Concurrency BOLA / IDOR Testing
    // --------------------------------------------------------------------------
    console.log('\n--- Category B: Task Access & Concurrency BOLA/IDOR Testing ---');

    await testCase(
      'Employee B accessing Task A1 directly by ID across project boundary (expects 404 TASK_NOT_FOUND)',
      'TASK_BOLA',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskA1._id}`, {
          headers: { Authorization: `Bearer ${empBToken}` },
        });
        const body = await res.json();
        assert.equal(res.status, 404);
        assert.equal(body.error?.code, 'TASK_NOT_FOUND');
      }
    );

    await testCase(
      'Non-member accessing Task A1 directly by ID (expects 404 TASK_NOT_FOUND)',
      'TASK_BOLA',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskA1._id}`, {
          headers: { Authorization: `Bearer ${outsiderToken}` },
        });
        const body = await res.json();
        assert.equal(res.status, 404);
        assert.equal(body.error?.code, 'TASK_NOT_FOUND');
      }
    );

    await testCase(
      'Employee A attempting to delete Task A1 (expects 403 FORBIDDEN - PM or Admin required)',
      'TASK_RBAC',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskA1._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${empAToken}` },
        });
        assert.equal(res.status, 403);
      }
    );

    await testCase(
      'PM B attempting to modify Task A1 across project boundaries (expects 404 or 403)',
      'TASK_BOLA',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskA1._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${pmBToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title: 'PM B Hijack Task' }),
        });
        assert.ok([403, 404].includes(res.status));
      }
    );

    await testCase(
      'Employee A attempting to edit general Task A1 details (expects 403 FORBIDDEN - PM or Admin only)',
      'TASK_RBAC',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskA1._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${empAToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title: 'Employee Changed Title' }),
        });
        assert.equal(res.status, 403);
      }
    );

    await testCase(
      'Non-assignee Employee A2 attempting to move Task A1 status (expects 403 FORBIDDEN)',
      'TASK_CONCURRENCY_AUTH',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskA1._id}/status`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${empA2Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'IN_PROGRESS', version: taskA1.version }),
        });
        assert.equal(res.status, 403);
      }
    );

    await testCase(
      'Assigned Employee A moving Task A1 status (expects 200 OK)',
      'TASK_CONCURRENCY_AUTH',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskA1._id}/status`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${empAToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'IN_PROGRESS', version: taskA1.version }),
        });
        const body = await res.json();
        assert.equal(res.status, 200);
        assert.equal(body.data?.status, 'IN_PROGRESS');
      }
    );

    await testCase(
      'Primary PM A moving Task A1 status (expects 200 OK)',
      'TASK_CONCURRENCY_AUTH',
      async () => {
        // Refetch latest version from database
        const latestTask = await Task.findById(taskA1._id);
        const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskA1._id}/status`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${pmAToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'DONE', version: latestTask!.version }),
        });
        const body = await res.json();
        assert.equal(res.status, 200);
        assert.equal(body.data?.status, 'DONE');
      }
    );

    await testCase(
      'Employee B attempting to read comments on Task A1 across project boundary (expects 404 TASK_NOT_FOUND)',
      'COMMENT_BOLA',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskA1._id}/comments`, {
          headers: { Authorization: `Bearer ${empBToken}` },
        });
        const body = await res.json();
        assert.equal(res.status, 404);
        assert.equal(body.error?.code, 'TASK_NOT_FOUND');
      }
    );

    await testCase(
      'Employee B attempting to post a comment on Task A1 across project boundary (expects 404 TASK_NOT_FOUND)',
      'COMMENT_BOLA',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskA1._id}/comments`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${empBToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: 'Illegal Cross-Project Comment' }),
        });
        const body = await res.json();
        assert.equal(res.status, 404);
        assert.equal(body.error?.code, 'TASK_NOT_FOUND');
      }
    );

    // --------------------------------------------------------------------------
    // Category C: Membership & Invitations BOLA / IDOR Testing
    // --------------------------------------------------------------------------
    console.log('\n--- Category C: Membership & Invitations BOLA/IDOR Testing ---');

    await testCase(
      'Employee A attempting to invite new members to Project A (expects 403 FORBIDDEN - PM or Admin only)',
      'MEMBERSHIP_RBAC',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/invitations`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${empAToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ projectId: projectA._id.toString() }),
        });
        assert.equal(res.status, 403);
      }
    );

    await testCase(
      'PM B attempting to generate invitation for Project A (expects 403 FORBIDDEN)',
      'INVITATION_BOLA',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/invitations`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pmBToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ projectId: projectA._id.toString() }),
        });
        assert.equal(res.status, 403);
      }
    );

    await testCase(
      'Employee A attempting to remove Employee A2 from Project A (expects 403 FORBIDDEN)',
      'MEMBERSHIP_RBAC',
      async () => {
        const res = await fetch(
          `${BASE_URL}/api/v1/projects/${projectA._id}/members/${empA2User._id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${empAToken}` },
          }
        );
        assert.equal(res.status, 403);
      }
    );

    await testCase(
      'PM B attempting to remove Employee A from Project A (expects 403 FORBIDDEN)',
      'MEMBERSHIP_BOLA',
      async () => {
        const res = await fetch(
          `${BASE_URL}/api/v1/projects/${projectA._id}/members/${empAUser._id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${pmBToken}` },
          }
        );
        assert.equal(res.status, 403);
      }
    );

    await testCase(
      'Non-member attempting to list join requests for Project C (expects 403 FORBIDDEN)',
      'JOIN_REQUEST_RBAC',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectC._id}/join-requests`, {
          headers: { Authorization: `Bearer ${outsiderToken}` },
        });
        assert.equal(res.status, 403);
      }
    );

    await testCase(
      'Employee A attempting to approve join request for Project C (expects 403 FORBIDDEN)',
      'JOIN_REQUEST_BOLA',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/join-requests/${joinReqC._id}/approve`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${empAToken}` },
        });
        assert.equal(res.status, 403);
      }
    );

    await testCase(
      'Employee A attempting to accept invitation restricted to special@authz-test.com (expects 403 FORBIDDEN_EMAIL_MISMATCH)',
      'INVITATION_EMAIL_LOCKDOWN',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/invitations/accept`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${empAToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: rawRestrictedToken }),
        });
        const body = await res.json();
        assert.equal(res.status, 403);
        assert.equal(body.error?.code, 'FORBIDDEN_EMAIL_MISMATCH');
      }
    );

    await testCase(
      'Accepting expired invitation token (expects 410 INVITATION_EXPIRED)',
      'INVITATION_LIFECYCLE',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/invitations/accept`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${outsiderToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: rawExpiredToken }),
        });
        const body = await res.json();
        assert.equal(res.status, 410);
        assert.equal(body.error?.code, 'INVITATION_EXPIRED');
      }
    );

    await testCase(
      'Accepting revoked invitation token (expects 410 INVITATION_REVOKED)',
      'INVITATION_LIFECYCLE',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/invitations/accept`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${outsiderToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: rawRevokedToken }),
        });
        const body = await res.json();
        assert.equal(res.status, 410);
        assert.equal(body.error?.code, 'INVITATION_REVOKED');
      }
    );

    await testCase(
      'Attempting to delete primary project manager via membership remove endpoint (expects 400 CANNOT_REMOVE_PRIMARY_MANAGER)',
      'MEMBERSHIP_INVARIANT',
      async () => {
        const res = await fetch(
          `${BASE_URL}/api/v1/projects/${projectA._id}/members/${pmAUser._id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${adminToken}` },
          }
        );
        const body = await res.json();
        assert.equal(res.status, 400);
        assert.equal(body.error?.code, 'CANNOT_REMOVE_PRIMARY_MANAGER');
      }
    );

    // --------------------------------------------------------------------------
    // Category D: Chat & Conversations BOLA / IDOR Testing
    // --------------------------------------------------------------------------
    console.log('\n--- Category D: Chat & Conversations BOLA/IDOR Testing ---');

    await testCase(
      'Employee B attempting to fetch Project A conversation by projectId (expects 404 PROJECT_NOT_FOUND)',
      'CHAT_BOLA',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/conversations/project/${projectA._id}`, {
          headers: { Authorization: `Bearer ${empBToken}` },
        });
        const body = await res.json();
        assert.equal(res.status, 404);
        assert.equal(body.error?.code, 'PROJECT_NOT_FOUND');
      }
    );

    await testCase(
      'Employee B attempting to fetch messages from Project A conversation by direct ID (expects 404 NOT_FOUND)',
      'CHAT_IDOR',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/conversations/${convProjectA._id}/messages`, {
          headers: { Authorization: `Bearer ${empBToken}` },
        });
        const body = await res.json();
        assert.equal(res.status, 404);
        assert.equal(body.error?.code, 'NOT_FOUND');
      }
    );

    await testCase(
      'Employee B attempting to post a message into Project A conversation by direct ID (expects 404 NOT_FOUND)',
      'CHAT_IDOR',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/conversations/${convProjectA._id}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${empBToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: 'Injected BOLA Message' }),
        });
        const body = await res.json();
        assert.equal(res.status, 404);
        assert.equal(body.error?.code, 'NOT_FOUND');
      }
    );

    await testCase(
      'Employee A attempting to access private Admin-PM DM messages by direct ID (expects 403 FORBIDDEN)',
      'CHAT_PRIVACY_IDOR',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/conversations/${convAdminPm._id}/messages`, {
          headers: { Authorization: `Bearer ${empAToken}` },
        });
        const body = await res.json();
        assert.equal(res.status, 403);
        assert.equal(body.error?.code, 'FORBIDDEN');
      }
    );

    await testCase(
      'Employee A attempting to send message into private Admin-PM DM (expects 403 FORBIDDEN)',
      'CHAT_PRIVACY_IDOR',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/conversations/${convAdminPm._id}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${empAToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: 'Snooped Message' }),
        });
        const body = await res.json();
        assert.equal(res.status, 403);
        assert.equal(body.error?.code, 'FORBIDDEN');
      }
    );

    await testCase(
      'Non-PM Employee A attempting to initialize Admin-PM DM (expects 403 FORBIDDEN)',
      'CHAT_RBAC',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/conversations/admin-pm/${adminUser._id}`, {
          headers: { Authorization: `Bearer ${empAToken}` },
        });
        assert.equal(res.status, 403);
      }
    );

    // --------------------------------------------------------------------------
    // Category E: Notifications & Activity Isolation Testing
    // --------------------------------------------------------------------------
    console.log('\n--- Category E: Notifications & Activity Isolation Testing ---');

    await testCase(
      'Employee A attempting to mark Employee B notification as read (expects 403 FORBIDDEN)',
      'NOTIFICATION_IDOR',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/notifications/${notifB._id}/read`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${empAToken}` },
        });
        const body = await res.json();
        assert.equal(res.status, 403);
        assert.equal(body.error?.code, 'FORBIDDEN');
      }
    );

    await testCase(
      'Employee A querying notifications returns strictly their own scoped feed',
      'NOTIFICATION_ISOLATION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/notifications`, {
          headers: { Authorization: `Bearer ${empAToken}` },
        });
        const body = await res.json();
        assert.equal(res.status, 200);
        const hasNotifB = (body.data?.notifications || []).some(
          (n: any) => n._id === notifB._id.toString()
        );
        assert.equal(hasNotifB, false, "Employee A's notification feed must never contain Employee B's notification");
        for (const n of body.data?.notifications || []) {
          assert.equal(n.recipientId, empAUser._id.toString(), 'All notifications must strictly belong to Employee A');
        }
      }
    );

    await testCase(
      'Employee B attempting to access activity feed of Project A (expects 404 PROJECT_NOT_FOUND)',
      'ACTIVITY_BOLA',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectA._id}/activity`, {
          headers: { Authorization: `Bearer ${empBToken}` },
        });
        const body = await res.json();
        assert.equal(res.status, 404);
        assert.equal(body.error?.code, 'PROJECT_NOT_FOUND');
      }
    );

    await testCase(
      'Non-member attempting to access activity feed of public Project C (expects 403 FORBIDDEN)',
      'ACTIVITY_PUBLIC_RESTRICTION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectC._id}/activity`, {
          headers: { Authorization: `Bearer ${outsiderToken}` },
        });
        const body = await res.json();
        assert.equal(res.status, 403);
        assert.equal(body.error?.code, 'FORBIDDEN');
      }
    );

    // --------------------------------------------------------------------------
    // Category F: Role Escalation & Token Tampering Testing
    // --------------------------------------------------------------------------
    console.log('\n--- Category F: Role Escalation & Token Tampering Testing ---');

    await testCase(
      'Public registration payload attempting ADMIN self-promotion (expects USER role persisted)',
      'ROLE_ESCALATION_REGISTRATION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'hacker-admin@authz-test.com',
            password: 'HackerPassword123!',
            fullName: 'Escalation Attacker',
            globalRole: 'ADMIN',
            role: 'ADMIN',
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 201);
        assert.equal(body.data?.user?.globalRole, 'USER', 'Registration must hardcode USER role');

        const savedUser = await User.findOne({ email: 'hacker-admin@authz-test.com' });
        assert.equal(savedUser?.globalRole, 'USER', 'Database record must be USER');
      }
    );

    await testCase(
      'Non-Admin Employee attempting to access eligible managers list (expects 403 FORBIDDEN)',
      'ADMIN_ROUTE_PROTECTION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/users/eligible-managers`, {
          headers: { Authorization: `Bearer ${empAToken}` },
        });
        assert.equal(res.status, 403);
      }
    );

    await testCase(
      'Non-Admin Employee attempting to create a project (expects 403 FORBIDDEN)',
      'ADMIN_ROUTE_PROTECTION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${empAToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Unauthorized Project',
            primaryManagerId: empAToken,
          }),
        });
        assert.equal(res.status, 403);
      }
    );

    await testCase(
      'Non-Admin attempting to replace primary manager of Project A (expects 403 FORBIDDEN)',
      'ADMIN_ROUTE_PROTECTION',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${projectA._id}/primary-manager`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${pmAToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            newManagerId: empAToken,
          }),
        });
        assert.equal(res.status, 403);
      }
    );

    await testCase(
      'Token tampering: modified payload claims with original signature (expects 401 UNAUTHORIZED)',
      'TOKEN_INTEGRITY',
      async () => {
        const parts = empAToken.split('.');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        payload.globalRole = 'ADMIN';
        const tamperedB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const tamperedToken = `${parts[0]}.${tamperedB64}.${parts[2]}`;

        const res = await fetch(`${BASE_URL}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${tamperedToken}` },
        });
        assert.equal(res.status, 401);
      }
    );

    await testCase(
      'Token tampering: token signed with rogue secret key (expects 401 UNAUTHORIZED)',
      'TOKEN_INTEGRITY',
      async () => {
        const rogueToken = jwt.sign(
          { userId: adminUser._id.toString(), email: adminUser.email, globalRole: 'ADMIN' },
          'completely-rogue-secret-key-00000000000000000',
          { algorithm: 'HS256' }
        );

        const res = await fetch(`${BASE_URL}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${rogueToken}` },
        });
        assert.equal(res.status, 401);
      }
    );

    await testCase(
      'Unauthenticated request to protected endpoint (expects 401 UNAUTHORIZED)',
      'AUTHENTICATION_ENFORCEMENT',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/auth/me`);
        assert.equal(res.status, 401);
      }
    );

    // --------------------------------------------------------------------------
    // Category G: Socket.IO Real-Time Authorization Testing
    // --------------------------------------------------------------------------
    console.log('\n--- Category G: Socket.IO Real-Time Authorization Testing ---');

    await testCase(
      'Employee B attempting to join Project A socket room (expects FORBIDDEN error)',
      'SOCKET_PROJECT_AUTH',
      async () => {
        const socket = ioClient(BASE_URL, {
          auth: { token: empBToken },
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            socket.disconnect();
            reject(new Error('Socket join:project timeout'));
          }, 3000);

          socket.on('connect', () => {
            socket.emit('join:project', { projectId: projectA._id.toString() }, (res: any) => {
              clearTimeout(timeout);
              socket.disconnect();
              if (res && res.success === false) {
                resolve();
              } else {
                reject(new Error(`Expected callback error, received: ${JSON.stringify(res)}`));
              }
            });
          });

          socket.on('error', (err: any) => {
            if (err?.code === 'FORBIDDEN') {
              clearTimeout(timeout);
              socket.disconnect();
              resolve();
            }
          });
        });
      }
    );

    await testCase(
      'Employee B attempting to join Project A conversation room (expects FORBIDDEN error)',
      'SOCKET_CONV_AUTH',
      async () => {
        const socket = ioClient(BASE_URL, {
          auth: { token: empBToken },
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            socket.disconnect();
            reject(new Error('Socket join:conversation timeout'));
          }, 3000);

          socket.on('connect', () => {
            socket.emit(
              'join:conversation',
              { conversationId: convProjectA._id.toString() },
              (res: any) => {
                clearTimeout(timeout);
                socket.disconnect();
                if (res && res.success === false) {
                  resolve();
                } else {
                  reject(new Error(`Expected callback error, received: ${JSON.stringify(res)}`));
                }
              }
            );
          });

          socket.on('error', (err: any) => {
            if (err?.code === 'FORBIDDEN') {
              clearTimeout(timeout);
              socket.disconnect();
              resolve();
            }
          });
        });
      }
    );

    await testCase(
      'Employee A attempting to join Admin-PM DM conversation room (expects FORBIDDEN error)',
      'SOCKET_DM_AUTH',
      async () => {
        // Employee A is not in convAdminPm
        const socket = ioClient(BASE_URL, {
          auth: { token: empAToken },
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            socket.disconnect();
            reject(new Error('Socket join:conversation DM timeout'));
          }, 3000);

          socket.on('connect', () => {
            socket.emit(
              'join:conversation',
              { conversationId: convAdminPm._id.toString() },
              (res: any) => {
                clearTimeout(timeout);
                socket.disconnect();
                if (res && res.success === false) {
                  resolve();
                } else {
                  reject(new Error(`Expected callback error, received: ${JSON.stringify(res)}`));
                }
              }
            );
          });

          socket.on('error', (err: any) => {
            if (err?.code === 'FORBIDDEN') {
              clearTimeout(timeout);
              socket.disconnect();
              resolve();
            }
          });
        });
      }
    );
  } finally {
    // --------------------------------------------------------------------------
    // TEARDOWN & CLEANUP
    // --------------------------------------------------------------------------
    console.log('\n--- Teardown: Performing Scoped Test Cleanup ---');
    try {
      await cleanupAuthzTestData();
      console.log('✔ Scoped test data cleaned up.');
    } catch (cleanupErr: any) {
      console.error('Teardown cleanup error:', cleanupErr.message);
    }

    const ioInstance = getIO();
    if (ioInstance) {
      ioInstance.close();
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
  console.log(`Phase 9.3 Authorization Testing Complete`);
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

runAuthorizationSecurityTests().catch((err) => {
  console.error('Fatal unhandled error during authorization security verification:', err);
  process.exit(1);
});
