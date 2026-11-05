import assert from 'node:assert/strict';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { User } from '../models/User';
import { Project } from '../models/Project';
import { ProjectMembership } from '../models/ProjectMembership';
import { Task, TaskStatus } from '../models/Task';
import { TaskComment } from '../models/TaskComment';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { Notification } from '../models/Notification';
import { ActivityLog } from '../models/ActivityLog';
import { seedDemo, DEMO_DOMAIN } from './seedDemo';

export interface VerificationReport {
  timestamp: string;
  checks: { name: string; passed: boolean; details: string }[];
  collectionCounts: Record<string, { total: number; demoOwned: number }>;
  allPassed: boolean;
}

export const verifyDemoDatabase = async (): Promise<VerificationReport> => {
  console.log('🔍 Starting WorkSpace Database Verification...\n');
  await connectDatabase();

  const checks: { name: string; passed: boolean; details: string }[] = [];

  const addCheck = (name: string, passed: boolean, details: string) => {
    checks.push({ name, passed, details });
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${name}`);
    if (!passed || process.env.VERBOSE) {
      console.log(`   ${details}`);
    }
  };

  try {
    // Ensure demo dataset is present before validating integrity
    const initialDemoUserCount = await User.countDocuments({ email: new RegExp(`@${DEMO_DOMAIN}$`) });
    const initialDemoProjectCount = await Project.countDocuments({ key: { $in: ['APOLLO', 'MOBILE', 'PULSE'] } });
    if (initialDemoUserCount === 0 || initialDemoProjectCount === 0) {
      console.log('ℹ️ Demo data not detected. Initializing baseline demo seed...');
      await seedDemo();
      console.log('------------------------------------------------------------\n');
    }
    // ------------------------------------------------------------------------
    // 1. All expected demo users exist
    // ------------------------------------------------------------------------
    const expectedUserEmails = [
      `pm.sarah@${DEMO_DOMAIN}`,
      `pm.marcus@${DEMO_DOMAIN}`,
      `dev.alex@${DEMO_DOMAIN}`,
      `dev.elena@${DEMO_DOMAIN}`,
      `qa.liam@${DEMO_DOMAIN}`,
      `designer.maya@${DEMO_DOMAIN}`,
    ];

    const demoUsers = await User.find({ email: { $in: expectedUserEmails } });
    const userEmailsFound = demoUsers.map((u) => u.email);
    const allUsersFound = expectedUserEmails.every((e) => userEmailsFound.includes(e));
    const allUsersActive = demoUsers.every((u) => u.isActive);

    addCheck(
      '1. Demo Users Existence & Active State',
      allUsersFound && allUsersActive && demoUsers.length === expectedUserEmails.length,
      `Found ${demoUsers.length}/${expectedUserEmails.length} active demo users`
    );

    // ------------------------------------------------------------------------
    // 2. Every project has exactly one valid primary PM
    // ------------------------------------------------------------------------
    const demoProjects = await Project.find({ key: { $in: ['APOLLO', 'MOBILE', 'PULSE'] } });
    let projectsPmValid = demoProjects.length === 3;
    const pmDetails: string[] = [];

    for (const p of demoProjects) {
      if (!p.primaryManagerId) {
        projectsPmValid = false;
        pmDetails.push(`${p.key}: Missing primaryManagerId`);
        continue;
      }
      const pm = await User.findById(p.primaryManagerId);
      if (!pm || !pm.isActive) {
        projectsPmValid = false;
        pmDetails.push(`${p.key}: PM not found or inactive`);
      } else {
        pmDetails.push(`${p.key} -> PM: ${pm.fullName} (${pm.email})`);
      }
    }

    addCheck(
      '2. Primary Project Manager Validation',
      projectsPmValid,
      pmDetails.join(' | ')
    );

    // ------------------------------------------------------------------------
    // 3. Project memberships reference existing users and projects
    // ------------------------------------------------------------------------
    const demoProjectIds = demoProjects.map((p) => p._id);
    const memberships = await ProjectMembership.find({ projectId: { $in: demoProjectIds } });
    let membershipsValid = memberships.length > 0;

    for (const m of memberships) {
      const proj = await Project.findById(m.projectId);
      const usr = await User.findById(m.userId);
      if (!proj || !usr || m.status !== 'ACTIVE' || m.role !== 'MEMBER') {
        membershipsValid = false;
        break;
      }
    }

    addCheck(
      '3. Project Membership Referential Integrity',
      membershipsValid,
      `Verified ${memberships.length} active memberships across ${demoProjects.length} demo projects`
    );

    // ------------------------------------------------------------------------
    // 4. Every task references a valid project and its assignee (with membership)
    // ------------------------------------------------------------------------
    const tasks = await Task.find({ projectId: { $in: demoProjectIds } });
    let tasksReferentialValid = tasks.length > 0;
    const taskInvalidReasons: string[] = [];

    for (const t of tasks) {
      const proj = await Project.findById(t.projectId);
      if (!proj) {
        tasksReferentialValid = false;
        taskInvalidReasons.push(`Task "${t.title}" references missing project`);
        continue;
      }
      if (t.assigneeId) {
        const assignee = await User.findById(t.assigneeId);
        if (!assignee) {
          tasksReferentialValid = false;
          taskInvalidReasons.push(`Task "${t.title}" references missing assignee`);
          continue;
        }
        // Verify assignee is an active member of this project
        const member = await ProjectMembership.findOne({
          projectId: t.projectId,
          userId: t.assigneeId,
          status: 'ACTIVE',
        });
        if (!member) {
          tasksReferentialValid = false;
          taskInvalidReasons.push(`Task "${t.title}" assignee ${assignee.email} is not an active project member`);
        }
      }
    }

    addCheck(
      '4. Task Project & Assignee Membership Integrity',
      tasksReferentialValid,
      tasksReferentialValid
        ? `All ${tasks.length} tasks have valid projects and assignees with active project membership`
        : taskInvalidReasons.join('; ')
    );

    // ------------------------------------------------------------------------
    // 5. All five Kanban statuses are represented
    // ------------------------------------------------------------------------
    const requiredStatuses: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'TESTING', 'DONE'];
    const statusCounts: Record<TaskStatus, number> = {
      BACKLOG: 0,
      TODO: 0,
      IN_PROGRESS: 0,
      TESTING: 0,
      DONE: 0,
    };

    for (const t of tasks) {
      if (statusCounts[t.status] !== undefined) {
        statusCounts[t.status]++;
      }
    }

    const allStatusesPresent = requiredStatuses.every((s) => statusCounts[s] > 0);
    const statusSummary = requiredStatuses.map((s) => `${s}: ${statusCounts[s]}`).join(', ');

    addCheck(
      '5. All 5 Kanban Statuses Represented',
      allStatusesPresent,
      `Distribution: [${statusSummary}]`
    );

    // ------------------------------------------------------------------------
    // 6. Task positions and versions satisfy existing model requirements
    // ------------------------------------------------------------------------
    let taskOrderingValid = true;
    for (const t of tasks) {
      if (typeof t.position !== 'number' || isNaN(t.position) || typeof t.version !== 'number' || t.version < 0) {
        taskOrderingValid = false;
        break;
      }
    }

    addCheck(
      '6. Task Ordering & Optimistic Versioning Validity',
      taskOrderingValid,
      `All ${tasks.length} tasks possess valid numeric fractional positions and non-negative version counters`
    );

    // ------------------------------------------------------------------------
    // 7. Comments reference valid tasks, projects, and authors
    // ------------------------------------------------------------------------
    const comments = await TaskComment.find({ projectId: { $in: demoProjectIds } });
    let commentsValid = comments.length > 0;
    const commentInvalidReasons: string[] = [];

    for (const c of comments) {
      const task = await Task.findById(c.taskId);
      const proj = await Project.findById(c.projectId);
      const author = await User.findById(c.authorId);

      if (!task || !proj || !author) {
        commentsValid = false;
        commentInvalidReasons.push(`Comment ${c._id} has invalid task/project/author reference`);
        continue;
      }

      // Check author belongs to the project
      const member = await ProjectMembership.findOne({
        projectId: c.projectId,
        userId: c.authorId,
        status: 'ACTIVE',
      });
      if (!member) {
        commentsValid = false;
        commentInvalidReasons.push(`Comment author ${author.email} is not a member of project ${proj.key}`);
      }
    }

    addCheck(
      '7. Task Comments Integrity & Author Membership',
      commentsValid,
      commentsValid
        ? `All ${comments.length} comments reference existing tasks, projects, and authorized author members`
        : commentInvalidReasons.join('; ')
    );

    // ------------------------------------------------------------------------
    // 8. Conversations and messages have valid participants, references, and authors
    // ------------------------------------------------------------------------
    const groupConvs = await Conversation.find({ projectId: { $in: demoProjectIds } });
    const dmConvs = await Conversation.find({
      type: 'ADMIN_PM_DM',
      participants: { $in: demoUsers.map((u) => u._id) },
    });
    const allDemoConvs = [...groupConvs, ...dmConvs];
    const demoConvIds = allDemoConvs.map((c) => c._id);
    const messages = await Message.find({ conversationId: { $in: demoConvIds } });

    let convsValid = allDemoConvs.length > 0 && messages.length > 0;
    for (const m of messages) {
      const conv = allDemoConvs.find((c) => c._id.equals(m.conversationId));
      if (!conv) {
        convsValid = false;
        break;
      }
      const isParticipant = conv.participants.some((p) => p.equals(m.senderId));
      if (!isParticipant) {
        convsValid = false;
        break;
      }
    }

    addCheck(
      '8. Chat Conversations & Message Authorship Validity',
      convsValid,
      `Verified ${allDemoConvs.length} conversations (${groupConvs.length} group, ${dmConvs.length} DM) and ${messages.length} messages with valid participant authorship`
    );

    // ------------------------------------------------------------------------
    // 9. Notifications reference valid recipients and entities
    // ------------------------------------------------------------------------
    const demoUserIds = demoUsers.map((u) => u._id);
    const notifications = await Notification.find({ recipientId: { $in: demoUserIds } });
    const notificationTypesFound = new Set(notifications.map((n) => n.type));
    const all5TypesPresent =
      notificationTypesFound.has('TASK_ASSIGNED') &&
      notificationTypesFound.has('TASK_STATUS_CHANGED') &&
      notificationTypesFound.has('JOIN_REQUEST_CREATED') &&
      notificationTypesFound.has('JOIN_REQUEST_RESOLVED') &&
      notificationTypesFound.has('INVITATION_RECEIVED');

    const hasRead = notifications.some((n) => n.isRead === true);
    const hasUnread = notifications.some((n) => n.isRead === false);

    addCheck(
      '9. Notification Types & Read/Unread State Coverage',
      notifications.length >= 5 && all5TypesPresent && hasRead && hasUnread,
      `Found ${notifications.length} demo notifications covering all 5 types (Read: ${notifications.filter((n) => n.isRead).length}, Unread: ${notifications.filter((n) => !n.isRead).length})`
    );

    // ------------------------------------------------------------------------
    // 10. Activity logs reference valid actors and projects
    // ------------------------------------------------------------------------
    const activities = await ActivityLog.find({ projectId: { $in: demoProjectIds } });
    let activitiesValid = activities.length > 0;

    for (const a of activities) {
      const proj = await Project.findById(a.projectId);
      const actor = await User.findById(a.actorId);
      if (!proj || !actor || !a.action || !a.entityType) {
        activitiesValid = false;
        break;
      }
    }

    addCheck(
      '10. Activity Audit Log Integrity',
      activitiesValid,
      `Verified ${activities.length} activity audit log records with valid actors, projects, and actions`
    );

    // ------------------------------------------------------------------------
    // 11. Private admin–PM conversations remain isolated
    // ------------------------------------------------------------------------
    let dmIsolationValid = dmConvs.length > 0;
    const admin = await User.findOne({ globalRole: 'ADMIN' });

    for (const dm of dmConvs) {
      if (dm.participants.length !== 2) {
        dmIsolationValid = false;
        break;
      }
      const hasAdmin = admin && dm.participants.some((p) => p.equals(admin._id));
      const hasDemoPm = dm.participants.some(
        (p) =>
          p.equals(demoUsers.find((u) => u.email === `pm.sarah@${DEMO_DOMAIN}`)?._id) ||
          p.equals(demoUsers.find((u) => u.email === `pm.marcus@${DEMO_DOMAIN}`)?._id)
      );

      if (!hasAdmin || !hasDemoPm) {
        dmIsolationValid = false;
        break;
      }
    }

    addCheck(
      '11. Admin–PM Direct Message Privacy Isolation',
      dmIsolationValid,
      `Strictly 2 participants per DM (Admin + Primary PM); no unauthorized employees present`
    );

    // ------------------------------------------------------------------------
    // 12. Idempotency Check: Re-run seedDemo and verify counts remain identical
    // ------------------------------------------------------------------------
    console.log('\n🔁 Running idempotency test: Executing seedDemo() a second time...');
    const nonDemoUserCountBefore = await User.countDocuments({ email: { $not: new RegExp(`@${DEMO_DOMAIN}$`) } });
    const nonDemoProjectCountBefore = await Project.countDocuments({ key: { $nin: ['APOLLO', 'MOBILE', 'PULSE'] } });

    const secondSeedResult = await seedDemo();

    const nonDemoUserCountAfter = await User.countDocuments({ email: { $not: new RegExp(`@${DEMO_DOMAIN}$`) } });
    const nonDemoProjectCountAfter = await Project.countDocuments({ key: { $nin: ['APOLLO', 'MOBILE', 'PULSE'] } });

    const zeroCreatedOnRerun =
      secondSeedResult.users.created === 0 &&
      secondSeedResult.projects.created === 0 &&
      secondSeedResult.memberships.created === 0 &&
      secondSeedResult.tasks.created === 0 &&
      secondSeedResult.comments.created === 0 &&
      secondSeedResult.conversations.created === 0 &&
      secondSeedResult.messages.created === 0 &&
      secondSeedResult.notifications.created === 0 &&
      secondSeedResult.activityLogs.created === 0;

    const nonDemoPreserved =
      nonDemoUserCountBefore === nonDemoUserCountAfter &&
      nonDemoProjectCountBefore === nonDemoProjectCountAfter;

    addCheck(
      '12. Idempotency & Preservation of Non-Demo Data',
      zeroCreatedOnRerun && nonDemoPreserved,
      `Re-run created 0 new records (all reused/updated). Non-demo users (${nonDemoUserCountBefore}) and projects (${nonDemoProjectCountBefore}) completely unchanged.`
    );

    // ------------------------------------------------------------------------
    // Summary Table of Database Collection Counts
    // ------------------------------------------------------------------------
    const collectionCounts: Record<string, { total: number; demoOwned: number }> = {
      users: {
        total: await User.countDocuments(),
        demoOwned: await User.countDocuments({ email: new RegExp(`@${DEMO_DOMAIN}$`) }),
      },
      projects: {
        total: await Project.countDocuments(),
        demoOwned: await Project.countDocuments({ key: { $in: ['APOLLO', 'MOBILE', 'PULSE'] } }),
      },
      projectmemberships: {
        total: await ProjectMembership.countDocuments(),
        demoOwned: await ProjectMembership.countDocuments({ projectId: { $in: demoProjectIds } }),
      },
      tasks: {
        total: await Task.countDocuments(),
        demoOwned: await Task.countDocuments({ projectId: { $in: demoProjectIds } }),
      },
      taskcomments: {
        total: await TaskComment.countDocuments(),
        demoOwned: await TaskComment.countDocuments({ projectId: { $in: demoProjectIds } }),
      },
      conversations: {
        total: await Conversation.countDocuments(),
        demoOwned: await Conversation.countDocuments({
          $or: [
            { projectId: { $in: demoProjectIds } },
            { type: 'ADMIN_PM_DM', participants: { $in: demoUserIds } },
          ],
        }),
      },
      messages: {
        total: await Message.countDocuments(),
        demoOwned: await Message.countDocuments({ conversationId: { $in: demoConvIds } }),
      },
      notifications: {
        total: await Notification.countDocuments(),
        demoOwned: await Notification.countDocuments({ recipientId: { $in: demoUserIds } }),
      },
      activitylogs: {
        total: await ActivityLog.countDocuments(),
        demoOwned: await ActivityLog.countDocuments({ projectId: { $in: demoProjectIds } }),
      },
    };

    console.log('\n============================================================');
    console.log('📊 Database Collection Record Summary');
    console.log('============================================================');
    for (const [col, counts] of Object.entries(collectionCounts)) {
      console.log(`  ${col.padEnd(20)}: ${String(counts.total).padStart(4)} total (${counts.demoOwned} demo)`);
    }
    console.log('============================================================\n');

    const allPassed = checks.every((c) => c.passed);
    if (allPassed) {
      console.log('🎉 ALL 12 DATABASE INTEGRITY AND IDEMPOTENCY CHECKS PASSED!\n');
    } else {
      console.error('❌ SOME CHECKS FAILED!');
    }

    return {
      timestamp: new Date().toISOString(),
      checks,
      collectionCounts,
      allPassed,
    };
  } finally {
    if (require.main === module) {
      await disconnectDatabase().catch(() => {});
    }
  }
};

// Execute if run directly from CLI
if (require.main === module) {
  verifyDemoDatabase()
    .then((report) => process.exit(report.allPassed ? 0 : 1))
    .catch((err) => {
      console.error('Verification error:', err);
      process.exit(1);
    });
}
