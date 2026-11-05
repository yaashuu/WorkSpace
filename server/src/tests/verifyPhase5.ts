process.env.NODE_ENV = 'test';

import http from 'http';
import mongoose from 'mongoose';
import app from '../app';
import { connectTestDatabase, disconnectDatabase, assertTestDatabaseConnection } from '../config/database';
import { User } from '../models/User';
import { Project } from '../models/Project';
import { ProjectMembership } from '../models/ProjectMembership';
import { Task, ITask } from '../models/Task';
import { TaskComment } from '../models/TaskComment';
import { ActivityLog } from '../models/ActivityLog';
import { signToken } from '../utils/jwt';
import { hashPassword } from '../utils/password';

const TEST_PORT = 5058;
const BASE_URL = `http://localhost:${TEST_PORT}`;

const assert = (condition: boolean, message: string = 'Assertion failed') => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
};

async function runTests() {
  console.log('====================================================');
  console.log('WorkSpace Phase 5 — Comprehensive Verification Suite');
  console.log('====================================================\n');

  await connectTestDatabase();
  assertTestDatabaseConnection();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  console.log(`Test HTTP server listening on ${BASE_URL}\n`);

  try {
    // Safety guard assertion before any cleanup or mutations
    assertTestDatabaseConnection();

    // 1. Cleanup previous Phase 5 test data (strictly scoped)
    const p5Projects = await Project.find({ key: { $regex: /^P5/ } }, '_id');
    const p5ProjectIds = p5Projects.map((p) => p._id);
    const p5Users = await User.find({ email: { $regex: /@phase5-test\.com$/ } }, '_id');
    const p5UserIds = p5Users.map((u) => u._id);
    const p5Tasks = await Task.find({ projectId: { $in: p5ProjectIds } }, '_id');
    const p5TaskIds = p5Tasks.map((t) => t._id);

    if (p5ProjectIds.length > 0 || p5UserIds.length > 0) {
      await ProjectMembership.deleteMany({
        $or: [
          { projectId: { $in: p5ProjectIds } },
          { userId: { $in: p5UserIds } },
        ],
      });
      await TaskComment.deleteMany({ taskId: { $in: p5TaskIds } });
      await Task.deleteMany({ projectId: { $in: p5ProjectIds } });
      await ActivityLog.deleteMany({
        $or: [
          { projectId: { $in: p5ProjectIds } },
          { actorId: { $in: p5UserIds } },
        ],
      });
    }
    await Project.deleteMany({ key: { $regex: /^P5/ } });
    await User.deleteMany({ email: { $regex: /@phase5-test\.com$/ } });

    // 2. Seed test users
    const pwdHash = await hashPassword('TestPassword123!');

    const adminUser = await User.create({
      email: 'admin@phase5-test.com',
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
      email: 'pm@phase5-test.com',
      fullName: 'Project Manager',
      passwordHash: pwdHash,
      globalRole: 'USER',
      isActive: true,
    });
    const pmToken = signToken({
      userId: pmUser._id.toString(),
      email: pmUser.email,
      globalRole: 'USER',
    });

    const assignedUser = await User.create({
      email: 'assigned@phase5-test.com',
      fullName: 'Assigned Dev',
      passwordHash: pwdHash,
      globalRole: 'USER',
      isActive: true,
    });
    const assignedToken = signToken({
      userId: assignedUser._id.toString(),
      email: assignedUser.email,
      globalRole: 'USER',
    });

    const unassignedUser = await User.create({
      email: 'unassigned@phase5-test.com',
      fullName: 'Unassigned Dev',
      passwordHash: pwdHash,
      globalRole: 'USER',
      isActive: true,
    });
    const unassignedToken = signToken({
      userId: unassignedUser._id.toString(),
      email: unassignedUser.email,
      globalRole: 'USER',
    });

    const outsiderUser = await User.create({
      email: 'outsider@phase5-test.com',
      fullName: 'External User',
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
      key: 'P5PRIV',
      description: 'Private core platform development',
      visibility: 'PRIVATE',
      status: 'ACTIVE',
      createdBy: adminUser._id,
      primaryManagerId: pmUser._id,
    });

    const publicProject = await Project.create({
      name: 'Public Open Source Tools',
      key: 'P5PUB',
      description: 'Public community open source project',
      visibility: 'PUBLIC',
      status: 'ACTIVE',
      createdBy: adminUser._id,
      primaryManagerId: pmUser._id,
    });

    // Establish memberships for private project
    await ProjectMembership.create({
      projectId: privateProject._id,
      userId: pmUser._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });
    await ProjectMembership.create({
      projectId: privateProject._id,
      userId: assignedUser._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });
    await ProjectMembership.create({
      projectId: privateProject._id,
      userId: unassignedUser._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });

    // Establish PM membership for public project
    await ProjectMembership.create({
      projectId: publicProject._id,
      userId: pmUser._id,
      role: 'MEMBER',
      status: 'ACTIVE',
    });

    // ----------------------------------------------------
    // Test 1: Task creation by Admin and PM with default positioning
    // ----------------------------------------------------
    const createRes1 = await fetch(`${BASE_URL}/api/v1/projects/${privateProject._id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmToken}`,
      },
      body: JSON.stringify({
        title: 'Task 1: Setup Architecture',
        description: 'Initial architectural setup',
        status: 'BACKLOG',
        priority: 'HIGH',
        assigneeId: assignedUser._id.toString(),
      }),
    });
    const createData1 = (await createRes1.json()) as any;
    assert(createRes1.status === 201, `PM task creation failed with ${createRes1.status}`);
    assert(createData1.data.position === 1000, `First task position should be 1000, got ${createData1.data.position}`);
    assert(createData1.data.version === 0, `Initial version should be 0, got ${createData1.data.version}`);
    assert(createData1.data.status === 'BACKLOG', `Status should be BACKLOG`);
    assert(createData1.data.assigneeId === assignedUser._id.toString(), `AssigneeId mismatch`);
    const task1Id = createData1.data._id;

    const createRes2 = await fetch(`${BASE_URL}/api/v1/projects/${privateProject._id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Task 2: Setup Database Migrations',
        description: 'DB migrations workflow',
        status: 'BACKLOG',
        priority: 'MEDIUM',
      }),
    });
    const createData2 = (await createRes2.json()) as any;
    assert(createRes2.status === 201, `Admin task creation failed with ${createRes2.status}`);
    assert(createData2.data.position === 2000, `Second task position should be 2000, got ${createData2.data.position}`);
    const task2Id = createData2.data._id;

    const createRes3 = await fetch(`${BASE_URL}/api/v1/projects/${privateProject._id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmToken}`,
      },
      body: JSON.stringify({
        title: 'Task 3: Unit Testing',
        description: 'Core tests implementation',
        status: 'BACKLOG',
        priority: 'LOW',
      }),
    });
    const createData3 = (await createRes3.json()) as any;
    assert(createRes3.status === 201, `Third task creation failed with ${createRes3.status}`);
    assert(createData3.data.position === 3000, `Third task position should be 3000, got ${createData3.data.position}`);
    const task3Id = createData3.data._id;

    // Check activity log
    const taskLogs = await ActivityLog.find({ action: 'TASK_CREATED', projectId: privateProject._id });
    assert(taskLogs.length === 3, `Expected 3 TASK_CREATED logs, got ${taskLogs.length}`);
    console.log('✔ Test 1: Task creation by Admin & PM succeeded with default positioning (1000, 2000, 3000).');

    // ----------------------------------------------------
    // Test 2: Regular employee forbidden from creating tasks
    // ----------------------------------------------------
    const empCreateRes = await fetch(`${BASE_URL}/api/v1/projects/${privateProject._id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${assignedToken}`,
      },
      body: JSON.stringify({
        title: 'Unauthorized Employee Task',
      }),
    });
    assert(empCreateRes.status === 403, `Employee should receive 403 when creating tasks, got ${empCreateRes.status}`);
    console.log('✔ Test 2: Regular employee strictly forbidden from creating tasks (403 FORBIDDEN).');

    // ----------------------------------------------------
    // Test 3: Assignee validation on task creation
    // ----------------------------------------------------
    const invalidAssigneeRes = await fetch(`${BASE_URL}/api/v1/projects/${privateProject._id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmToken}`,
      },
      body: JSON.stringify({
        title: 'Task with non-member assignee',
        assigneeId: outsiderUser._id.toString(), // outsider is not a member of privateProject
      }),
    });
    assert(
      invalidAssigneeRes.status === 400,
      `Assigning non-member should return 400, got ${invalidAssigneeRes.status}`
    );
    const invalidAssigneeData = (await invalidAssigneeRes.json()) as any;
    assert(
      invalidAssigneeData.error.code === 'INVALID_ASSIGNEE',
      `Error code should be INVALID_ASSIGNEE, got ${invalidAssigneeData.error.code}`
    );
    console.log('✔ Test 3: Assigning a non-member cleanly rejected with 400 INVALID_ASSIGNEE.');

    // ----------------------------------------------------
    // Test 4: Non-member access control on private and public projects
    // ----------------------------------------------------
    const outsiderPrivateRes = await fetch(`${BASE_URL}/api/v1/projects/${privateProject._id}/tasks`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    assert(
      outsiderPrivateRes.status === 404,
      `Non-member accessing private project tasks should return 404, got ${outsiderPrivateRes.status}`
    );

    const outsiderTaskRes = await fetch(`${BASE_URL}/api/v1/tasks/${task1Id}`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    assert(
      outsiderTaskRes.status === 404,
      `Non-member accessing private task directly should return 404, got ${outsiderTaskRes.status}`
    );

    const outsiderPublicRes = await fetch(`${BASE_URL}/api/v1/projects/${publicProject._id}/tasks`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    assert(
      outsiderPublicRes.status === 403,
      `Non-member accessing public project tasks should return 403, got ${outsiderPublicRes.status}`
    );
    console.log('✔ Test 4: Non-members forbidden: 404 on private projects, 403 on public projects.');

    // ----------------------------------------------------
    // Test 5: List project tasks deterministically ordered
    // ----------------------------------------------------
    const listRes = await fetch(`${BASE_URL}/api/v1/projects/${privateProject._id}/tasks`, {
      headers: { Authorization: `Bearer ${assignedToken}` },
    });
    const listData = (await listRes.json()) as any;
    assert(listRes.status === 200, `List tasks failed with ${listRes.status}`);
    assert(listData.data.length === 3, `Expected 3 tasks, got ${listData.data.length}`);
    assert(listData.data[0].position === 1000, `First task should have position 1000`);
    assert(listData.data[1].position === 2000, `Second task should have position 2000`);
    assert(listData.data[2].position === 3000, `Third task should have position 3000`);
    // Verified populated assignee
    assert(listData.data[0].assignee !== null, `Assignee should be populated`);
    assert(listData.data[0].assignee.email === 'assigned@phase5-test.com', `Assignee email mismatch`);
    console.log('✔ Test 5: Project tasks listed deterministically ordered by position (1000, 2000, 3000).');

    // ----------------------------------------------------
    // Test 6: Admin and PM updating task details
    // ----------------------------------------------------
    const updateRes = await fetch(`${BASE_URL}/api/v1/tasks/${task1Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmToken}`,
      },
      body: JSON.stringify({
        title: 'Task 1: Updated Architecture Specs',
        priority: 'URGENT',
        description: 'Updated architecture documentation',
      }),
    });
    const updateData = (await updateRes.json()) as any;
    assert(updateRes.status === 200, `Task update failed with ${updateRes.status}`);
    assert(updateData.data.title === 'Task 1: Updated Architecture Specs', `Title not updated`);
    assert(updateData.data.priority === 'URGENT', `Priority not updated`);
    assert(updateData.data.version === 1, `Version should be incremented to 1, got ${updateData.data.version}`);

    const updateLog = await ActivityLog.findOne({ action: 'TASK_UPDATED', entityId: task1Id });
    assert(updateLog !== null, `Expected TASK_UPDATED activity log`);
    console.log('✔ Test 6: PM updated task details; version incremented to 1 and TASK_UPDATED logged.');

    // ----------------------------------------------------
    // Test 7: Regular employee forbidden from updating task details
    // ----------------------------------------------------
    const empUpdateRes = await fetch(`${BASE_URL}/api/v1/tasks/${task1Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${assignedToken}`,
      },
      body: JSON.stringify({
        title: 'Employee Hacked Title',
      }),
    });
    assert(
      empUpdateRes.status === 403,
      `Employee updating task details should return 403, got ${empUpdateRes.status}`
    );
    console.log('✔ Test 7: Regular employee forbidden from editing task details (403 FORBIDDEN).');

    // ----------------------------------------------------
    // Test 8: Assigned employee can move task status
    // ----------------------------------------------------
    const moveRes = await fetch(`${BASE_URL}/api/v1/tasks/${task1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${assignedToken}`,
      },
      body: JSON.stringify({
        status: 'IN_PROGRESS',
        version: 1, // current version after Test 6
      }),
    });
    const moveData = (await moveRes.json()) as any;
    assert(moveRes.status === 200, `Assigned employee status move failed with ${moveRes.status}`);
    assert(moveData.data.status === 'IN_PROGRESS', `Status should be IN_PROGRESS, got ${moveData.data.status}`);
    assert(moveData.data.version === 2, `Version should be incremented to 2, got ${moveData.data.version}`);

    const moveLog = await ActivityLog.findOne({ action: 'TASK_MOVED', entityId: task1Id });
    assert(moveLog !== null, `Expected TASK_MOVED activity log`);
    console.log('✔ Test 8: Assigned employee successfully moved task to IN_PROGRESS (version: 2).');

    // ----------------------------------------------------
    // Test 9: Unassigned employee forbidden from moving task status
    // ----------------------------------------------------
    const unassignedMoveRes = await fetch(`${BASE_URL}/api/v1/tasks/${task1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${unassignedToken}`,
      },
      body: JSON.stringify({
        status: 'DONE',
        version: 2,
      }),
    });
    assert(
      unassignedMoveRes.status === 403,
      `Unassigned employee moving task should return 403, got ${unassignedMoveRes.status}`
    );
    console.log('✔ Test 9: Unassigned employee strictly forbidden from moving task status (403 FORBIDDEN).');

    // ----------------------------------------------------
    // Test 10: Optimistic concurrency control (Version conflict)
    // ----------------------------------------------------
    const staleMoveRes = await fetch(`${BASE_URL}/api/v1/tasks/${task1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${assignedToken}`,
      },
      body: JSON.stringify({
        status: 'TESTING',
        version: 1, // Stale version! Current version is 2
      }),
    });
    assert(
      staleMoveRes.status === 409,
      `Stale version move should return 409 Conflict, got ${staleMoveRes.status}`
    );
    const staleMoveData = (await staleMoveRes.json()) as any;
    assert(
      staleMoveData.error.code === 'CONCURRENT_MODIFICATION',
      `Error code should be CONCURRENT_MODIFICATION, got ${staleMoveData.error.code}`
    );
    console.log('✔ Test 10: Stale optimistic concurrency version rejected with 409 CONCURRENT_MODIFICATION.');

    // ----------------------------------------------------
    // Test 11: Fractional positioning calculations
    // ----------------------------------------------------
    // Currently in BACKLOG we have:
    // task2 at position 2000
    // task3 at position 3000
    // Move task1 back to BACKLOG between task2 and task3:
    const fracMoveRes = await fetch(`${BASE_URL}/api/v1/tasks/${task1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmToken}`,
      },
      body: JSON.stringify({
        status: 'BACKLOG',
        version: 2,
        previousTaskId: task2Id,
        nextTaskId: task3Id,
      }),
    });
    const fracMoveData = (await fracMoveRes.json()) as any;
    assert(fracMoveRes.status === 200, `Fractional move failed with ${fracMoveRes.status}`);
    // Pnew = (2000 + 3000) / 2 = 2500
    assert(
      fracMoveData.data.position === 2500,
      `Expected position between 2000 and 3000 to be 2500, got ${fracMoveData.data.position}`
    );

    // Now move task3 to the top of BACKLOG (before task2):
    // Pfirst = 2000 > 1000 => Pnew = 2000 - 1000 = 1000
    const topMoveRes = await fetch(`${BASE_URL}/api/v1/tasks/${task3Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmToken}`,
      },
      body: JSON.stringify({
        status: 'BACKLOG',
        version: 0,
        nextTaskId: task2Id,
      }),
    });
    const topMoveData = (await topMoveRes.json()) as any;
    assert(topMoveRes.status === 200, `Top move failed with ${topMoveRes.status}`);
    assert(
      topMoveData.data.position === 1000,
      `Expected top position to be 1000, got ${topMoveData.data.position}`
    );
    console.log('✔ Test 11: Fractional positioning formulas verified (P_mid = (P_A+P_B)/2 = 2500, P_top = 1000).');

    // ----------------------------------------------------
    // Test 12: Automatic column rebalancing when gap < 1e-6
    // ----------------------------------------------------
    // Setup two tasks with a microscopic gap: 1000.0000001 and 1000.0000002
    await Task.updateOne({ _id: task2Id }, { $set: { position: 1000.0000001 } });
    await Task.updateOne({ _id: task3Id }, { $set: { position: 1000.0000002 } });

    // Moving task1 between task2 and task3 will trigger gap < 1e-6
    const rebalanceRes = await fetch(`${BASE_URL}/api/v1/tasks/${task1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmToken}`,
      },
      body: JSON.stringify({
        status: 'BACKLOG',
        version: 3,
        previousTaskId: task2Id,
        nextTaskId: task3Id,
      }),
    });
    const rebalanceData = (await rebalanceRes.json()) as any;
    assert(rebalanceRes.status === 200, `Rebalance move failed with ${rebalanceRes.status}`);

    // Verify all BACKLOG tasks were rebalanced to 1000, 2000, 3000
    const rebalancedTasks = await Task.find({ projectId: privateProject._id, status: 'BACKLOG' }).sort({
      position: 1,
    });
    assert(rebalancedTasks.length === 3, `Expected 3 BACKLOG tasks`);
    assert(
      rebalancedTasks[0].position === 1000 &&
        rebalancedTasks[1].position === 2000 &&
        rebalancedTasks[2].position === 3000,
      `Tasks should be evenly spaced (1000, 2000, 3000) after rebalance. Got: ${rebalancedTasks.map((t) => t.position).join(', ')}`
    );
    console.log('✔ Test 12: Column rebalancing automatically triggered when gap < 1e-6 (reset to 1000, 2000, 3000).');

    // ----------------------------------------------------
    // Test 13: Task Comments
    // ----------------------------------------------------
    const commentRes1 = await fetch(`${BASE_URL}/api/v1/tasks/${task1Id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${assignedToken}`,
      },
      body: JSON.stringify({
        content: 'Working on this task now, looks good.',
      }),
    });
    const commentData1 = (await commentRes1.json()) as any;
    assert(commentRes1.status === 201, `Member comment creation failed with ${commentRes1.status}`);
    assert(
      commentData1.data.content === 'Working on this task now, looks good.',
      'Comment content mismatch'
    );
    assert(
      commentData1.data.author.fullName === 'Assigned Dev',
      'Comment author fullName mismatch'
    );

    const commentRes2 = await fetch(`${BASE_URL}/api/v1/tasks/${task1Id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmToken}`,
      },
      body: JSON.stringify({
        content: 'Great, let me know if you need any blockers cleared.',
      }),
    });
    assert(commentRes2.status === 201, `PM comment creation failed with ${commentRes2.status}`);

    // Non-member forbidden from commenting
    const outsiderCommentRes = await fetch(`${BASE_URL}/api/v1/tasks/${task1Id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${outsiderToken}`,
      },
      body: JSON.stringify({
        content: 'I am an outsider commenting',
      }),
    });
    assert(
      outsiderCommentRes.status === 404,
      `Non-member commenting on private task should receive 404, got ${outsiderCommentRes.status}`
    );

    // List comments
    const listCommentsRes = await fetch(`${BASE_URL}/api/v1/tasks/${task1Id}/comments`, {
      headers: { Authorization: `Bearer ${unassignedToken}` }, // Active member
    });
    const listCommentsData = (await listCommentsRes.json()) as any;
    assert(listCommentsRes.status === 200, `List comments failed with ${listCommentsRes.status}`);
    assert(listCommentsData.data.length === 2, `Expected 2 comments, got ${listCommentsData.data.length}`);
    assert(
      listCommentsData.data[0].content === 'Working on this task now, looks good.',
      'First comment content mismatch'
    );
    assert(
      listCommentsData.data[1].content === 'Great, let me know if you need any blockers cleared.',
      'Second comment content mismatch'
    );

    const commentLog = await ActivityLog.findOne({ action: 'COMMENT_ADDED', entityId: task1Id });
    assert(commentLog !== null, `Expected COMMENT_ADDED activity log`);
    console.log('✔ Test 13: Task comments posted, listed chronologically, and logged (COMMENT_ADDED).');

    // ----------------------------------------------------
    // Test 14: Task Deletion by PM/Admin & Comment Cascading
    // ----------------------------------------------------
    // Regular employee cannot delete task
    const empDeleteRes = await fetch(`${BASE_URL}/api/v1/tasks/${task1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${assignedToken}` },
    });
    assert(empDeleteRes.status === 403, `Employee deleting task should receive 403, got ${empDeleteRes.status}`);

    // PM deletes task
    const pmDeleteRes = await fetch(`${BASE_URL}/api/v1/tasks/${task1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${pmToken}` },
    });
    assert(pmDeleteRes.status === 200, `PM delete task failed with ${pmDeleteRes.status}`);

    // Verify task is gone
    const getDeletedRes = await fetch(`${BASE_URL}/api/v1/tasks/${task1Id}`, {
      headers: { Authorization: `Bearer ${pmToken}` },
    });
    assert(getDeletedRes.status === 404, `Deleted task should return 404, got ${getDeletedRes.status}`);

    // Verify comments were cascaded
    const remainingComments = await TaskComment.countDocuments({ taskId: task1Id });
    assert(remainingComments === 0, `Expected 0 cascaded comments, found ${remainingComments}`);

    const deleteLog = await ActivityLog.findOne({ action: 'TASK_DELETED', entityId: task1Id });
    assert(deleteLog !== null, `Expected TASK_DELETED activity log`);
    console.log('✔ Test 14: PM deleted task; associated comments cascaded and TASK_DELETED logged.');

    // ----------------------------------------------------
    // Test 15: Baseline system health
    // ----------------------------------------------------
    const healthRes = await fetch(`${BASE_URL}/api/v1/health`);
    assert(healthRes.status === 200, `Health check failed with ${healthRes.status}`);
    const healthData = (await healthRes.json()) as any;
    assert(
      healthData.data.services.database.status === 'connected',
      `Database should report connected`
    );
    console.log('✔ Test 15: Baseline system health and database connectivity verified.');

    console.log('\n====================================================');
    console.log('All Phase 5 verification tests PASSED successfully!');
    console.log('====================================================\n');
  } finally {
    // Safe scoped cleanup in test database
    assertTestDatabaseConnection();
    const cleanupProjects = await Project.find({ key: { $regex: /^P5/ } }, '_id');
    const cleanupProjectIds = cleanupProjects.map((p) => p._id);
    const cleanupUsers = await User.find({ email: { $regex: /@phase5-test\.com$/ } }, '_id');
    const cleanupUserIds = cleanupUsers.map((u) => u._id);
    const cleanupTasks = await Task.find({ projectId: { $in: cleanupProjectIds } }, '_id');
    const cleanupTaskIds = cleanupTasks.map((t) => t._id);

    if (cleanupProjectIds.length > 0 || cleanupUserIds.length > 0) {
      await ProjectMembership.deleteMany({
        $or: [
          { projectId: { $in: cleanupProjectIds } },
          { userId: { $in: cleanupUserIds } },
        ],
      });
      await TaskComment.deleteMany({ taskId: { $in: cleanupTaskIds } });
      await Task.deleteMany({ projectId: { $in: cleanupProjectIds } });
      await ActivityLog.deleteMany({
        $or: [
          { projectId: { $in: cleanupProjectIds } },
          { actorId: { $in: cleanupUserIds } },
        ],
      });
    }
    await Project.deleteMany({ key: { $regex: /^P5/ } });
    await User.deleteMany({ email: { $regex: /@phase5-test\.com$/ } });

    server.close();
    await disconnectDatabase();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Phase 5 Verification failed:', err);
  process.exit(1);
});
