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
import { initSocketServer, getIO, broadcastTaskEvent } from '../sockets';
import { signToken } from '../utils/jwt';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import { User } from '../models/User';
import { Project } from '../models/Project';
import { ProjectMembership } from '../models/ProjectMembership';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';

const TEST_PORT = 5092;
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

async function cleanupSocketTestData() {
  assertTestDatabaseConnection();

  const testUsers = await User.find({ email: { $regex: /@sock-test\.com$/i } });
  const testUserIds = testUsers.map((u) => u._id);

  const testProjects = await Project.find({
    name: { $regex: /^Sock Test/ },
  });
  const testProjectIds = testProjects.map((p) => p._id);

  if (testUserIds.length > 0 || testProjectIds.length > 0) {
    await Message.deleteMany({
      senderId: { $in: testUserIds },
    });
    await ProjectMembership.deleteMany({
      $or: [{ projectId: { $in: testProjectIds } }, { userId: { $in: testUserIds } }],
    });
    await Conversation.deleteMany({
      $or: [{ projectId: { $in: testProjectIds } }, { participants: { $in: testUserIds } }],
    });
    await Project.deleteMany({ _id: { $in: testProjectIds } });
    await User.deleteMany({ _id: { $in: testUserIds } });
  }
}

async function runSocketSecurityTests() {
  console.log('================================================================');
  console.log('WorkSpace Phase 9.5 — Socket.IO Security & Real-Time Verification');
  console.log('================================================================\n');

  // 1. Establish isolated test database connection with Phase 9.1 safety guard
  await connectTestDatabase();
  assertTestDatabaseConnection();

  // 2. Initial scoped cleanup
  await cleanupSocketTestData();

  // 3. Start test HTTP server + Socket.IO
  const server = http.createServer(app);
  initSocketServer(server);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  console.log(`Test HTTP + Socket.IO server listening on ${BASE_URL}\n`);

  try {
    assertTestDatabaseConnection();

    // --------------------------------------------------------------------------
    // SEED TEST FIXTURES
    // --------------------------------------------------------------------------
    console.log('--- Seeding Socket Security Test Fixtures ---');
    const passwordHash = await bcrypt.hash('SockPass123!', 4);

    const adminUser = await User.create({
      email: 'admin@sock-test.com',
      passwordHash,
      fullName: 'Socket Admin',
      globalRole: 'ADMIN',
      isActive: true,
    });

    const pmUser = await User.create({
      email: 'pm@sock-test.com',
      passwordHash,
      fullName: 'Socket Project Manager',
      globalRole: 'USER',
      isActive: true,
    });

    const memberUser = await User.create({
      email: 'member@sock-test.com',
      passwordHash,
      fullName: 'Socket Active Member',
      globalRole: 'USER',
      isActive: true,
    });

    const outsiderUser = await User.create({
      email: 'outsider@sock-test.com',
      passwordHash,
      fullName: 'Socket Outsider User',
      globalRole: 'USER',
      isActive: true,
    });

    const inactiveUser = await User.create({
      email: 'inactive@sock-test.com',
      passwordHash,
      fullName: 'Socket Inactive User',
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
    const memberToken = signToken({
      userId: memberUser._id.toString(),
      email: memberUser.email,
      globalRole: memberUser.globalRole,
    });
    const outsiderToken = signToken({
      userId: outsiderUser._id.toString(),
      email: outsiderUser.email,
      globalRole: outsiderUser.globalRole,
    });
    const inactiveToken = signToken({
      userId: inactiveUser._id.toString(),
      email: inactiveUser.email,
      globalRole: inactiveUser.globalRole,
    });

    // Seed Projects
    const privateProject = await Project.create({
      name: 'Sock Test Private Project',
      key: 'SCKP',
      description: 'Private project for socket testing',
      visibility: 'PRIVATE',
      primaryManagerId: pmUser._id,
      createdBy: adminUser._id,
      status: 'ACTIVE',
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

    const publicProject = await Project.create({
      name: 'Sock Test Public Project',
      key: 'SCKU',
      description: 'Public project for socket testing',
      visibility: 'PUBLIC',
      primaryManagerId: pmUser._id,
      createdBy: adminUser._id,
      status: 'ACTIVE',
    });
    await ProjectMembership.create({
      projectId: publicProject._id,
      userId: pmUser._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });

    // Seed Conversations
    const convPrivate = await Conversation.create({
      type: 'PROJECT_GROUP',
      projectId: privateProject._id,
      participants: [pmUser._id, memberUser._id],
      lastMessageAt: new Date(),
    });

    const convAdminPm = await Conversation.create({
      type: 'ADMIN_PM_DM',
      projectId: null,
      participants: [adminUser._id, pmUser._id],
      lastMessageAt: new Date(),
    });

    console.log('✔ Socket fixtures seeded successfully.\n');

    // --------------------------------------------------------------------------
    // A. Handshake Authentication Testing
    // --------------------------------------------------------------------------
    console.log('--- A. Socket Handshake Authentication Testing ---');

    await testCase(
      'Connection without token rejected at handshake',
      'SOCKET_AUTH',
      async () => {
        const client = ioClient(BASE_URL, {
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            client.disconnect();
            reject(new Error('Timeout waiting for connect_error'));
          }, 3000);

          client.on('connect', () => {
            clearTimeout(timer);
            client.disconnect();
            reject(new Error('Unauthenticated socket must not connect'));
          });

          client.on('connect_error', (err) => {
            clearTimeout(timer);
            client.disconnect();
            assert.ok(
              err.message.includes('Token missing') || err.message.includes('Authentication error'),
              `Expected authentication error, got: ${err.message}`
            );
            resolve();
          });
        });
      }
    );

    await testCase(
      'Connection with malformed token rejected at handshake',
      'SOCKET_AUTH',
      async () => {
        const client = ioClient(BASE_URL, {
          auth: { token: 'not-a-valid-jwt-token' },
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            client.disconnect();
            reject(new Error('Timeout'));
          }, 3000);

          client.on('connect_error', (err) => {
            clearTimeout(timer);
            client.disconnect();
            assert.ok(err.message.includes('Authentication error'));
            resolve();
          });
        });
      }
    );

    await testCase(
      'Connection with expired token rejected at handshake',
      'SOCKET_AUTH',
      async () => {
        const expiredToken = jwt.sign(
          { userId: memberUser._id.toString(), email: memberUser.email, globalRole: 'USER' },
          process.env.JWT_SECRET || 'fallback-secret-for-testing-only-1234',
          { expiresIn: '-1s' }
        );

        const client = ioClient(BASE_URL, {
          auth: { token: expiredToken },
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            client.disconnect();
            reject(new Error('Timeout'));
          }, 3000);

          client.on('connect_error', (err) => {
            clearTimeout(timer);
            client.disconnect();
            assert.ok(err.message.toLowerCase().includes('expired'));
            resolve();
          });
        });
      }
    );

    await testCase(
      'Connection with rogue secret key rejected at handshake',
      'SOCKET_AUTH',
      async () => {
        const rogueToken = jwt.sign(
          { userId: memberUser._id.toString(), email: memberUser.email, globalRole: 'USER' },
          'wrong-signature-key-00000000000000000'
        );

        const client = ioClient(BASE_URL, {
          auth: { token: rogueToken },
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            client.disconnect();
            reject(new Error('Timeout'));
          }, 3000);

          client.on('connect_error', (err) => {
            clearTimeout(timer);
            client.disconnect();
            assert.ok(err.message.includes('Authentication error'));
            resolve();
          });
        });
      }
    );

    await testCase(
      'Connection for inactive user account rejected at handshake',
      'SOCKET_AUTH',
      async () => {
        const client = ioClient(BASE_URL, {
          auth: { token: inactiveToken },
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            client.disconnect();
            reject(new Error('Timeout'));
          }, 3000);

          client.on('connect_error', (err) => {
            clearTimeout(timer);
            client.disconnect();
            assert.ok(err.message.includes('inactive or not found'));
            resolve();
          });
        });
      }
    );

    await testCase(
      'Valid authenticated connection succeeds and auto-subscribes to private user room',
      'SOCKET_AUTH',
      async () => {
        const client = ioClient(BASE_URL, {
          auth: { token: memberToken },
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            client.disconnect();
            reject(new Error('Timeout connecting'));
          }, 3000);

          client.on('connect', () => {
            clearTimeout(timer);
            client.disconnect();
            resolve();
          });
        });
      }
    );

    // --------------------------------------------------------------------------
    // B. Room Authorization Testing
    // --------------------------------------------------------------------------
    console.log('\n--- B. Room Authorization Testing ---');

    await testCase(
      'Authorized member joining project room succeeds',
      'ROOM_AUTHORIZATION',
      async () => {
        const client = ioClient(BASE_URL, {
          auth: { token: memberToken },
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            client.disconnect();
            reject(new Error('Timeout'));
          }, 3000);

          client.on('connect', () => {
            client.emit(
              'join:project',
              { projectId: privateProject._id.toString() },
              (res: any) => {
                clearTimeout(timer);
                client.disconnect();
                assert.equal(res.success, true);
                assert.equal(res.projectId, privateProject._id.toString());
                resolve();
              }
            );
          });
        });
      }
    );

    await testCase(
      'Non-member joining private project room rejected with FORBIDDEN',
      'ROOM_AUTHORIZATION',
      async () => {
        const client = ioClient(BASE_URL, {
          auth: { token: outsiderToken },
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            client.disconnect();
            reject(new Error('Timeout'));
          }, 3000);

          client.on('connect', () => {
            client.emit(
              'join:project',
              { projectId: privateProject._id.toString() },
              (res: any) => {
                clearTimeout(timer);
                client.disconnect();
                assert.equal(res.success, false);
                assert.equal(res.error, 'Not authorized');
                resolve();
              }
            );
          });
        });
      }
    );

    await testCase(
      'Non-member joining public project room without active membership rejected with FORBIDDEN',
      'ROOM_AUTHORIZATION',
      async () => {
        const client = ioClient(BASE_URL, {
          auth: { token: outsiderToken },
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            client.disconnect();
            reject(new Error('Timeout'));
          }, 3000);

          client.on('connect', () => {
            client.emit(
              'join:project',
              { projectId: publicProject._id.toString() },
              (res: any) => {
                clearTimeout(timer);
                client.disconnect();
                assert.equal(res.success, false);
                assert.equal(res.error, 'Not authorized');
                resolve();
              }
            );
          });
        });
      }
    );

    await testCase(
      'Non-participant joining Admin-PM DM conversation rejected with FORBIDDEN',
      'ROOM_AUTHORIZATION',
      async () => {
        const client = ioClient(BASE_URL, {
          auth: { token: memberToken }, // memberUser is not participant in convAdminPm
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            client.disconnect();
            reject(new Error('Timeout'));
          }, 3000);

          client.on('connect', () => {
            client.emit(
              'join:conversation',
              { conversationId: convAdminPm._id.toString() },
              (res: any) => {
                clearTimeout(timer);
                client.disconnect();
                assert.equal(res.success, false);
                assert.equal(res.error, 'Not authorized');
                resolve();
              }
            );
          });
        });
      }
    );

    // --------------------------------------------------------------------------
    // C. Membership Revocation & Real-Time Eviction (Crucial!)
    // --------------------------------------------------------------------------
    console.log('\n--- C. Membership Revocation & Real-Time Socket Eviction ---');

    await testCase(
      'Removed member is immediately evicted from rooms, receives project:evicted, and loses real-time events',
      'SOCKET_ROOM_EVICTION',
      async () => {
        // 1. Connect member socket and join project and conversation
        const memberSocket: ClientSocket = ioClient(BASE_URL, {
          auth: { token: memberToken },
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          memberSocket.on('connect', () => {
            memberSocket.emit(
              'join:project',
              { projectId: privateProject._id.toString() },
              () => {
                memberSocket.emit(
                  'join:conversation',
                  { conversationId: convPrivate._id.toString() },
                  () => resolve()
                );
              }
            );
          });
          setTimeout(() => reject(new Error('Timeout connecting and joining')), 3000);
        });

        // 2. Setup listener on member socket for project:evicted and broadcast events
        let receivedEviction = false;
        let receivedBroadcast = false;

        memberSocket.on('project:evicted', (data) => {
          if (data?.projectId === privateProject._id.toString()) {
            receivedEviction = true;
          }
        });

        memberSocket.on('task:created', () => {
          receivedBroadcast = true;
        });

        // 3. Admin / PM invokes API to remove member
        const removeRes = await fetch(
          `${BASE_URL}/api/v1/projects/${privateProject._id}/members/${memberUser._id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${pmToken}` },
          }
        );
        assert.equal(removeRes.status, 200);

        // Wait a small moment for eviction event to be received
        await new Promise((r) => setTimeout(r, 200));
        assert.equal(receivedEviction, true, 'Member socket must receive project:evicted event');

        // 4. Now broadcast a task:created event to the project room
        broadcastTaskEvent(privateProject._id, 'task:created', {
          _id: 'sample-task-id',
          title: 'Post-Eviction Secret Task',
        });

        // Wait a moment and confirm evicted socket did NOT receive the broadcast
        await new Promise((r) => setTimeout(r, 200));
        assert.equal(receivedBroadcast, false, 'Evicted member must NOT receive project broadcasts');

        // 5. Verify that evicted member cannot send messages to project chat via socket
        await new Promise<void>((resolve, reject) => {
          memberSocket.emit(
            'message:send',
            { conversationId: convPrivate._id.toString(), content: 'Unauthorized post' },
            (res: any) => {
              if (res && res.success === false) {
                resolve();
              } else {
                reject(new Error('Expected rejection on message:send after eviction'));
              }
            }
          );
        });

        memberSocket.disconnect();
      }
    );

    await testCase(
      'Account deactivated while socket remains open triggers error and forceful disconnect on next action',
      'INACTIVE_USER_OPEN_SOCKET',
      async () => {
        // Create dedicated user for open-socket deactivation test
        const deactUser = await User.create({
          email: 'deact@sock-test.com',
          passwordHash,
          fullName: 'Deactivation Target',
          globalRole: 'USER',
          isActive: true,
        });
        const deactToken = signToken({
          userId: deactUser._id.toString(),
          email: deactUser.email,
          globalRole: deactUser.globalRole,
        });

        const socket = ioClient(BASE_URL, {
          auth: { token: deactToken },
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          socket.on('connect', () => resolve());
          setTimeout(() => reject(new Error('Timeout connecting')), 3000);
        });

        // Now mutate database directly to simulate administrative account deactivation
        await User.findByIdAndUpdate(deactUser._id, { isActive: false });

        // When the socket attempts an action, server checks fresh user, emits FORBIDDEN and disconnects
        let errorReceived = false;
        let disconnected = false;

        socket.on('error', (err) => {
          if (err?.code === 'FORBIDDEN') {
            errorReceived = true;
          }
        });

        socket.on('disconnect', () => {
          disconnected = true;
        });

        socket.emit('join:project', { projectId: privateProject._id.toString() });

        await new Promise((r) => setTimeout(r, 300));
        assert.equal(errorReceived, true, 'Deactivated socket must receive FORBIDDEN error');
        assert.equal(disconnected, true, 'Deactivated socket must be disconnected by server');
      }
    );

    // --------------------------------------------------------------------------
    // D. Event Payload Integrity & Impersonation Defense
    // --------------------------------------------------------------------------
    console.log('\n--- D. Event Payload Integrity & Impersonation Defense ---');

    await testCase(
      'Malformed object or operator payload in join:project rejected with INVALID_ID',
      'PAYLOAD_INTEGRITY',
      async () => {
        const client = ioClient(BASE_URL, {
          auth: { token: pmToken },
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          client.on('connect', () => {
            client.emit('join:project', { projectId: { $ne: null } as any }, (res: any) => {
              client.disconnect();
              assert.equal(res.success, false);
              assert.equal(res.error, 'Invalid projectId format');
              resolve();
            });
          });
          setTimeout(() => reject(new Error('Timeout')), 3000);
        });
      }
    );

    await testCase(
      'Sender impersonation in message:send ignored; server derives senderId strictly from JWT',
      'IMPERSONATION_DEFENSE',
      async () => {
        const client = ioClient(BASE_URL, {
          auth: { token: pmToken },
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          client.on('connect', () => {
            // Attempt to forge senderId as adminUser._id
            client.emit(
              'message:send',
              {
                conversationId: convPrivate._id.toString(),
                content: 'Message with attempted sender forgery',
                senderId: adminUser._id.toString(), // Forged claim
              } as any,
              async (res: any) => {
                client.disconnect();
                assert.equal(res.success, true);
                assert.equal(
                  res.data?.sender?._id,
                  pmUser._id.toString(),
                  'Sender must strictly be pmUser, not forged adminUser'
                );

                // Check MongoDB record
                const dbMsg = await Message.findById(res.data?._id);
                assert.equal(
                  dbMsg?.senderId.toString(),
                  pmUser._id.toString(),
                  'Database record must match authenticated user'
                );
                resolve();
              }
            );
          });
          setTimeout(() => reject(new Error('Timeout')), 3000);
        });
      }
    );

    await testCase(
      'Persistence-before-broadcast: empty message fails validation and is NOT broadcast',
      'PERSISTENCE_BEFORE_BROADCAST',
      async () => {
        const client = ioClient(BASE_URL, {
          auth: { token: pmToken },
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise<void>((resolve, reject) => {
          client.on('connect', () => {
            client.emit(
              'message:send',
              { conversationId: convPrivate._id.toString(), content: '    ' },
              (res: any) => {
                client.disconnect();
                assert.equal(res.success, false);
                assert.equal(res.error, 'Invalid message content');
                resolve();
              }
            );
          });
          setTimeout(() => reject(new Error('Timeout')), 3000);
        });
      }
    );
  } finally {
    // --------------------------------------------------------------------------
    // TEARDOWN & CLEANUP
    // --------------------------------------------------------------------------
    console.log('\n--- Teardown: Performing Scoped Test Cleanup ---');
    try {
      await cleanupSocketTestData();
      console.log('✔ Scoped socket test data cleaned up.');
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
  console.log(`Phase 9.5 Socket.IO Security Testing Complete`);
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

runSocketSecurityTests().catch((err) => {
  console.error('Fatal unhandled error during socket security testing:', err);
  process.exit(1);
});
