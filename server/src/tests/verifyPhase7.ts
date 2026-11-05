process.env.NODE_ENV = 'test';

import http from 'http';
import mongoose from 'mongoose';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import app from '../app';
import { connectTestDatabase, disconnectDatabase, assertTestDatabaseConnection } from '../config/database';
import { initSocketServer } from '../sockets';
import { User } from '../models/User';
import { Project } from '../models/Project';
import { ProjectMembership } from '../models/ProjectMembership';
import { Task } from '../models/Task';
import { JoinRequest } from '../models/JoinRequest';
import { Notification } from '../models/Notification';
import { ActivityLog } from '../models/ActivityLog';
import { signToken } from '../utils/jwt';
import { hashPassword } from '../utils/password';

const TEST_PORT = 5065;
const BASE_URL = `http://localhost:${TEST_PORT}`;

const assert = (condition: boolean, message: string = 'Assertion failed') => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
};

const connectClientSocket = (token?: string): Promise<ClientSocket> => {
  return new Promise((resolve, reject) => {
    const socket = ioClient(BASE_URL, {
      auth: token ? { token } : undefined,
      transports: ['websocket'],
      reconnection: false,
      timeout: 4000,
      forceNew: true,
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
};

async function runTests() {
  console.log('====================================================');
  console.log('WorkSpace Phase 7 — Comprehensive Verification Suite');
  console.log('====================================================\n');

  await connectTestDatabase();
  assertTestDatabaseConnection();

  const server = http.createServer(app);
  const io = initSocketServer(server);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  console.log(`Test HTTP + Socket.IO server listening on ${BASE_URL}\n`);

  const activeSockets: ClientSocket[] = [];

  try {
    // Safety guard assertion before any cleanup or mutations
    assertTestDatabaseConnection();

    // 1. Cleanup previous Phase 7 test data (strictly scoped)
    const p7Projects = await Project.find({ key: { $regex: /^P7/ } }, '_id');
    const p7ProjectIds = p7Projects.map((p) => p._id);
    const p7Users = await User.find({ email: { $regex: /@phase7-test\.com$/ } }, '_id');
    const p7UserIds = p7Users.map((u) => u._id);

    if (p7ProjectIds.length > 0 || p7UserIds.length > 0) {
      await ProjectMembership.deleteMany({
        $or: [
          { projectId: { $in: p7ProjectIds } },
          { userId: { $in: p7UserIds } },
        ],
      });
      await Task.deleteMany({ projectId: { $in: p7ProjectIds } });
      await JoinRequest.deleteMany({
        $or: [
          { projectId: { $in: p7ProjectIds } },
          { userId: { $in: p7UserIds } },
        ],
      });
      await Notification.deleteMany({ recipientId: { $in: p7UserIds } });
      await ActivityLog.deleteMany({
        $or: [
          { projectId: { $in: p7ProjectIds } },
          { actorId: { $in: p7UserIds } },
        ],
      });
    }
    await Project.deleteMany({ key: { $regex: /^P7/ } });
    await User.deleteMany({ email: { $regex: /@phase7-test\.com$/ } });

    // 2. Seed test users
    const pwdHash = await hashPassword('TestPassword123!');

    const adminUser = await User.create({
      email: 'admin@phase7-test.com',
      fullName: 'Super Admin',
      passwordHash: pwdHash,
      globalRole: 'ADMIN',
      isActive: true,
    });
    const adminToken = signToken({
      userId: adminUser._id.toString(),
      email: adminUser.email,
      globalRole: 'ADMIN',
    });

    const pmUser = await User.create({
      email: 'pm@phase7-test.com',
      fullName: 'Primary PM',
      passwordHash: pwdHash,
      globalRole: 'USER',
      isActive: true,
    });
    const pmToken = signToken({
      userId: pmUser._id.toString(),
      email: pmUser.email,
      globalRole: 'USER',
    });

    const memberUser = await User.create({
      email: 'member@phase7-test.com',
      fullName: 'Assigned Member',
      passwordHash: pwdHash,
      globalRole: 'USER',
      isActive: true,
    });
    const memberToken = signToken({
      userId: memberUser._id.toString(),
      email: memberUser.email,
      globalRole: 'USER',
    });

    const outsiderUser = await User.create({
      email: 'outsider@phase7-test.com',
      fullName: 'Outside User',
      passwordHash: pwdHash,
      globalRole: 'USER',
      isActive: true,
    });
    const outsiderToken = signToken({
      userId: outsiderUser._id.toString(),
      email: outsiderUser.email,
      globalRole: 'USER',
    });

    // 3. Seed Projects
    const privateProject = await Project.create({
      name: 'Private Alpha Engine',
      key: 'P7PRIV',
      description: 'Private core platform development',
      visibility: 'PRIVATE',
      status: 'ACTIVE',
      createdBy: adminUser._id,
      primaryManagerId: pmUser._id,
    });

    const publicProject = await Project.create({
      name: 'Public Beta Open Tools',
      key: 'P7PUB',
      description: 'Public community open source project',
      visibility: 'PUBLIC',
      status: 'ACTIVE',
      createdBy: adminUser._id,
      primaryManagerId: pmUser._id,
    });

    await ProjectMembership.create({
      projectId: privateProject._id,
      userId: pmUser._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });
    await ProjectMembership.create({
      projectId: privateProject._id,
      userId: memberUser._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });

    await ProjectMembership.create({
      projectId: publicProject._id,
      userId: pmUser._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });

    // Connect real-time sockets
    const memberSocket = await connectClientSocket(memberToken);
    activeSockets.push(memberSocket);

    const pmSocket = await connectClientSocket(pmToken);
    activeSockets.push(pmSocket);

    const outsiderSocket = await connectClientSocket(outsiderToken);
    activeSockets.push(outsiderSocket);

    // ----------------------------------------------------
    // Test 1: Real-Time TASK_ASSIGNED Notification on Task Creation
    // ----------------------------------------------------
    const memberNotificationPromise = new Promise<any>((resolve) => {
      memberSocket.once('notification:received', resolve);
    });

    let outsiderReceivedWrongNotification = false;
    outsiderSocket.on('notification:received', () => {
      outsiderReceivedWrongNotification = true;
    });

    const createTaskRes = await fetch(`${BASE_URL}/api/v1/projects/${privateProject._id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmToken}`,
      },
      body: JSON.stringify({
        title: 'Build Secure Notification Service',
        status: 'BACKLOG',
        priority: 'HIGH',
        assigneeId: memberUser._id.toString(),
      }),
    });
    const createTaskData = (await createTaskRes.json()) as any;
    assert(createTaskRes.status === 201, `Create task failed with status ${createTaskRes.status}`);
    const taskId = createTaskData.data._id;

    // Await real-time notification on recipient's socket
    const receivedNotification = await memberNotificationPromise;
    assert(receivedNotification.type === 'TASK_ASSIGNED', `Expected TASK_ASSIGNED, got ${receivedNotification.type}`);
    assert(receivedNotification.recipientId === memberUser._id.toString(), 'RecipientId mismatch');
    assert(!outsiderReceivedWrongNotification, 'Outsider should NOT receive private member notification');

    // Persistence-before-broadcast check: verify in database
    const dbNotif = await Notification.findById(receivedNotification._id);
    assert(dbNotif !== null, 'Notification must be persisted in MongoDB before broadcast');
    assert(dbNotif!.isRead === false, 'New notification must be unread');
    console.log('✔ Test 1: TASK_ASSIGNED notification created, persisted, and delivered exclusively to recipient socket.');

    // ----------------------------------------------------
    // Test 2: Notification on Task Reassignment (updateTask)
    // ----------------------------------------------------
    // Create an unassigned task first
    const createUnassignedRes = await fetch(`${BASE_URL}/api/v1/projects/${privateProject._id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmToken}`,
      },
      body: JSON.stringify({
        title: 'Review Documentation',
        status: 'TODO',
      }),
    });
    const unassignedData = (await createUnassignedRes.json()) as any;
    const unassignedTaskId = unassignedData.data._id;

    // PM assigns this task to memberUser
    const reassignNotifPromise = new Promise<any>((resolve) => {
      memberSocket.once('notification:received', resolve);
    });

    const patchTaskRes = await fetch(`${BASE_URL}/api/v1/tasks/${unassignedTaskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmToken}`,
      },
      body: JSON.stringify({
        assigneeId: memberUser._id.toString(),
      }),
    });
    assert(patchTaskRes.status === 200, `Reassign task failed with ${patchTaskRes.status}`);

    const reassignedNotif = await reassignNotifPromise;
    assert(reassignedNotif.type === 'TASK_ASSIGNED', 'Expected TASK_ASSIGNED on reassignment');
    console.log('✔ Test 2: TASK_ASSIGNED notification dispatched when task is assigned via updateTask.');

    // ----------------------------------------------------
    // Test 3: TASK_STATUS_CHANGED Notification
    // ----------------------------------------------------
    // Member moves status -> PM receives notification
    const pmStatusNotifPromise = new Promise<any>((resolve) => {
      pmSocket.once('notification:received', resolve);
    });

    const moveRes = await fetch(`${BASE_URL}/api/v1/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({
        status: 'IN_PROGRESS',
        version: 0,
      }),
    });
    assert(moveRes.status === 200, `Move task failed with ${moveRes.status}`);

    const pmStatusNotif = await pmStatusNotifPromise;
    assert(pmStatusNotif.type === 'TASK_STATUS_CHANGED', 'Expected TASK_STATUS_CHANGED for PM');
    assert(pmStatusNotif.recipientId === pmUser._id.toString(), 'PM should receive status changed notification');
    console.log('✔ Test 3: TASK_STATUS_CHANGED notification dispatched to PM when assigned member moves card.');

    // ----------------------------------------------------
    // Test 4: JOIN_REQUEST_CREATED and JOIN_REQUEST_RESOLVED Notifications
    // ----------------------------------------------------
    // Outsider submits join request on public project -> PM receives notification
    const pmJoinReqNotifPromise = new Promise<any>((resolve) => {
      pmSocket.once('notification:received', resolve);
    });

    const submitJoinRes = await fetch(`${BASE_URL}/api/v1/projects/${publicProject._id}/join-requests`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    const submitJoinData = (await submitJoinRes.json()) as any;
    assert(submitJoinRes.status === 201, `Submit join request failed with ${submitJoinRes.status}`);
    const joinReqId = submitJoinData.data.joinRequest._id;

    const pmJoinReqNotif = await pmJoinReqNotifPromise;
    assert(pmJoinReqNotif.type === 'JOIN_REQUEST_CREATED', 'Expected JOIN_REQUEST_CREATED for PM');

    // PM approves join request -> Outsider receives JOIN_REQUEST_RESOLVED
    const outsiderResolvedNotifPromise = new Promise<any>((resolve) => {
      outsiderSocket.once('notification:received', resolve);
    });

    const approveRes = await fetch(`${BASE_URL}/api/v1/join-requests/${joinReqId}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${pmToken}` },
    });
    assert(approveRes.status === 200, `Approve join request failed`);

    const outsiderResolvedNotif = await outsiderResolvedNotifPromise;
    assert(outsiderResolvedNotif.type === 'JOIN_REQUEST_RESOLVED', 'Expected JOIN_REQUEST_RESOLVED for applicant');
    assert(outsiderResolvedNotif.recipientId === outsiderUser._id.toString());
    console.log('✔ Test 4: JOIN_REQUEST_CREATED and JOIN_REQUEST_RESOLVED notifications delivered in real time.');

    // ----------------------------------------------------
    // Test 5: INVITATION_RECEIVED Notification
    // ----------------------------------------------------
    // Create new external registered user to invite
    const invitedUser = await User.create({
      email: 'invited@phase7-test.com',
      fullName: 'Invited Engineer',
      passwordHash: pwdHash,
      globalRole: 'USER',
      isActive: true,
    });
    const invitedToken = signToken({
      userId: invitedUser._id.toString(),
      email: invitedUser.email,
      globalRole: 'USER',
    });
    const invitedSocket = await connectClientSocket(invitedToken);
    activeSockets.push(invitedSocket);

    const invitedNotifPromise = new Promise<any>((resolve) => {
      invitedSocket.once('notification:received', resolve);
    });

    const inviteRes = await fetch(`${BASE_URL}/api/v1/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmToken}`,
      },
      body: JSON.stringify({
        projectId: privateProject._id.toString(),
        invitedEmail: 'invited@phase7-test.com',
      }),
    });
    assert(inviteRes.status === 201, `Create invitation failed with ${inviteRes.status}`);

    const invitedNotif = await invitedNotifPromise;
    assert(invitedNotif.type === 'INVITATION_RECEIVED', 'Expected INVITATION_RECEIVED notification');
    assert(invitedNotif.recipientId === invitedUser._id.toString());
    console.log('✔ Test 5: INVITATION_RECEIVED notification delivered to existing registered user.');

    // ----------------------------------------------------
    // Test 6: No Notification on Failed Business Operations
    // ----------------------------------------------------
    const notifCountBefore = await Notification.countDocuments();

    // Failed task creation (invalid assignee)
    await fetch(`${BASE_URL}/api/v1/projects/${privateProject._id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmToken}`,
      },
      body: JSON.stringify({
        title: 'Should fail',
        assigneeId: new mongoose.Types.ObjectId().toString(),
      }),
    });

    // Failed move status (stale version)
    await fetch(`${BASE_URL}/api/v1/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({
        status: 'DONE',
        version: 0, // stale version (current is 1)
      }),
    });

    const notifCountAfter = await Notification.countDocuments();
    assert(notifCountBefore === notifCountAfter, 'Failed operations must not generate notifications');
    console.log('✔ Test 6: No notifications created on failed or rejected business operations.');

    // ----------------------------------------------------
    // Test 7: Notification Retrieval & Pagination
    // ----------------------------------------------------
    const getNotifsRes = await fetch(`${BASE_URL}/api/v1/notifications?limit=2&page=1`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    const getNotifsData = (await getNotifsRes.json()) as any;
    assert(getNotifsRes.status === 200, `Get notifications failed`);
    assert(Array.isArray(getNotifsData.data.notifications), 'Expected notifications array');
    assert(getNotifsData.data.notifications.length === 2, 'Limit 2 respected');
    assert(getNotifsData.data.pagination.page === 1, 'Pagination page mismatch');
    assert(getNotifsData.data.unreadCount >= 2, 'Unread count should be >= 2');
    console.log('✔ Test 7: Authenticated notification retrieval with pagination and unread counts succeeded.');

    // ----------------------------------------------------
    // Test 8: Accurate Unread Count & Filtering (?isRead=false)
    // ----------------------------------------------------
    const unreadCountRes = await fetch(`${BASE_URL}/api/v1/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    const unreadCountData = (await unreadCountRes.json()) as any;
    assert(unreadCountRes.status === 200, 'Get unread-count failed');
    assert(typeof unreadCountData.data.unreadCount === 'number', 'unreadCount must be a number');

    const unreadFilteredRes = await fetch(`${BASE_URL}/api/v1/notifications?isRead=false`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    const unreadFilteredData = (await unreadFilteredRes.json()) as any;
    assert(unreadFilteredRes.status === 200);
    assert(
      unreadFilteredData.data.notifications.every((n: any) => n.isRead === false),
      'All filtered notifications must have isRead: false'
    );
    console.log('✔ Test 8: Dedicated unread count endpoint and isRead=false filtering verified.');

    // ----------------------------------------------------
    // Test 9: Mark Single Notification as Read & Idempotency
    // ----------------------------------------------------
    const targetNotifId = getNotifsData.data.notifications[0]._id;
    const markReadRes = await fetch(`${BASE_URL}/api/v1/notifications/${targetNotifId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    const markReadData = (await markReadRes.json()) as any;
    assert(markReadRes.status === 200, 'Mark read failed');
    assert(markReadData.data.isRead === true, 'isRead should be true');

    // Idempotent second call
    const markReadAgainRes = await fetch(`${BASE_URL}/api/v1/notifications/${targetNotifId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert(markReadAgainRes.status === 200);
    console.log('✔ Test 9: Single notification mark-as-read and repeated idempotent calls verified.');

    // ----------------------------------------------------
    // Test 10: Unauthorized Modification of Another User's Notification
    // ----------------------------------------------------
    // Outsider attempts to mark Member's notification as read
    const hackNotifRes = await fetch(`${BASE_URL}/api/v1/notifications/${targetNotifId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    assert(
      hackNotifRes.status === 403 || hackNotifRes.status === 404,
      `Modifying another user's notification should be forbidden/not found, got ${hackNotifRes.status}`
    );
    console.log('✔ Test 10: Attempts to access or modify another user’s notifications rejected (403/404).');

    // ----------------------------------------------------
    // Test 11: Bulk Mark All as Read
    // ----------------------------------------------------
    const readAllRes = await fetch(`${BASE_URL}/api/v1/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    const readAllData = (await readAllRes.json()) as any;
    assert(readAllRes.status === 200, 'Mark read-all failed');
    assert(readAllData.data.modifiedCount >= 1, 'ModifiedCount should be >= 1');

    const countAfterReadAll = await fetch(`${BASE_URL}/api/v1/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    const countAfterData = (await countAfterReadAll.json()) as any;
    assert(countAfterData.data.unreadCount === 0, 'Unread count should be 0 after read-all');
    console.log('✔ Test 11: Bulk mark-all-as-read succeeded; unreadCount successfully reset to 0.');

    // ----------------------------------------------------
    // Test 12: Project Activity History Feed & Pagination
    // ----------------------------------------------------
    const activityRes = await fetch(`${BASE_URL}/api/v1/projects/${privateProject._id}/activity?limit=10`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    const activityData = (await activityRes.json()) as any;
    assert(activityRes.status === 200, `Get activity logs failed with ${activityRes.status}`);
    assert(Array.isArray(activityData.data.activityLogs), 'activityLogs should be an array');
    assert(activityData.data.activityLogs.length > 0, 'Should have logged activities');

    // Verify deterministic ordering: createdAt DESC
    const logs = activityData.data.activityLogs;
    for (let i = 0; i < logs.length - 1; i++) {
      const current = new Date(logs[i].createdAt).getTime();
      const next = new Date(logs[i + 1].createdAt).getTime();
      assert(current >= next, 'Activity logs must be sorted in reverse-chronological order');
    }

    // Verify populated actor
    assert(logs[0].actor !== null, 'Actor should be populated');
    assert(typeof logs[0].actor.fullName === 'string', 'Actor fullName should exist');
    console.log('✔ Test 12: Project activity history retrieved with populated actors and reverse-chronological order.');

    // ----------------------------------------------------
    // Test 13: Activity History Entity Filter (?entityType=TASK)
    // ----------------------------------------------------
    const taskLogsRes = await fetch(
      `${BASE_URL}/api/v1/projects/${privateProject._id}/activity?entityType=TASK`,
      { headers: { Authorization: `Bearer ${memberToken}` } }
    );
    const taskLogsData = (await taskLogsRes.json()) as any;
    assert(taskLogsRes.status === 200);
    assert(
      taskLogsData.data.activityLogs.every((l: any) => l.entityType === 'TASK'),
      'All filtered activity logs must have entityType: TASK'
    );
    console.log('✔ Test 13: Activity history entityType filtering verified.');

    // ----------------------------------------------------
    // Test 14: Activity History Authorization & Isolation
    // ----------------------------------------------------
    // Outsider on private project activity -> 404
    const outsiderPrivateActivity = await fetch(
      `${BASE_URL}/api/v1/projects/${privateProject._id}/activity`,
      { headers: { Authorization: `Bearer ${outsiderToken}` } }
    );
    assert(
      outsiderPrivateActivity.status === 404,
      `Outsider on private project activity should get 404, got ${outsiderPrivateActivity.status}`
    );

    // Outsider on public project activity -> 403 (Spec 3.2 line 84: Non-members cannot view activity logs)
    // Note: outsiderUser is now a member of publicProject after Test 4 approval, so create a brand new outsider
    const nonMemberUser = await User.create({
      email: 'brandnewoutsider@phase7-test.com',
      fullName: 'Brand New Outsider',
      passwordHash: pwdHash,
      globalRole: 'USER',
      isActive: true,
    });
    const nonMemberToken = signToken({
      userId: nonMemberUser._id.toString(),
      email: nonMemberUser.email,
      globalRole: 'USER',
    });

    const nonMemberPublicActivity = await fetch(
      `${BASE_URL}/api/v1/projects/${publicProject._id}/activity`,
      { headers: { Authorization: `Bearer ${nonMemberToken}` } }
    );
    assert(
      nonMemberPublicActivity.status === 403,
      `Non-member accessing public project activity must receive 403, got ${nonMemberPublicActivity.status}`
    );
    console.log('✔ Test 14: Activity history authorization enforced (404 on private, 403 on public).');

    // ----------------------------------------------------
    // Test 15: Baseline System Health
    // ----------------------------------------------------
    const healthRes = await fetch(`${BASE_URL}/api/v1/health`);
    assert(healthRes.status === 200, `Health check failed with ${healthRes.status}`);
    const healthData = (await healthRes.json()) as any;
    assert(
      healthData.data.services.database.status === 'connected',
      'Database should report connected'
    );
    console.log('✔ Test 15: Baseline system health verified.');

    console.log('\n====================================================');
    console.log('All Phase 7 verification tests PASSED successfully!');
    console.log('====================================================\n');
  } finally {
    for (const sock of activeSockets) {
      if (sock.connected) {
        sock.disconnect();
      }
    }
    await new Promise<void>((resolve) => {
      io.close(() => {
        resolve();
      });
    });

    // Scoped cleanup in test database
    assertTestDatabaseConnection();
    const cleanupProjects = await Project.find({ key: { $regex: /^P7/ } }, '_id');
    const cleanupProjectIds = cleanupProjects.map((p) => p._id);
    const cleanupUsers = await User.find({ email: { $regex: /@phase7-test\.com$/ } }, '_id');
    const cleanupUserIds = cleanupUsers.map((u) => u._id);

    if (cleanupProjectIds.length > 0 || cleanupUserIds.length > 0) {
      await ProjectMembership.deleteMany({
        $or: [
          { projectId: { $in: cleanupProjectIds } },
          { userId: { $in: cleanupUserIds } },
        ],
      });
      await Task.deleteMany({ projectId: { $in: cleanupProjectIds } });
      await JoinRequest.deleteMany({
        $or: [
          { projectId: { $in: cleanupProjectIds } },
          { userId: { $in: cleanupUserIds } },
        ],
      });
      await Notification.deleteMany({ recipientId: { $in: cleanupUserIds } });
      await ActivityLog.deleteMany({
        $or: [
          { projectId: { $in: cleanupProjectIds } },
          { actorId: { $in: cleanupUserIds } },
        ],
      });
    }
    await Project.deleteMany({ key: { $regex: /^P7/ } });
    await User.deleteMany({ email: { $regex: /@phase7-test\.com$/ } });

    await disconnectDatabase();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Phase 7 Verification failed:', err);
  process.exit(1);
});
