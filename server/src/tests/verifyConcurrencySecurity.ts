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

const TEST_PORT = 5091;
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

async function cleanupConcurrencyTestData() {
  assertTestDatabaseConnection();

  const testUsers = await User.find({ email: { $regex: /@concur-test\.com$/i } });
  const testUserIds = testUsers.map((u) => u._id);

  const testProjects = await Project.find({
    name: { $regex: /^Concur Test/ },
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

async function runConcurrencyTests() {
  console.log('================================================================');
  console.log('WorkSpace Phase 9.5 — Concurrency & Race Condition Verification');
  console.log('================================================================\n');

  // 1. Establish isolated test database connection with Phase 9.1 safety guard
  await connectTestDatabase();
  assertTestDatabaseConnection();

  // 2. Initial scoped cleanup
  await cleanupConcurrencyTestData();

  // 3. Start test HTTP server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  console.log(`Test HTTP server listening on ${BASE_URL}\n`);

  try {
    assertTestDatabaseConnection();

    // --------------------------------------------------------------------------
    // SEED TEST FIXTURES
    // --------------------------------------------------------------------------
    console.log('--- Seeding Concurrency Test Fixtures ---');
    const passwordHash = await bcrypt.hash('Concur123!', 4);

    const adminUser = await User.create({
      email: 'admin@concur-test.com',
      passwordHash,
      fullName: 'Concur Admin',
      globalRole: 'ADMIN',
      isActive: true,
    });

    const pmUser = await User.create({
      email: 'pm@concur-test.com',
      passwordHash,
      fullName: 'Concur Project Manager',
      globalRole: 'USER',
      isActive: true,
    });

    const memberA = await User.create({
      email: 'membera@concur-test.com',
      passwordHash,
      fullName: 'Concur Member A',
      globalRole: 'USER',
      isActive: true,
    });

    const memberB = await User.create({
      email: 'memberb@concur-test.com',
      passwordHash,
      fullName: 'Concur Member B',
      globalRole: 'USER',
      isActive: true,
    });

    const applicantA = await User.create({
      email: 'applicantA@concur-test.com',
      passwordHash,
      fullName: 'Concur Applicant A',
      globalRole: 'USER',
      isActive: true,
    });

    const applicantB = await User.create({
      email: 'applicantB@concur-test.com',
      passwordHash,
      fullName: 'Concur Applicant B',
      globalRole: 'USER',
      isActive: true,
    });

    const applicantC = await User.create({
      email: 'applicantC@concur-test.com',
      passwordHash,
      fullName: 'Concur Applicant C',
      globalRole: 'USER',
      isActive: true,
    });

    const applicantD = await User.create({
      email: 'applicantD@concur-test.com',
      passwordHash,
      fullName: 'Concur Applicant D',
      globalRole: 'USER',
      isActive: true,
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
    const memberAToken = signToken({
      userId: memberA._id.toString(),
      email: memberA.email,
      globalRole: memberA.globalRole,
    });
    const memberBToken = signToken({
      userId: memberB._id.toString(),
      email: memberB.email,
      globalRole: memberB.globalRole,
    });
    const applicantAToken = signToken({
      userId: applicantA._id.toString(),
      email: applicantA.email,
      globalRole: applicantA.globalRole,
    });
    const applicantBToken = signToken({
      userId: applicantB._id.toString(),
      email: applicantB.email,
      globalRole: applicantB.globalRole,
    });
    const applicantCToken = signToken({
      userId: applicantC._id.toString(),
      email: applicantC.email,
      globalRole: applicantC.globalRole,
    });
    const applicantDToken = signToken({
      userId: applicantD._id.toString(),
      email: applicantD.email,
      globalRole: applicantD.globalRole,
    });

    // Seed Project
    const project = await Project.create({
      name: 'Concur Test Project',
      key: 'CONP',
      description: 'Project for concurrency and race condition tests',
      visibility: 'PUBLIC',
      primaryManagerId: pmUser._id,
      createdBy: adminUser._id,
      status: 'ACTIVE',
    });

    await ProjectMembership.create({
      projectId: project._id,
      userId: pmUser._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });
    await ProjectMembership.create({
      projectId: project._id,
      userId: memberA._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });
    await ProjectMembership.create({
      projectId: project._id,
      userId: memberB._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });

    // Seed Conversation
    const conversation = await Conversation.create({
      type: 'PROJECT_GROUP',
      projectId: project._id,
      participants: [pmUser._id, memberA._id, memberB._id],
      lastMessageAt: new Date(),
    });

    console.log('✔ Concurrency test fixtures seeded.\n');

    // --------------------------------------------------------------------------
    // A. Task Updates & Kanban Concurrency
    // --------------------------------------------------------------------------
    console.log('--- A. Task Updates & Kanban Concurrency ---');

    await testCase(
      'Two concurrent status moves using same version: exactly one 200, one 409 CONCURRENT_MODIFICATION',
      'TASK_CONCURRENCY',
      async () => {
        const task = await Task.create({
          projectId: project._id,
          title: 'Concurrency Task 1',
          status: 'TODO',
          priority: 'MEDIUM',
          assigneeId: memberA._id,
          creatorId: pmUser._id,
          position: 1000,
          version: 0,
        });

        const req1 = fetch(`${BASE_URL}/api/v1/tasks/${task._id}/status`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${memberAToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'IN_PROGRESS', version: 0 }),
        });

        const req2 = fetch(`${BASE_URL}/api/v1/tasks/${task._id}/status`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'DONE', version: 0 }),
        });

        const [res1, res2] = await Promise.all([req1, req2]);
        const statuses = [res1.status, res2.status].sort();

        assert.deepEqual(statuses, [200, 409], 'Must have exactly one 200 and one 409');

        const conflictRes = res1.status === 409 ? res1 : res2;
        const conflictBody = await conflictRes.json();
        assert.equal(conflictBody.error?.code, 'CONCURRENT_MODIFICATION');

        // Check persisted state in database
        const updatedTask = await Task.findById(task._id);
        assert.equal(updatedTask?.version, 1, 'Version must be incremented to exactly 1');
      }
    );

    await testCase(
      'Concurrent updates to independent task fields atomically increment version without lost updates',
      'TASK_CONCURRENCY',
      async () => {
        const task = await Task.create({
          projectId: project._id,
          title: 'Concurrency Task 2',
          status: 'TODO',
          priority: 'LOW',
          assigneeId: memberA._id,
          creatorId: pmUser._id,
          position: 2000,
          version: 0,
        });

        const req1 = fetch(`${BASE_URL}/api/v1/tasks/${task._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title: 'Updated Title By PM' }),
        });

        const req2 = fetch(`${BASE_URL}/api/v1/tasks/${task._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ priority: 'HIGH' }),
        });

        const [res1, res2] = await Promise.all([req1, req2]);
        assert.equal(res1.status, 200);
        assert.equal(res2.status, 200);

        const finalTask = await Task.findById(task._id);
        assert.equal(finalTask?.version, 2, 'Version must be 2 after two atomic increments');
        assert.equal(finalTask?.title, 'Updated Title By PM');
        assert.equal(finalTask?.priority, 'HIGH');
      }
    );

    await testCase(
      'Simultaneous task moves to same target position handle fractional ordering safely',
      'KANBAN_ORDERING',
      async () => {
        const taskA = await Task.create({
          projectId: project._id,
          title: 'Ordered Task A',
          status: 'TODO',
          creatorId: pmUser._id,
          position: 1000,
          version: 0,
        });
        const taskB = await Task.create({
          projectId: project._id,
          title: 'Ordered Task B',
          status: 'TODO',
          creatorId: pmUser._id,
          position: 2000,
          version: 0,
        });
        const taskC = await Task.create({
          projectId: project._id,
          title: 'Ordered Task C',
          status: 'TODO',
          creatorId: pmUser._id,
          position: 3000,
          version: 0,
        });

        // Concurrently move taskB and taskC between 1000 and 2000
        const req1 = fetch(`${BASE_URL}/api/v1/tasks/${taskB._id}/status`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${pmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'TODO',
            version: 0,
            previousTaskId: taskA._id.toString(),
          }),
        });

        const req2 = fetch(`${BASE_URL}/api/v1/tasks/${taskC._id}/status`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'TODO',
            version: 0,
            previousTaskId: taskA._id.toString(),
          }),
        });

        const [res1, res2] = await Promise.all([req1, req2]);
        assert.equal(res1.status, 200);
        assert.equal(res2.status, 200);

        // Fetch all tasks in project to verify deterministic ordering
        const listRes = await fetch(`${BASE_URL}/api/v1/projects/${project._id}/tasks`, {
          headers: { Authorization: `Bearer ${pmToken}` },
        });
        const listBody = await listRes.json();
        const positions = listBody.data.map((t: any) => t.position);

        // All positions must be strictly ascending or valid non-negative numbers
        for (let i = 0; i < positions.length - 1; i++) {
          assert.ok(positions[i] <= positions[i + 1], 'Positions must maintain ascending order');
        }
      }
    );

    // --------------------------------------------------------------------------
    // B. Invitations & Membership Concurrency
    // --------------------------------------------------------------------------
    console.log('\n--- B. Invitations & Membership Concurrency ---');

    await testCase(
      'Two concurrent users accepting single-use invitation (maxUses: 1): exactly one succeeds, one conflicts',
      'INVITATION_CONCURRENCY',
      async () => {
        const rawToken = 'single-use-race-token-12345';
        const invitation = await ProjectInvitation.create({
          projectId: project._id,
          tokenHash: hashToken(rawToken),
          invitedBy: pmUser._id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          maxUses: 1,
          usedCount: 0,
          status: 'PENDING',
        });

        const req1 = fetch(`${BASE_URL}/api/v1/invitations/accept`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${applicantAToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: rawToken }),
        });

        const req2 = fetch(`${BASE_URL}/api/v1/invitations/accept`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${applicantBToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: rawToken }),
        });

        const [res1, res2] = await Promise.all([req1, req2]);
        const statuses = [res1.status, res2.status].sort();

        assert.deepEqual(statuses, [200, 409], 'Must have exactly one 200 and one 409');

        const updatedInvite = await ProjectInvitation.findById(invitation._id);
        assert.equal(updatedInvite?.usedCount, 1, 'usedCount must be exactly 1');
        assert.equal(updatedInvite?.status, 'ACCEPTED');
      }
    );

    await testCase(
      'Four concurrent users accepting maxUses: 2 invitation: exactly 2 succeed (200), 2 fail (409/410)',
      'INVITATION_CONCURRENCY',
      async () => {
        // Create 4 distinct non-member users for this concurrent acceptance test
        const multiUsers = await Promise.all([
          User.create({
            email: 'multi1@concur-test.com',
            passwordHash,
            fullName: 'Multi User 1',
            globalRole: 'USER',
            isActive: true,
          }),
          User.create({
            email: 'multi2@concur-test.com',
            passwordHash,
            fullName: 'Multi User 2',
            globalRole: 'USER',
            isActive: true,
          }),
          User.create({
            email: 'multi3@concur-test.com',
            passwordHash,
            fullName: 'Multi User 3',
            globalRole: 'USER',
            isActive: true,
          }),
          User.create({
            email: 'multi4@concur-test.com',
            passwordHash,
            fullName: 'Multi User 4',
            globalRole: 'USER',
            isActive: true,
          }),
        ]);

        const multiTokens = multiUsers.map((u) =>
          signToken({ userId: u._id.toString(), email: u.email, globalRole: u.globalRole })
        );

        const rawToken = 'multi-use-race-token-12345';
        const invitation = await ProjectInvitation.create({
          projectId: project._id,
          tokenHash: hashToken(rawToken),
          invitedBy: pmUser._id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          maxUses: 2,
          usedCount: 0,
          status: 'PENDING',
        });

        const reqs = multiTokens.map((token) =>
          fetch(`${BASE_URL}/api/v1/invitations/accept`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: rawToken }),
          })
        );

        const responses = await Promise.all(reqs);
        const successCount = responses.filter((r) => r.status === 200).length;
        const failCount = responses.filter((r) => [409, 410].includes(r.status)).length;

        assert.equal(successCount, 2, 'Exactly 2 users must succeed');
        assert.equal(failCount, 2, 'Exactly 2 users must fail');

        const updatedInvite = await ProjectInvitation.findById(invitation._id);
        assert.equal(updatedInvite?.usedCount, 2, 'usedCount must be capped at exactly 2');
        assert.equal(updatedInvite?.status, 'ACCEPTED');
      }
    );

    await testCase(
      'Same user multiple simultaneous acceptance requests (maxUses: 5): exactly 1 membership, usedCount +1, duplicates get ALREADY_MEMBER, no orphan records',
      'INVITATION_IDEMPOTENCY',
      async () => {
        const raceUser = await User.create({
          email: 'sameuser-idemp@concur-test.com',
          passwordHash,
          fullName: 'Same User Idempotency',
          globalRole: 'USER',
          isActive: true,
        });
        const raceUserToken = signToken({
          userId: raceUser._id.toString(),
          email: raceUser.email,
          globalRole: raceUser.globalRole,
        });

        const rawToken = 'same-user-idemp-token-55555';
        const invitation = await ProjectInvitation.create({
          projectId: project._id,
          tokenHash: hashToken(rawToken),
          invitedBy: pmUser._id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          maxUses: 5,
          usedCount: 0,
          status: 'PENDING',
        });

        // 4 simultaneous acceptance requests from the exact same user
        const reqs = [1, 2, 3, 4].map(() =>
          fetch(`${BASE_URL}/api/v1/invitations/accept`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${raceUserToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: rawToken }),
          })
        );

        const responses = await Promise.all(reqs);
        const parsedResponses = await Promise.all(
          responses.map(async (r) => ({
            status: r.status,
            body: await r.json(),
          }))
        );

        // 1. Verify response statuses: exactly one 200, all duplicate requests get 400 ALREADY_MEMBER
        const successResponses = parsedResponses.filter((r) => r.status === 200);
        const duplicateResponses = parsedResponses.filter((r) => r.status === 400);

        assert.equal(successResponses.length, 1, 'Exactly one concurrent request must succeed with 200');
        assert.equal(duplicateResponses.length, 3, 'All 3 duplicate requests must be rejected with 400');
        for (const dup of duplicateResponses) {
          assert.equal(dup.body.error?.code, 'ALREADY_MEMBER', 'Duplicate request error code must be ALREADY_MEMBER');
        }

        // 2. Exactly one active membership is created
        const memberships = await ProjectMembership.find({
          projectId: project._id,
          userId: raceUser._id,
        });
        assert.equal(memberships.length, 1, 'Database must have exactly 1 membership record for user');
        assert.equal(memberships[0].status, 'ACTIVE');
        assert.equal(memberships[0].role, 'MEMBER');

        // 3. usedCount increases by exactly one
        const updatedInvite = await ProjectInvitation.findById(invitation._id);
        assert.equal(updatedInvite?.usedCount, 1, 'usedCount must increase by exactly 1');

        // 4. The invitation is not incorrectly marked exhausted
        assert.equal(updatedInvite?.status, 'PENDING', 'Invitation with maxUses: 5 must remain PENDING after 1 use');

        // 5. User is not added repeatedly to conversation participants
        const groupConv = await Conversation.findOne({
          projectId: project._id,
          type: 'PROJECT_GROUP',
        });
        const userParticipantOccurrences = groupConv?.participants.filter((p) =>
          p.equals(raceUser._id)
        ).length;
        assert.equal(userParticipantOccurrences, 1, 'User must appear exactly once in conversation participants');

        // 6. No orphan or inconsistent records are created
        const activityCount = await ActivityLog.countDocuments({
          projectId: project._id,
          actorId: raceUser._id,
          action: 'MEMBER_JOINED_INVITATION',
        });
        assert.equal(activityCount, 1, 'Exactly 1 activity log entry must be recorded for this acceptance');
      }
    );

    await testCase(
      'Two distinct concurrent users accepting a maxUses: 2 invitation: both join, usedCount equals 2, marked ACCEPTED',
      'LEGITIMATE_CONCURRENT_ACCEPTANCE',
      async () => {
        const [legitUser1, legitUser2] = await Promise.all([
          User.create({
            email: 'legit1@concur-test.com',
            passwordHash,
            fullName: 'Legit User 1',
            globalRole: 'USER',
            isActive: true,
          }),
          User.create({
            email: 'legit2@concur-test.com',
            passwordHash,
            fullName: 'Legit User 2',
            globalRole: 'USER',
            isActive: true,
          }),
        ]);

        const token1 = signToken({ userId: legitUser1._id.toString(), email: legitUser1.email, globalRole: legitUser1.globalRole });
        const token2 = signToken({ userId: legitUser2._id.toString(), email: legitUser2.email, globalRole: legitUser2.globalRole });

        const rawToken = 'legit-two-user-token-22222';
        const invitation = await ProjectInvitation.create({
          projectId: project._id,
          tokenHash: hashToken(rawToken),
          invitedBy: pmUser._id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          maxUses: 2,
          usedCount: 0,
          status: 'PENDING',
        });

        const req1 = fetch(`${BASE_URL}/api/v1/invitations/accept`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token1}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: rawToken }),
        });

        const req2 = fetch(`${BASE_URL}/api/v1/invitations/accept`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token2}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: rawToken }),
        });

        const [res1, res2] = await Promise.all([req1, req2]);
        assert.equal(res1.status, 200, 'User 1 must succeed with 200');
        assert.equal(res2.status, 200, 'User 2 must succeed with 200');

        const updatedInvite = await ProjectInvitation.findById(invitation._id);
        assert.equal(updatedInvite?.usedCount, 2, 'usedCount must be exactly 2');
        assert.equal(updatedInvite?.status, 'ACCEPTED', 'Invitation must transition to ACCEPTED when maxUses is reached');

        const [m1, m2] = await Promise.all([
          ProjectMembership.findOne({ projectId: project._id, userId: legitUser1._id, status: 'ACTIVE' }),
          ProjectMembership.findOne({ projectId: project._id, userId: legitUser2._id, status: 'ACTIVE' }),
        ]);
        assert.ok(m1, 'Active membership must exist for User 1');
        assert.ok(m2, 'Active membership must exist for User 2');
      }
    );

    await testCase(
      'Concurrent join-request approval vs rejection: exactly one succeeds, one gets 409',
      'JOIN_REQUEST_CONCURRENCY',
      async () => {
        const joinReq = await JoinRequest.create({
          projectId: project._id,
          userId: applicantC._id,
          status: 'PENDING',
        });

        const reqApprove = fetch(`${BASE_URL}/api/v1/join-requests/${joinReq._id}/approve`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${pmToken}` },
        });

        const reqReject = fetch(`${BASE_URL}/api/v1/join-requests/${joinReq._id}/reject`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rejectionReason: 'Admin decided rejection' }),
        });

        const [resApprove, resReject] = await Promise.all([reqApprove, reqReject]);
        const statuses = [resApprove.status, resReject.status].sort();

        assert.deepEqual(statuses, [200, 409], 'Must have exactly one 200 and one 409');

        const updatedJoinReq = await JoinRequest.findById(joinReq._id);
        assert.ok(['APPROVED', 'REJECTED'].includes(updatedJoinReq!.status));
      }
    );

    // --------------------------------------------------------------------------
    // C. Notifications & Activity Concurrency
    // --------------------------------------------------------------------------
    console.log('\n--- C. Notifications & Activity Concurrency ---');

    await testCase(
      'Concurrent markAsRead calls on same notification succeed idempotently',
      'NOTIFICATION_CONCURRENCY',
      async () => {
        const notif = await Notification.create({
          recipientId: memberA._id,
          type: 'TASK_ASSIGNED',
          title: 'Race Notification',
          body: 'Concurrent read test',
          link: '/projects',
          isRead: false,
        });

        const req1 = fetch(`${BASE_URL}/api/v1/notifications/${notif._id}/read`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${memberAToken}` },
        });

        const req2 = fetch(`${BASE_URL}/api/v1/notifications/${notif._id}/read`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${memberAToken}` },
        });

        const [res1, res2] = await Promise.all([req1, req2]);
        assert.equal(res1.status, 200);
        assert.equal(res2.status, 200);

        const updatedNotif = await Notification.findById(notif._id);
        assert.equal(updatedNotif?.isRead, true);
      }
    );

    await testCase(
      'Concurrent markAllAsRead calls cleanly reset unreadCount to 0',
      'NOTIFICATION_CONCURRENCY',
      async () => {
        // Seed 3 unread notifications for memberB
        await Notification.create([
          {
            recipientId: memberB._id,
            type: 'TASK_ASSIGNED',
            title: 'Notif 1',
            body: 'Body 1',
            link: '/projects',
            isRead: false,
          },
          {
            recipientId: memberB._id,
            type: 'TASK_ASSIGNED',
            title: 'Notif 2',
            body: 'Body 2',
            link: '/projects',
            isRead: false,
          },
        ]);

        const req1 = fetch(`${BASE_URL}/api/v1/notifications/read-all`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${memberBToken}` },
        });

        const req2 = fetch(`${BASE_URL}/api/v1/notifications/read-all`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${memberBToken}` },
        });

        const [res1, res2] = await Promise.all([req1, req2]);
        assert.equal(res1.status, 200);
        assert.equal(res2.status, 200);

        const remainingUnread = await Notification.countDocuments({
          recipientId: memberB._id,
          isRead: false,
        });
        assert.equal(remainingUnread, 0);
      }
    );

    // --------------------------------------------------------------------------
    // D. Chat Message Persistence Concurrency
    // --------------------------------------------------------------------------
    console.log('\n--- D. Chat Message Persistence Concurrency ---');

    await testCase(
      'Simultaneous message submissions from multiple members: all persisted with valid timestamps and reverse pagination',
      'CHAT_CONCURRENCY',
      async () => {
        const messagesToSend = [
          { token: pmToken, content: 'Concurrent Message from PM' },
          { token: memberAToken, content: 'Concurrent Message from Member A' },
          { token: memberBToken, content: 'Concurrent Message from Member B' },
        ];

        const reqs = messagesToSend.map((m) =>
          fetch(`${BASE_URL}/api/v1/conversations/${conversation._id}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${m.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: m.content }),
          })
        );

        const responses = await Promise.all(reqs);
        for (const res of responses) {
          assert.equal(res.status, 201);
        }

        // Fetch message history
        const listRes = await fetch(
          `${BASE_URL}/api/v1/conversations/${conversation._id}/messages?limit=10`,
          {
            headers: { Authorization: `Bearer ${memberAToken}` },
          }
        );
        const listBody = await listRes.json();
        assert.equal(listRes.status, 200);
        assert.ok(listBody.data.length >= 3);

        // Verify timestamps are descending (reverse-chronological)
        const times = listBody.data.map((m: any) => new Date(m.createdAt).getTime());
        for (let i = 0; i < times.length - 1; i++) {
          assert.ok(times[i] >= times[i + 1], 'Messages must be sorted in reverse-chronological order');
        }
      }
    );

    // --------------------------------------------------------------------------
    // E. Partial-Failure Consistency & Compensation (Follow-up)
    // --------------------------------------------------------------------------
    console.log('\n--- E. Partial-Failure Consistency & Compensation ---');

    await testCase(
      'Scenario A: Membership creation failure cleanly restores invitation usage and usedBy',
      'PARTIAL_FAILURE_MEMBERSHIP',
      async () => {
        const failUser = await User.create({
          email: 'fail-mem@concur-test.com',
          passwordHash,
          fullName: 'Fail Mem User',
          globalRole: 'USER',
          isActive: true,
        });
        const failUserToken = signToken({
          userId: failUser._id.toString(),
          email: failUser.email,
          globalRole: failUser.globalRole,
        });

        const rawToken = 'fail-membership-token-11111';
        const invitation = await ProjectInvitation.create({
          projectId: project._id,
          tokenHash: hashToken(rawToken),
          invitedBy: pmUser._id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          maxUses: 1,
          usedCount: 0,
          status: 'PENDING',
        });

        const originalFindOneAndUpdate = ProjectMembership.findOneAndUpdate;
        try {
          (ProjectMembership as any).findOneAndUpdate = async (...args: any[]) => {
            throw new Error('Simulated database crash during ProjectMembership.findOneAndUpdate');
          };

          const res = await fetch(`${BASE_URL}/api/v1/invitations/accept`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${failUserToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: rawToken }),
          });

          assert.equal(res.status, 500, 'Request must fail with 500 when membership creation crashes');

          const updatedInvite = await ProjectInvitation.findById(invitation._id);
          assert.equal(updatedInvite?.usedCount, 0, 'usedCount must be restored to 0');
          assert.equal(updatedInvite?.status, 'PENDING', 'status must be PENDING');
          assert.equal(updatedInvite?.usedBy.length, 0, 'usedBy must not contain user');

          const mem = await ProjectMembership.findOne({ projectId: project._id, userId: failUser._id });
          assert.equal(mem, null, 'No membership record must exist');
        } finally {
          (ProjectMembership as any).findOneAndUpdate = originalFindOneAndUpdate;
        }
      }
    );

    await testCase(
      'Scenario B: Activity log failure rolls back membership, conversation participant, and invitation usage',
      'PARTIAL_FAILURE_ACTIVITY',
      async () => {
        const failUser = await User.create({
          email: 'fail-act@concur-test.com',
          passwordHash,
          fullName: 'Fail Act User',
          globalRole: 'USER',
          isActive: true,
        });
        const failUserToken = signToken({
          userId: failUser._id.toString(),
          email: failUser.email,
          globalRole: failUser.globalRole,
        });

        const rawToken = 'fail-activity-token-22222';
        const invitation = await ProjectInvitation.create({
          projectId: project._id,
          tokenHash: hashToken(rawToken),
          invitedBy: pmUser._id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          maxUses: 1,
          usedCount: 0,
          status: 'PENDING',
        });

        const originalActivityLogCreate = ActivityLog.create;
        try {
          (ActivityLog as any).create = async (...args: any[]) => {
            throw new Error('Simulated database crash during ActivityLog.create');
          };

          const res = await fetch(`${BASE_URL}/api/v1/invitations/accept`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${failUserToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: rawToken }),
          });

          assert.equal(res.status, 500, 'Request must fail with 500 when activity log crashes');

          // Verify invitation usage restored
          const updatedInvite = await ProjectInvitation.findById(invitation._id);
          assert.equal(updatedInvite?.usedCount, 0, 'usedCount must be restored to 0');
          assert.equal(updatedInvite?.status, 'PENDING', 'status must be restored to PENDING');
          assert.equal(updatedInvite?.usedBy.length, 0, 'usedBy must be empty');

          // Verify membership was cleanly rolled back
          const mem = await ProjectMembership.findOne({ projectId: project._id, userId: failUser._id });
          assert.equal(mem, null, 'Membership must be deleted on downstream failure');

          // Verify conversation participant was rolled back
          const groupConv = await Conversation.findOne({ projectId: project._id, type: 'PROJECT_GROUP' });
          const inParticipants = groupConv?.participants.some((p) => p.equals(failUser._id));
          assert.equal(inParticipants, false, 'User must not remain in conversation participants');
        } finally {
          (ActivityLog as any).create = originalActivityLogCreate;
        }
      }
    );

    await testCase(
      'Scenario C: Conversation participant update failure rolls back membership and restores invitation',
      'PARTIAL_FAILURE_CONVERSATION',
      async () => {
        const failUser = await User.create({
          email: 'fail-conv@concur-test.com',
          passwordHash,
          fullName: 'Fail Conv User',
          globalRole: 'USER',
          isActive: true,
        });
        const failUserToken = signToken({
          userId: failUser._id.toString(),
          email: failUser.email,
          globalRole: failUser.globalRole,
        });

        const rawToken = 'fail-conv-token-33333';
        const invitation = await ProjectInvitation.create({
          projectId: project._id,
          tokenHash: hashToken(rawToken),
          invitedBy: pmUser._id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          maxUses: 1,
          usedCount: 0,
          status: 'PENDING',
        });

        const originalConversationUpdateOne = Conversation.updateOne;
        try {
          (Conversation as any).updateOne = async (filter: any, ...args: any[]) => {
            // Only throw when updating PROJECT_GROUP participants during accept
            if (filter?.type === 'PROJECT_GROUP') {
              throw new Error('Simulated database crash during Conversation.updateOne');
            }
            return (originalConversationUpdateOne as any).apply(Conversation, [filter, ...args]);
          };

          const res = await fetch(`${BASE_URL}/api/v1/invitations/accept`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${failUserToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: rawToken }),
          });

          assert.equal(res.status, 500, 'Request must fail with 500 when conversation update crashes');

          // Verify invitation usage restored
          const updatedInvite = await ProjectInvitation.findById(invitation._id);
          assert.equal(updatedInvite?.usedCount, 0, 'usedCount must be restored to 0');
          assert.equal(updatedInvite?.status, 'PENDING', 'status must be PENDING');
          assert.equal(updatedInvite?.usedBy.length, 0, 'usedBy must be empty');

          // Verify membership was cleanly rolled back
          const mem = await ProjectMembership.findOne({ projectId: project._id, userId: failUser._id });
          assert.equal(mem, null, 'Membership must be deleted when conversation update crashes');

          // Verify conversation participant was NOT added
          const groupConv = await Conversation.findOne({ projectId: project._id, type: 'PROJECT_GROUP' });
          const inParticipants = groupConv?.participants.some((p) => p.equals(failUser._id));
          assert.equal(inParticipants, false, 'User must not be in conversation participants');
        } finally {
          (Conversation as any).updateOne = originalConversationUpdateOne;
        }
      }
    );

    await testCase(
      'Scenario D: Concurrent legitimate acceptance during compensation preserves other user and status consistency',
      'PARTIAL_FAILURE_CONCURRENT_COMPENSATION',
      async () => {
        const [failingUser, legitUser] = await Promise.all([
          User.create({
            email: 'fail-comp1@concur-test.com',
            passwordHash,
            fullName: 'Failing User Comp',
            globalRole: 'USER',
            isActive: true,
          }),
          User.create({
            email: 'legit-comp2@concur-test.com',
            passwordHash,
            fullName: 'Legit User Comp',
            globalRole: 'USER',
            isActive: true,
          }),
        ]);

        const failingToken = signToken({
          userId: failingUser._id.toString(),
          email: failingUser.email,
          globalRole: failingUser.globalRole,
        });
        const legitToken = signToken({
          userId: legitUser._id.toString(),
          email: legitUser.email,
          globalRole: legitUser.globalRole,
        });

        const rawToken = 'concurrent-comp-token-44444';
        const invitation = await ProjectInvitation.create({
          projectId: project._id,
          tokenHash: hashToken(rawToken),
          invitedBy: pmUser._id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          maxUses: 2,
          usedCount: 0,
          status: 'PENDING',
        });

        const originalActivityLogCreate = ActivityLog.create;
        try {
          // Failing user triggers an error during ActivityLog.create, but Legit user succeeds!
          (ActivityLog as any).create = async (docs: any[], ...rest: any[]) => {
            const isFailingUser = docs.some((d: any) => d.actorId?.equals(failingUser._id));
            if (isFailingUser) {
              throw new Error('Simulated ActivityLog crash for failing user');
            }
            return (originalActivityLogCreate as any).apply(ActivityLog, [docs, ...rest]);
          };

          const req1 = fetch(`${BASE_URL}/api/v1/invitations/accept`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${failingToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: rawToken }),
          });

          const req2 = fetch(`${BASE_URL}/api/v1/invitations/accept`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${legitToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: rawToken }),
          });

          const [res1, res2] = await Promise.all([req1, req2]);
          assert.equal(res1.status, 500, 'Failing user must receive 500 error');
          assert.equal(res2.status, 200, 'Legit user must succeed with 200');

          // Verify invitation state:
          // usedCount must be EXACTLY 1 (Legit user's use).
          // usedBy must contain ONLY Legit user.
          // status must be PENDING (1 < 2).
          const updatedInvite = await ProjectInvitation.findById(invitation._id);
          assert.equal(updatedInvite?.usedCount, 1, 'usedCount must be exactly 1 after compensation');
          assert.equal(updatedInvite?.status, 'PENDING', 'status must remain PENDING because 1 of 2 uses remain');
          assert.equal(updatedInvite?.usedBy.length, 1, 'usedBy must contain exactly 1 user');
          assert.ok(updatedInvite?.usedBy[0].equals(legitUser._id), 'usedBy must contain strictly legitUser');

          // Verify memberships:
          const legitMem = await ProjectMembership.findOne({ projectId: project._id, userId: legitUser._id });
          assert.ok(legitMem, 'Legit user membership must exist');
          assert.equal(legitMem.status, 'ACTIVE');

          const failMem = await ProjectMembership.findOne({ projectId: project._id, userId: failingUser._id });
          assert.equal(failMem, null, 'Failing user membership must be rolled back');

          // Verify conversation participants:
          const groupConv = await Conversation.findOne({ projectId: project._id, type: 'PROJECT_GROUP' });
          assert.ok(groupConv?.participants.some((p) => p.equals(legitUser._id)), 'Legit user must be in conversation');
          assert.ok(!groupConv?.participants.some((p) => p.equals(failingUser._id)), 'Failing user must NOT be in conversation');
        } finally {
          (ActivityLog as any).create = originalActivityLogCreate;
        }
      }
    );
  } finally {
    // --------------------------------------------------------------------------
    // TEARDOWN & CLEANUP
    // --------------------------------------------------------------------------
    console.log('\n--- Teardown: Performing Scoped Test Cleanup ---');
    try {
      await cleanupConcurrencyTestData();
      console.log('✔ Scoped concurrency test data cleaned up.');
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
  console.log(`Phase 9.5 Concurrency Testing Complete`);
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

runConcurrencyTests().catch((err) => {
  console.error('Fatal unhandled error during concurrency testing:', err);
  process.exit(1);
});
