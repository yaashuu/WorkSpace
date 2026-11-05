process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import http from 'node:http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import app from '../app';
import {
  connectTestDatabase,
  disconnectDatabase,
  assertTestDatabaseConnection,
} from '../config/database';
import { initSocketServer, getIO } from '../sockets';
import { signToken } from '../utils/jwt';
import bcrypt from 'bcryptjs';

import { User } from '../models/User';
import { Project } from '../models/Project';
import { ProjectMembership } from '../models/ProjectMembership';
import { Task } from '../models/Task';
import { TaskComment } from '../models/TaskComment';
import { ProjectInvitation } from '../models/ProjectInvitation';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { Notification } from '../models/Notification';
import { ActivityLog } from '../models/ActivityLog';

const TEST_PORT = 5093;
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

async function cleanupIntegrationTestData() {
  assertTestDatabaseConnection();

  const testUsers = await User.find({ email: { $regex: /@integ-test\.com$/i } });
  const testUserIds = testUsers.map((u) => u._id);

  const testProjects = await Project.find({
    name: { $regex: /^Integ Test/ },
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

async function runIntegrationWorkflowTests() {
  console.log('================================================================');
  console.log('WorkSpace Phase 9.5 — End-to-End Cross-Module Integration Tests');
  console.log('================================================================\n');

  // 1. Establish isolated test database connection with Phase 9.1 safety guard
  await connectTestDatabase();
  assertTestDatabaseConnection();

  // 2. Initial scoped cleanup
  await cleanupIntegrationTestData();

  // 3. Start test HTTP server + Socket.IO
  const server = http.createServer(app);
  initSocketServer(server);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  console.log(`Test HTTP + Socket.IO server listening on ${BASE_URL}\n`);

  // Shared workflow state variables
  let adminUser: any;
  let pmUser: any;
  let empUser: any;
  let adminToken = '';
  let pmToken = '';
  let empToken = '';
  let createdProjectId = '';
  let invitationToken = '';
  let createdTaskId = '';
  let groupConversationId = '';
  let adminPmConversationId = '';

  try {
    assertTestDatabaseConnection();

    // --------------------------------------------------------------------------
    // Initial Setup: Seed Core Admin and PM Accounts
    // --------------------------------------------------------------------------
    const passwordHash = await bcrypt.hash('IntegPass123!', 4);

    adminUser = await User.create({
      email: 'admin@integ-test.com',
      passwordHash,
      fullName: 'Workflow Admin',
      globalRole: 'ADMIN',
      isActive: true,
    });

    pmUser = await User.create({
      email: 'pm@integ-test.com',
      passwordHash,
      fullName: 'Workflow Primary PM',
      globalRole: 'USER',
      isActive: true,
    });

    adminToken = signToken({
      userId: adminUser._id.toString(),
      email: adminUser.email,
      globalRole: adminUser.globalRole,
    });
    pmToken = signToken({
      userId: pmUser._id.toString(),
      email: pmUser.email,
      globalRole: pmUser.globalRole,
    });

    // --------------------------------------------------------------------------
    // Step 1: Admin Creates Project and Assigns Primary PM
    // --------------------------------------------------------------------------
    await testCase(
      'Step 1: Admin creates project and designates Primary PM (POST /api/v1/projects)',
      'INTEGRATION_STEP_1',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Integ Test Workflow Project',
            key: 'INTG',
            description: 'End-to-end integration workflow project',
            primaryManagerId: pmUser._id.toString(),
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 201);
        createdProjectId = body.data?.project?._id;
        assert.ok(createdProjectId);

        // Verify primary manager membership established
        const pmMembership = await ProjectMembership.findOne({
          projectId: createdProjectId,
          userId: pmUser._id,
          status: 'ACTIVE',
        });
        assert.ok(pmMembership, 'Primary PM must have active membership');
      }
    );

    // --------------------------------------------------------------------------
    // Step 2: PM Generates Invitation for Employee
    // --------------------------------------------------------------------------
    await testCase(
      'Step 2: PM invites employee to project (POST /api/v1/invitations)',
      'INTEGRATION_STEP_2',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/invitations`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId: createdProjectId,
            maxUses: 1,
            expiresInDays: 7,
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 201);
        invitationToken = body.data?.token;
        assert.ok(invitationToken, 'Invitation raw token must be returned');
      }
    );

    // --------------------------------------------------------------------------
    // Step 3: Employee Registers and Accepts Invitation
    // --------------------------------------------------------------------------
    await testCase(
      'Step 3: New employee registers and accepts invitation (POST /api/v1/invitations/accept)',
      'INTEGRATION_STEP_3',
      async () => {
        // Register employee
        const regRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'employee@integ-test.com',
            password: 'EmployeePassword123!',
            fullName: 'Workflow Employee',
          }),
        });
        const regBody = await regRes.json();
        assert.equal(regRes.status, 201);
        empToken = regBody.data?.token;
        empUser = regBody.data?.user;

        // Accept invitation
        const acceptRes = await fetch(`${BASE_URL}/api/v1/invitations/accept`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${empToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: invitationToken }),
        });
        assert.equal(acceptRes.status, 200);

        // Verify ProjectMembership created
        const empMembership = await ProjectMembership.findOne({
          projectId: createdProjectId,
          userId: empUser._id,
          status: 'ACTIVE',
        });
        assert.ok(empMembership, 'Employee must now have active project membership');
      }
    );

    // --------------------------------------------------------------------------
    // Step 4: Employee Accesses Project Details and Resources
    // --------------------------------------------------------------------------
    await testCase(
      'Step 4: Employee accesses project and task board (GET /api/v1/projects/:id)',
      'INTEGRATION_STEP_4',
      async () => {
        const projRes = await fetch(`${BASE_URL}/api/v1/projects/${createdProjectId}`, {
          headers: { Authorization: `Bearer ${empToken}` },
        });
        assert.equal(projRes.status, 200);

        const taskRes = await fetch(`${BASE_URL}/api/v1/projects/${createdProjectId}/tasks`, {
          headers: { Authorization: `Bearer ${empToken}` },
        });
        assert.equal(taskRes.status, 200);
      }
    );

    // --------------------------------------------------------------------------
    // Step 5: PM Creates Task Assigned to Employee
    // --------------------------------------------------------------------------
    await testCase(
      'Step 5: PM creates task assigned to Employee; Employee receives notification',
      'INTEGRATION_STEP_5',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/projects/${createdProjectId}/tasks`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Integration Sprint Task',
            description: 'Task assigned to newly joined employee',
            status: 'TODO',
            priority: 'HIGH',
            assigneeId: empUser._id,
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 201);
        createdTaskId = body.data?._id;
        assert.ok(createdTaskId);

        // Verify TASK_ASSIGNED notification created for employee
        const notif = await Notification.findOne({
          recipientId: empUser._id,
          type: 'TASK_ASSIGNED',
        });
        assert.ok(notif, 'Employee must receive TASK_ASSIGNED notification');
      }
    );

    // --------------------------------------------------------------------------
    // Step 6: Employee Moves Task Status to IN_PROGRESS
    // --------------------------------------------------------------------------
    await testCase(
      'Step 6: Employee moves task status; PM receives TASK_STATUS_CHANGED notification',
      'INTEGRATION_STEP_6',
      async () => {
        const res = await fetch(`${BASE_URL}/api/v1/tasks/${createdTaskId}/status`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${empToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'IN_PROGRESS',
            version: 0,
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 200);
        assert.equal(body.data?.status, 'IN_PROGRESS');

        // Verify PM received TASK_STATUS_CHANGED notification
        const pmNotif = await Notification.findOne({
          recipientId: pmUser._id,
          type: 'TASK_STATUS_CHANGED',
        });
        assert.ok(pmNotif, 'PM must receive TASK_STATUS_CHANGED notification');
      }
    );

    // --------------------------------------------------------------------------
    // Step 7: Real-Time Board Event Delivered to Socket
    // --------------------------------------------------------------------------
    await testCase(
      'Step 7: Real-time board event delivered to connected project socket',
      'INTEGRATION_STEP_7',
      async () => {
        const pmSocket: ClientSocket = ioClient(BASE_URL, {
          auth: { token: pmToken },
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          pmSocket.on('connect', () => {
            pmSocket.emit('join:project', { projectId: createdProjectId }, () => resolve());
          });
          setTimeout(() => reject(new Error('Timeout connecting PM socket')), 3000);
        });

        let eventReceived = false;
        pmSocket.on('task:moved', (data) => {
          if (data?._id === createdTaskId) {
            eventReceived = true;
          }
        });

        // Move task status again
        const moveRes = await fetch(`${BASE_URL}/api/v1/tasks/${createdTaskId}/status`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${empToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'TESTING',
            version: 1,
          }),
        });
        assert.equal(moveRes.status, 200);

        // Wait for socket event delivery
        await new Promise((r) => setTimeout(r, 200));
        pmSocket.disconnect();
        assert.equal(eventReceived, true, 'PM socket must receive task:moved board event');
      }
    );

    // --------------------------------------------------------------------------
    // Step 8: Task Comment Persisted with Activity Log
    // --------------------------------------------------------------------------
    await testCase(
      'Step 8: Task comment persisted and COMMENT_ADDED activity log recorded',
      'INTEGRATION_STEP_8',
      async () => {
        const commentRes = await fetch(`${BASE_URL}/api/v1/tasks/${createdTaskId}/comments`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${empToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: 'Ready for code review and testing.',
          }),
        });
        assert.equal(commentRes.status, 201);

        // Verify ActivityLog recorded
        const log = await ActivityLog.findOne({
          projectId: createdProjectId,
          action: 'COMMENT_ADDED',
          actorId: empUser._id,
        });
        assert.ok(log, 'COMMENT_ADDED activity log must be persisted');
      }
    );

    // --------------------------------------------------------------------------
    // Step 9: Group Chat Message Exchange
    // --------------------------------------------------------------------------
    await testCase(
      'Step 9: Project group conversation message exchange and retrieval',
      'INTEGRATION_STEP_9',
      async () => {
        // Fetch project conversation
        const convRes = await fetch(
          `${BASE_URL}/api/v1/conversations/project/${createdProjectId}`,
          {
            headers: { Authorization: `Bearer ${empToken}` },
          }
        );
        const convBody = await convRes.json();
        assert.equal(convRes.status, 200);
        groupConversationId = convBody.data?._id;

        // Employee posts message
        const msgRes = await fetch(
          `${BASE_URL}/api/v1/conversations/${groupConversationId}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${empToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: 'Hello team, happy to collaborate!' }),
          }
        );
        assert.equal(msgRes.status, 201);

        // PM reads message history
        const listRes = await fetch(
          `${BASE_URL}/api/v1/conversations/${groupConversationId}/messages`,
          {
            headers: { Authorization: `Bearer ${pmToken}` },
          }
        );
        const listBody = await listRes.json();
        assert.equal(listRes.status, 200);
        assert.ok(listBody.data.some((m: any) => m.content.includes('happy to collaborate!')));
      }
    );

    // --------------------------------------------------------------------------
    // Step 10: Private Admin-PM Direct Message Conversation
    // --------------------------------------------------------------------------
    await testCase(
      'Step 10: Admin and PM communicate via private Admin-PM DM',
      'INTEGRATION_STEP_10',
      async () => {
        // Admin initializes DM with PM
        const dmRes = await fetch(
          `${BASE_URL}/api/v1/conversations/admin-pm/${pmUser._id}`,
          {
            headers: { Authorization: `Bearer ${adminToken}` },
          }
        );
        const dmBody = await dmRes.json();
        assert.equal(dmRes.status, 200);
        adminPmConversationId = dmBody.data?._id;

        // Admin sends message
        const sendRes = await fetch(
          `${BASE_URL}/api/v1/conversations/${adminPmConversationId}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${adminToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: 'Confidential project check-in from Admin.' }),
          }
        );
        assert.equal(sendRes.status, 201);

        // Employee attempts to access this private DM (must be 403)
        const snoopRes = await fetch(
          `${BASE_URL}/api/v1/conversations/${adminPmConversationId}/messages`,
          {
            headers: { Authorization: `Bearer ${empToken}` },
          }
        );
        assert.equal(snoopRes.status, 403);
      }
    );

    // --------------------------------------------------------------------------
    // Step 11: Member Removal and Socket Eviction
    // --------------------------------------------------------------------------
    await testCase(
      'Step 11: PM removes Employee; ProjectMembership revoked and user evicted from conversation',
      'INTEGRATION_STEP_11',
      async () => {
        const removeRes = await fetch(
          `${BASE_URL}/api/v1/projects/${createdProjectId}/members/${empUser._id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${pmToken}` },
          }
        );
        assert.equal(removeRes.status, 200);

        // Verify membership revoked
        const m = await ProjectMembership.findOne({
          projectId: createdProjectId,
          userId: empUser._id,
        });
        assert.equal(m?.status, 'REVOKED');

        // Verify user pulled from group conversation participants
        const conv = await Conversation.findById(groupConversationId);
        const isParticipant = conv?.participants.some((p) => p.equals(empUser._id));
        assert.equal(isParticipant, false, 'Removed user must not remain in participants');
      }
    );

    // --------------------------------------------------------------------------
    // Step 12: Post-Removal Unauthorized Operations Rejected
    // --------------------------------------------------------------------------
    await testCase(
      'Step 12: Removed employee receives 403/404 on tasks, comments, and conversation messages',
      'INTEGRATION_STEP_12',
      async () => {
        // Attempt to view tasks (private project -> 404, public project -> 403)
        const taskRes = await fetch(`${BASE_URL}/api/v1/projects/${createdProjectId}/tasks`, {
          headers: { Authorization: `Bearer ${empToken}` },
        });
        assert.ok([403, 404].includes(taskRes.status));

        // Attempt to post comment
        const commentRes = await fetch(`${BASE_URL}/api/v1/tasks/${createdTaskId}/comments`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${empToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: 'Post-removal comment attempt' }),
        });
        assert.ok([403, 404].includes(commentRes.status));

        // Attempt to post message to conversation
        const msgRes = await fetch(
          `${BASE_URL}/api/v1/conversations/${groupConversationId}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${empToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: 'Post-removal message attempt' }),
          }
        );
        assert.ok([403, 404].includes(msgRes.status));
      }
    );
  } finally {
    // --------------------------------------------------------------------------
    // TEARDOWN & CLEANUP
    // --------------------------------------------------------------------------
    console.log('\n--- Teardown: Performing Scoped Integration Test Cleanup ---');
    try {
      await cleanupIntegrationTestData();
      console.log('✔ Scoped integration test data cleaned up.');
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
  console.log(`Phase 9.5 Integration Testing Complete`);
  console.log(`Total Workflow Steps Run:    ${testsRun}`);
  console.log(`Total Workflow Steps Passed: ${testsPassed}`);
  console.log(`Total Workflow Steps Failed: ${testsFailed}`);
  console.log('================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runIntegrationWorkflowTests().catch((err) => {
  console.error('Fatal unhandled error during integration workflow testing:', err);
  process.exit(1);
});
