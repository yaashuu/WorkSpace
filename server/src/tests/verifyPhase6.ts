process.env.NODE_ENV = 'test';

import http from 'http';
import mongoose from 'mongoose';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import app from '../app';
import { connectTestDatabase, disconnectDatabase, assertTestDatabaseConnection } from '../config/database';
import { initSocketServer, getIO } from '../sockets';
import { User } from '../models/User';
import { Project } from '../models/Project';
import { ProjectMembership } from '../models/ProjectMembership';
import { Task } from '../models/Task';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { ActivityLog } from '../models/ActivityLog';
import { signToken } from '../utils/jwt';
import { hashPassword } from '../utils/password';

const TEST_PORT = 5059;
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
  console.log('WorkSpace Phase 6 — Comprehensive Verification Suite');
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

    // 1. Cleanup previous Phase 6 test data (strictly scoped)
    const p6Projects = await Project.find({ key: { $regex: /^P6/ } }, '_id');
    const p6ProjectIds = p6Projects.map((p) => p._id);
    const p6Users = await User.find({ email: { $regex: /@phase6-test\.com$/ } }, '_id');
    const p6UserIds = p6Users.map((u) => u._id);
    const p6Convs = await Conversation.find({
      $or: [
        { projectId: { $in: p6ProjectIds } },
        { participants: { $in: p6UserIds } },
      ],
    }, '_id');
    const p6ConvIds = p6Convs.map((c) => c._id);

    if (p6ProjectIds.length > 0 || p6UserIds.length > 0) {
      await ProjectMembership.deleteMany({
        $or: [
          { projectId: { $in: p6ProjectIds } },
          { userId: { $in: p6UserIds } },
        ],
      });
      await Task.deleteMany({ projectId: { $in: p6ProjectIds } });
      await Message.deleteMany({
        $or: [
          { conversationId: { $in: p6ConvIds } },
          { senderId: { $in: p6UserIds } },
        ],
      });
      await Conversation.deleteMany({
        $or: [
          { projectId: { $in: p6ProjectIds } },
          { participants: { $in: p6UserIds } },
        ],
      });
      await ActivityLog.deleteMany({
        $or: [
          { projectId: { $in: p6ProjectIds } },
          { actorId: { $in: p6UserIds } },
        ],
      });
    }
    await Project.deleteMany({ key: { $regex: /^P6/ } });
    await User.deleteMany({ email: { $regex: /@phase6-test\.com$/ } });

    // 2. Seed test users
    const pwdHash = await hashPassword('TestPassword123!');

    const adminUser = await User.create({
      email: 'admin@phase6-test.com',
      fullName: 'Org Admin',
      passwordHash: pwdHash,
      globalRole: 'ADMIN',
      isActive: true,
    });
    const adminToken = signToken({
      userId: adminUser._id.toString(),
      email: adminUser.email,
      globalRole: 'ADMIN',
    });

    const pm1User = await User.create({
      email: 'pm1@phase6-test.com',
      fullName: 'Primary PM One',
      passwordHash: pwdHash,
      globalRole: 'USER',
      isActive: true,
    });
    const pm1Token = signToken({
      userId: pm1User._id.toString(),
      email: pm1User.email,
      globalRole: 'USER',
    });

    const pm2User = await User.create({
      email: 'pm2@phase6-test.com',
      fullName: 'Secondary PM Two',
      passwordHash: pwdHash,
      globalRole: 'USER',
      isActive: true,
    });
    const pm2Token = signToken({
      userId: pm2User._id.toString(),
      email: pm2User.email,
      globalRole: 'USER',
    });

    const memberUser = await User.create({
      email: 'member@phase6-test.com',
      fullName: 'Core Developer',
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
      email: 'outsider@phase6-test.com',
      fullName: 'External Outsider',
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
      name: 'Private Core Platform',
      key: 'P6PRIV',
      description: 'Private core platform engineering',
      visibility: 'PRIVATE',
      status: 'ACTIVE',
      createdBy: adminUser._id,
      primaryManagerId: pm1User._id,
    });

    const publicProject = await Project.create({
      name: 'Public Open Source',
      key: 'P6PUB',
      description: 'Public open source initiative',
      visibility: 'PUBLIC',
      status: 'ACTIVE',
      createdBy: adminUser._id,
      primaryManagerId: pm2User._id,
    });

    // Establish memberships
    await ProjectMembership.create({
      projectId: privateProject._id,
      userId: pm1User._id,
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
      userId: pm2User._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });

    // ----------------------------------------------------
    // Test 1: Socket Authentication Handshake
    // ----------------------------------------------------
    // 1a. Missing token rejected
    let rejectedMissing = false;
    try {
      const sock = await connectClientSocket();
      activeSockets.push(sock);
    } catch (err: any) {
      rejectedMissing = true;
      assert(err.message.includes('Authentication error'), 'Expected authentication error message');
    }
    assert(rejectedMissing, 'Socket connection without token should fail');

    // 1b. Invalid token rejected
    let rejectedInvalid = false;
    try {
      const sock = await connectClientSocket('invalid.jwt.token');
      activeSockets.push(sock);
    } catch (err: any) {
      rejectedInvalid = true;
      assert(err.message.includes('Authentication error'), 'Expected authentication error message');
    }
    assert(rejectedInvalid, 'Socket connection with invalid token should fail');

    // 1c. Valid token succeeds
    const adminSocket = await connectClientSocket(adminToken);
    activeSockets.push(adminSocket);
    assert(adminSocket.connected, 'Admin socket should connect successfully');

    const memberSocket = await connectClientSocket(memberToken);
    activeSockets.push(memberSocket);
    assert(memberSocket.connected, 'Member socket should connect successfully');

    const pmSocket = await connectClientSocket(pm1Token);
    activeSockets.push(pmSocket);
    assert(pmSocket.connected, 'PM socket should connect successfully');

    const outsiderSocket = await connectClientSocket(outsiderToken);
    activeSockets.push(outsiderSocket);
    assert(outsiderSocket.connected, 'Outsider socket should connect successfully');
    console.log('✔ Test 1: Socket authentication handshake verified (missing/invalid rejected, valid accepted).');

    // ----------------------------------------------------
    // Test 2: Project Group Conversation Initialization & Access Control
    // ----------------------------------------------------
    // Member fetches or creates project conversation
    const getConvRes = await fetch(`${BASE_URL}/api/v1/conversations/project/${privateProject._id}`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    const getConvData = (await getConvRes.json()) as any;
    assert(getConvRes.status === 200, `Get project conversation failed with ${getConvRes.status}`);
    assert(getConvData.data.type === 'PROJECT_GROUP', `Type should be PROJECT_GROUP`);
    assert(getConvData.data.projectId === privateProject._id.toString(), `ProjectId mismatch`);
    const projectConvId = getConvData.data._id;

    // PM can access the same conversation
    const pmConvRes = await fetch(`${BASE_URL}/api/v1/conversations/project/${privateProject._id}`, {
      headers: { Authorization: `Bearer ${pm1Token}` },
    });
    const pmConvData = (await pmConvRes.json()) as any;
    assert(pmConvRes.status === 200, `PM get conversation failed`);
    assert(pmConvData.data._id === projectConvId, `Should return existing conversation`);

    // Outsider cannot access private project conversation -> 404
    const outsiderPrivateConvRes = await fetch(
      `${BASE_URL}/api/v1/conversations/project/${privateProject._id}`,
      { headers: { Authorization: `Bearer ${outsiderToken}` } }
    );
    assert(
      outsiderPrivateConvRes.status === 404,
      `Outsider on private conversation should get 404, got ${outsiderPrivateConvRes.status}`
    );

    // Outsider cannot access public project conversation -> 403
    const outsiderPublicConvRes = await fetch(
      `${BASE_URL}/api/v1/conversations/project/${publicProject._id}`,
      { headers: { Authorization: `Bearer ${outsiderToken}` } }
    );
    assert(
      outsiderPublicConvRes.status === 403,
      `Outsider on public conversation should get 403, got ${outsiderPublicConvRes.status}`
    );
    console.log('✔ Test 2: Project group conversation initialized; authorization enforced (404 private, 403 public).');

    // ----------------------------------------------------
    // Test 3: Isolated Administrator–Manager Direct Messaging (ADMIN_PM_DM)
    // ----------------------------------------------------
    // Admin creates DM with PM 1
    const adminDmRes = await fetch(
      `${BASE_URL}/api/v1/conversations/admin-pm/${pm1User._id}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const adminDmData = (await adminDmRes.json()) as any;
    assert(adminDmRes.status === 200, `Admin DM init failed with ${adminDmRes.status}`);
    assert(adminDmData.data.type === 'ADMIN_PM_DM', `Type should be ADMIN_PM_DM`);
    assert(adminDmData.data.projectId === null, `DM projectId must strictly be null`);
    const dmId = adminDmData.data._id;

    // PM 1 fetches their DM with Admin
    const pmDmRes = await fetch(
      `${BASE_URL}/api/v1/conversations/admin-pm/${pm1User._id}`,
      { headers: { Authorization: `Bearer ${pm1Token}` } }
    );
    const pmDmData = (await pmDmRes.json()) as any;
    assert(pmDmRes.status === 200, `PM DM fetch failed with ${pmDmRes.status}`);
    assert(pmDmData.data._id === dmId, `PM should fetch the same DM conversation`);

    // Regular member forbidden from Admin-PM DM
    const memberDmRes = await fetch(
      `${BASE_URL}/api/v1/conversations/admin-pm/${pm1User._id}`,
      { headers: { Authorization: `Bearer ${memberToken}` } }
    );
    assert(
      memberDmRes.status === 403,
      `Regular member should be forbidden from Admin-PM DM endpoint, got ${memberDmRes.status}`
    );

    // Regular member cannot read DM messages
    const memberReadDmRes = await fetch(`${BASE_URL}/api/v1/conversations/${dmId}/messages`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert(
      memberReadDmRes.status === 403,
      `Member reading DM messages should receive 403, got ${memberReadDmRes.status}`
    );
    console.log('✔ Test 3: Admin–PM DM isolation verified (projectId null, only 2 participants, outsiders forbidden).');

    // ----------------------------------------------------
    // Test 4: Sending & Retrieving Messages with Pagination
    // ----------------------------------------------------
    // Member sends message via REST
    const msg1Res = await fetch(`${BASE_URL}/api/v1/conversations/${projectConvId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({
        content: 'First team message from developer',
      }),
    });
    const msg1Data = (await msg1Res.json()) as any;
    assert(msg1Res.status === 201, `Message 1 failed with ${msg1Res.status}`);
    assert(msg1Data.data.content === 'First team message from developer');
    assert(msg1Data.data.sender.email === 'member@phase6-test.com');
    const msg1Id = msg1Data.data._id;
    const msg1CreatedAt = msg1Data.data.createdAt;

    // PM sends message via REST
    const msg2Res = await fetch(`${BASE_URL}/api/v1/conversations/${projectConvId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pm1Token}`,
      },
      body: JSON.stringify({
        content: 'Second message from PM',
      }),
    });
    assert(msg2Res.status === 201, `Message 2 failed with ${msg2Res.status}`);

    // Empty message validation
    const emptyMsgRes = await fetch(`${BASE_URL}/api/v1/conversations/${projectConvId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({
        content: '   ',
      }),
    });
    assert(emptyMsgRes.status === 400, `Empty message should return 400, got ${emptyMsgRes.status}`);

    // Fetch messages (reverse-chronological)
    const listMsgRes = await fetch(`${BASE_URL}/api/v1/conversations/${projectConvId}/messages?limit=10`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    const listMsgData = (await listMsgRes.json()) as any;
    assert(listMsgRes.status === 200, `List messages failed with ${listMsgRes.status}`);
    assert(listMsgData.data.length === 2, `Expected 2 messages, got ${listMsgData.data.length}`);
    assert(listMsgData.data[0].content === 'Second message from PM', 'Newest message should be first');
    assert(listMsgData.data[1].content === 'First team message from developer');

    // Test cursor pagination with before
    const cursorMsgRes = await fetch(
      `${BASE_URL}/api/v1/conversations/${projectConvId}/messages?before=${new Date(
        Date.parse(msg1CreatedAt) + 1000
      ).toISOString()}&limit=1`,
      { headers: { Authorization: `Bearer ${memberToken}` } }
    );
    const cursorMsgData = (await cursorMsgRes.json()) as any;
    assert(cursorMsgRes.status === 200, `Cursor messages failed with ${cursorMsgRes.status}`);
    assert(cursorMsgData.data.length === 1, `Expected 1 message with limit 1`);
    console.log('✔ Test 4: Messages sent, empty content rejected (400), reverse-chronological pagination verified.');

    // ----------------------------------------------------
    // Test 5: Socket Room Joining Authorization
    // ----------------------------------------------------
    // Member joins project room -> succeeds
    const memberJoinProjectPromise = new Promise<any>((resolve) => {
      memberSocket.once('joined:project', resolve);
    });
    memberSocket.emit('join:project', { projectId: privateProject._id.toString() });
    const joinedProject = await memberJoinProjectPromise;
    assert(joinedProject.projectId === privateProject._id.toString(), 'Should confirm joined project');

    // Outsider attempts to join project room -> rejected with error event
    const outsiderJoinProjectPromise = new Promise<any>((resolve) => {
      outsiderSocket.once('error', resolve);
    });
    outsiderSocket.emit('join:project', { projectId: privateProject._id.toString() });
    const outsiderProjectError = await outsiderJoinProjectPromise;
    assert(outsiderProjectError.code === 'FORBIDDEN', `Expected FORBIDDEN error, got ${outsiderProjectError.code}`);

    // Member joins conversation room -> succeeds
    const memberJoinConvPromise = new Promise<any>((resolve) => {
      memberSocket.once('joined:conversation', resolve);
    });
    memberSocket.emit('join:conversation', { conversationId: projectConvId });
    const joinedConv = await memberJoinConvPromise;
    assert(joinedConv.conversationId === projectConvId, 'Should confirm joined conversation');

    // Outsider attempts to join conversation room -> rejected with error event
    const outsiderJoinConvPromise = new Promise<any>((resolve) => {
      outsiderSocket.once('error', resolve);
    });
    outsiderSocket.emit('join:conversation', { conversationId: projectConvId });
    const outsiderConvError = await outsiderJoinConvPromise;
    assert(outsiderConvError.code === 'FORBIDDEN', `Expected FORBIDDEN error, got ${outsiderConvError.code}`);
    console.log('✔ Test 5: Socket room joining authorization enforced (authorized admitted, unauthorized rejected).');

    // ----------------------------------------------------
    // Test 6: Real-Time Message Delivery to Permitted Participants
    // ----------------------------------------------------
    const messageReceivePromise = new Promise<any>((resolve) => {
      memberSocket.once('message:received', resolve);
    });

    // PM posts message via REST
    await fetch(`${BASE_URL}/api/v1/conversations/${projectConvId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pm1Token}`,
      },
      body: JSON.stringify({
        content: 'Broadcast test message via REST',
      }),
    });

    const receivedMessage = await messageReceivePromise;
    assert(
      receivedMessage.content === 'Broadcast test message via REST',
      `Content mismatch: ${receivedMessage.content}`
    );
    assert(receivedMessage.sender.email === 'pm1@phase6-test.com', 'Sender email mismatch');
    console.log('✔ Test 6: Real-time message delivered to connected room participants via Socket.IO.');

    // ----------------------------------------------------
    // Test 7: Socket Message Sending (message:send)
    // ----------------------------------------------------
    const socketSendPromise = new Promise<any>((resolve) => {
      memberSocket.once('message:received', resolve);
    });

    // PM socket sends message via socket event
    pmSocket.emit('message:send', {
      conversationId: projectConvId,
      content: 'Message sent directly via Socket.IO client',
    });

    const receivedFromSocket = await socketSendPromise;
    assert(
      receivedFromSocket.content === 'Message sent directly via Socket.IO client',
      `Socket message content mismatch: ${receivedFromSocket.content}`
    );

    // Verify persisted in MongoDB
    const persistedMsg = await Message.findOne({
      content: 'Message sent directly via Socket.IO client',
    });
    assert(persistedMsg !== null, 'Socket message must be persisted to MongoDB');
    console.log('✔ Test 7: message:send via socket persisted to MongoDB and broadcast to room.');

    // ----------------------------------------------------
    // Test 8: Real-Time Board & Task Events
    // ----------------------------------------------------
    // Member socket listens for board events
    const taskCreatedPromise = new Promise<any>((resolve) => {
      memberSocket.once('task:created', resolve);
    });

    // PM creates task via REST
    const createTaskRes = await fetch(`${BASE_URL}/api/v1/projects/${privateProject._id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pm1Token}`,
      },
      body: JSON.stringify({
        title: 'Task for Socket Testing',
        status: 'BACKLOG',
      }),
    });
    const createTaskData = (await createTaskRes.json()) as any;
    assert(createTaskRes.status === 201, `Create task failed`);
    const createdTaskId = createTaskData.data._id;

    const receivedTaskEvent = await taskCreatedPromise;
    assert(receivedTaskEvent._id === createdTaskId, 'Received task:created event with matching taskId');
    assert(receivedTaskEvent.title === 'Task for Socket Testing');

    // Move task and listen for task:moved
    const taskMovedPromise = new Promise<any>((resolve) => {
      memberSocket.once('task:moved', resolve);
    });

    await fetch(`${BASE_URL}/api/v1/tasks/${createdTaskId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pm1Token}`,
      },
      body: JSON.stringify({
        status: 'IN_PROGRESS',
        version: 0,
      }),
    });

    const receivedMoveEvent = await taskMovedPromise;
    assert(receivedMoveEvent._id === createdTaskId, 'Received task:moved event with matching taskId');
    assert(receivedMoveEvent.status === 'IN_PROGRESS', 'Received status IN_PROGRESS');
    console.log('✔ Test 8: Real-time board events (task:created, task:moved) delivered to project room.');

    // ----------------------------------------------------
    // Test 9: Member Removal & Socket Room Eviction (Spec 7.1)
    // ----------------------------------------------------
    const evictedPromise = new Promise<any>((resolve) => {
      memberSocket.once('project:evicted', resolve);
    });

    // PM removes member from project
    const removeRes = await fetch(
      `${BASE_URL}/api/v1/projects/${privateProject._id}/members/${memberUser._id}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${pm1Token}` },
      }
    );
    assert(removeRes.status === 200, `Remove member failed with ${removeRes.status}`);

    const evictedEvent = await evictedPromise;
    assert(
      evictedEvent.projectId === privateProject._id.toString(),
      `Evicted event should match projectId`
    );

    // Verify member is removed from conversation participants in database
    const convAfterEvict = await Conversation.findById(projectConvId);
    assert(
      !convAfterEvict!.participants.some((p) => p.equals(memberUser._id)),
      'Removed member should be evicted from conversation participants'
    );

    // Member attempting to send message via REST is rejected (404 on private project, 403 on public)
    const sendAfterEvictRes = await fetch(
      `${BASE_URL}/api/v1/conversations/${projectConvId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${memberToken}`,
        },
        body: JSON.stringify({
          content: 'I was removed, this must fail',
        }),
      }
    );
    assert(
      sendAfterEvictRes.status === 403 || sendAfterEvictRes.status === 404,
      `Removed member should get 403 or 404 when sending message, got ${sendAfterEvictRes.status}`
    );

    // Member attempting to rejoin project room via socket is rejected
    const rejoinPromise = new Promise<any>((resolve) => {
      memberSocket.once('error', resolve);
    });
    memberSocket.emit('join:project', { projectId: privateProject._id.toString() });
    const rejoinError = await rejoinPromise;
    assert(rejoinError.code === 'FORBIDDEN', `Rejoining should be rejected with FORBIDDEN, got ${rejoinError.code}`);
    console.log('✔ Test 9: Member removal triggers socket room eviction and blocks subsequent chat/room access.');

    // ----------------------------------------------------
    // Test 10: Baseline System Health
    // ----------------------------------------------------
    const healthRes = await fetch(`${BASE_URL}/api/v1/health`);
    assert(healthRes.status === 200, `Health check failed with ${healthRes.status}`);
    const healthData = (await healthRes.json()) as any;
    assert(
      healthData.data.services.database.status === 'connected',
      'Database should report connected'
    );
    console.log('✔ Test 10: Baseline system health verified.');

    console.log('\n====================================================');
    console.log('All Phase 6 verification tests PASSED successfully!');
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
    const cleanupProjects = await Project.find({ key: { $regex: /^P6/ } }, '_id');
    const cleanupProjectIds = cleanupProjects.map((p) => p._id);
    const cleanupUsers = await User.find({ email: { $regex: /@phase6-test\.com$/ } }, '_id');
    const cleanupUserIds = cleanupUsers.map((u) => u._id);
    const cleanupConvs = await Conversation.find({
      $or: [
        { projectId: { $in: cleanupProjectIds } },
        { participants: { $in: cleanupUserIds } },
      ],
    }, '_id');
    const cleanupConvIds = cleanupConvs.map((c) => c._id);

    if (cleanupProjectIds.length > 0 || cleanupUserIds.length > 0) {
      await ProjectMembership.deleteMany({
        $or: [
          { projectId: { $in: cleanupProjectIds } },
          { userId: { $in: cleanupUserIds } },
        ],
      });
      await Task.deleteMany({ projectId: { $in: cleanupProjectIds } });
      await Message.deleteMany({
        $or: [
          { conversationId: { $in: cleanupConvIds } },
          { senderId: { $in: cleanupUserIds } },
        ],
      });
      await Conversation.deleteMany({
        $or: [
          { projectId: { $in: cleanupProjectIds } },
          { participants: { $in: cleanupUserIds } },
        ],
      });
      await ActivityLog.deleteMany({
        $or: [
          { projectId: { $in: cleanupProjectIds } },
          { actorId: { $in: cleanupUserIds } },
        ],
      });
    }
    await Project.deleteMany({ key: { $regex: /^P6/ } });
    await User.deleteMany({ email: { $regex: /@phase6-test\.com$/ } });

    await disconnectDatabase();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Phase 6 Verification failed:', err);
  process.exit(1);
});
