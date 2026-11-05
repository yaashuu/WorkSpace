import { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { User, IUser } from '../models/User';
import { Project, IProject } from '../models/Project';
import { ProjectMembership } from '../models/ProjectMembership';
import { Task, TaskStatus, TaskPriority, ITask } from '../models/Task';
import { TaskComment } from '../models/TaskComment';
import { Conversation, IConversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { Notification, NotificationType } from '../models/Notification';
import { ActivityLog, ActivityEntityType } from '../models/ActivityLog';
import { hashPassword } from '../utils/password';

// ============================================================================
// Demo Configuration & Constant Values
// ============================================================================
export const DEMO_PASSWORD = 'DemoPassword123!';
export const DEMO_DOMAIN = 'demo.workspace.com';

export interface SeedResult {
  users: { created: number; reused: number; total: number };
  projects: { created: number; reused: number; total: number };
  memberships: { created: number; reused: number; total: number };
  tasks: {
    created: number;
    reused: number;
    total: number;
    byStatus: Record<TaskStatus, number>;
  };
  comments: { created: number; reused: number; total: number };
  conversations: { created: number; reused: number; total: number };
  messages: { created: number; reused: number; total: number };
  notifications: { created: number; reused: number; total: number; unread: number };
  activityLogs: { created: number; reused: number; total: number };
}

// ----------------------------------------------------------------------------
// Demo Users Definition
// ----------------------------------------------------------------------------
interface DemoUserDef {
  email: string;
  fullName: string;
  avatarUrl: string | null;
  roleDescription: string;
}

const DEMO_USERS: DemoUserDef[] = [
  {
    email: `pm.sarah@${DEMO_DOMAIN}`,
    fullName: 'Sarah Chen',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    roleDescription: 'Primary Project Manager (Apollo & Pulse)',
  },
  {
    email: `pm.marcus@${DEMO_DOMAIN}`,
    fullName: 'Marcus Vance',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    roleDescription: 'Primary Project Manager (Mobile)',
  },
  {
    email: `dev.alex@${DEMO_DOMAIN}`,
    fullName: 'Alex Rivera',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    roleDescription: 'Lead Backend Engineer',
  },
  {
    email: `dev.elena@${DEMO_DOMAIN}`,
    fullName: 'Elena Rostova',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    roleDescription: 'Full Stack Engineer',
  },
  {
    email: `qa.liam@${DEMO_DOMAIN}`,
    fullName: 'Liam Gallagher',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    roleDescription: 'QA Automation Engineer',
  },
  {
    email: `designer.maya@${DEMO_DOMAIN}`,
    fullName: 'Maya Patel',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    roleDescription: 'Lead Product Designer',
  },
];

// ----------------------------------------------------------------------------
// Demo Projects Definition
// ----------------------------------------------------------------------------
interface DemoProjectDef {
  key: string;
  name: string;
  description: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  pmEmail: string;
  memberEmails: string[];
}

const DEMO_PROJECTS: DemoProjectDef[] = [
  {
    key: 'APOLLO',
    name: 'Cloud Infrastructure Modernization',
    description:
      'Migration of core monolithic backend services to high-availability Kubernetes clusters with automated GitOps and canary deployments.',
    visibility: 'PRIVATE',
    pmEmail: `pm.sarah@${DEMO_DOMAIN}`,
    memberEmails: [
      `pm.sarah@${DEMO_DOMAIN}`,
      `dev.alex@${DEMO_DOMAIN}`,
      `dev.elena@${DEMO_DOMAIN}`,
      `qa.liam@${DEMO_DOMAIN}`,
    ],
  },
  {
    key: 'MOBILE',
    name: 'Mobile Companion App',
    description:
      'Cross-platform iOS and Android application with offline task sync, push notifications, and quick Kanban triaging.',
    visibility: 'PUBLIC',
    pmEmail: `pm.marcus@${DEMO_DOMAIN}`,
    memberEmails: [
      `pm.marcus@${DEMO_DOMAIN}`,
      `dev.elena@${DEMO_DOMAIN}`,
      `designer.maya@${DEMO_DOMAIN}`,
      `qa.liam@${DEMO_DOMAIN}`,
    ],
  },
  {
    key: 'PULSE',
    name: 'Design System 2.0',
    description:
      'Tokenized UI design system, accessible React components, and WCAG 2.1 AA compliant design guidelines.',
    visibility: 'PUBLIC',
    pmEmail: `pm.sarah@${DEMO_DOMAIN}`,
    memberEmails: [
      `pm.sarah@${DEMO_DOMAIN}`,
      `designer.maya@${DEMO_DOMAIN}`,
      `dev.alex@${DEMO_DOMAIN}`,
    ],
  },
];

// ----------------------------------------------------------------------------
// Demo Tasks Definition
// ----------------------------------------------------------------------------
interface DemoTaskDef {
  projectKey: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeEmail: string | null;
  position: number;
  dueDaysFromNow: number | null;
}

const DEMO_TASKS: DemoTaskDef[] = [
  // --- APOLLO Project Tasks ---
  {
    projectKey: 'APOLLO',
    title: 'Evaluate Service Mesh alternatives (Istio vs Linkerd)',
    description:
      'Benchmark memory footprint, mTLS latency overhead, and telemetry scraping complexity across clusters.',
    status: 'BACKLOG',
    priority: 'MEDIUM',
    assigneeEmail: `dev.alex@${DEMO_DOMAIN}`,
    position: 1000,
    dueDaysFromNow: 25,
  },
  {
    projectKey: 'APOLLO',
    title: 'Configure Prometheus & Grafana alerting thresholds',
    description:
      'Define alert manager notification rules for pod memory pressure, CPU saturation, and 5xx rate spikes.',
    status: 'BACKLOG',
    priority: 'LOW',
    assigneeEmail: null,
    position: 2000,
    dueDaysFromNow: 30,
  },
  {
    projectKey: 'APOLLO',
    title: 'Define Helm chart templates for microservices',
    description:
      'Standardize ingress configurations, secrets management, autoscaling rules, and liveness probes.',
    status: 'TODO',
    priority: 'HIGH',
    assigneeEmail: `dev.alex@${DEMO_DOMAIN}`,
    position: 1000,
    dueDaysFromNow: 12,
  },
  {
    projectKey: 'APOLLO',
    title: 'Implement automated zero-downtime rolling deployments',
    description:
      'Configure rollingUpdate strategy with maxSurge: 25% and maxUnavailable: 0 across production namespaces.',
    status: 'IN_PROGRESS',
    priority: 'URGENT',
    assigneeEmail: `dev.elena@${DEMO_DOMAIN}`,
    position: 1000,
    dueDaysFromNow: 5,
  },
  {
    projectKey: 'APOLLO',
    title: 'Load test API gateway under 10k concurrent WebSockets',
    description:
      'Simulate high-throughput WebSocket message broadcasting with k6 cluster to verify socket connection limits.',
    status: 'TESTING',
    priority: 'HIGH',
    assigneeEmail: `qa.liam@${DEMO_DOMAIN}`,
    position: 1000,
    dueDaysFromNow: 3,
  },
  {
    projectKey: 'APOLLO',
    title: 'Provision production EKS cluster and VPC peering',
    description:
      'Terraform provisioning of AWS multi-AZ VPC, managed EKS node groups, and IAM roles for service accounts.',
    status: 'DONE',
    priority: 'URGENT',
    assigneeEmail: `dev.alex@${DEMO_DOMAIN}`,
    position: 1000,
    dueDaysFromNow: -2,
  },

  // --- MOBILE Project Tasks ---
  {
    projectKey: 'MOBILE',
    title: 'Implement biometric authentication (FaceID / Fingerprint)',
    description:
      'Integrate expo-local-authentication with secure keychain token storage on Android and iOS devices.',
    status: 'BACKLOG',
    priority: 'LOW',
    assigneeEmail: null,
    position: 1000,
    dueDaysFromNow: 40,
  },
  {
    projectKey: 'MOBILE',
    title: 'Design push notification payload schemas and channels',
    description:
      'Specify FCM and APNs notification channels for task assignments, mentions, and urgent deadline alerts.',
    status: 'TODO',
    priority: 'MEDIUM',
    assigneeEmail: `dev.elena@${DEMO_DOMAIN}`,
    position: 1000,
    dueDaysFromNow: 14,
  },
  {
    projectKey: 'MOBILE',
    title: 'Build offline task cache with SQLite local storage',
    description:
      'Implement WatermelonDB / SQLite local caching layer with queued mutation replay upon internet reconnection.',
    status: 'IN_PROGRESS',
    priority: 'URGENT',
    assigneeEmail: `dev.elena@${DEMO_DOMAIN}`,
    position: 1000,
    dueDaysFromNow: 4,
  },
  {
    projectKey: 'MOBILE',
    title: 'Validate deep-linking navigation routes on iOS and Android',
    description:
      'Verify universal links open specific task detail views and conversation threads directly from notifications.',
    status: 'TESTING',
    priority: 'HIGH',
    assigneeEmail: `qa.liam@${DEMO_DOMAIN}`,
    position: 1000,
    dueDaysFromNow: 2,
  },
  {
    projectKey: 'MOBILE',
    title: 'Setup React Native project architecture and navigation stack',
    description:
      'Initialize Expo router with TypeScript, ESLint, React Navigation v7, and dark mode theme provider.',
    status: 'DONE',
    priority: 'HIGH',
    assigneeEmail: `pm.marcus@${DEMO_DOMAIN}`,
    position: 1000,
    dueDaysFromNow: -5,
  },

  // --- PULSE Project Tasks ---
  {
    projectKey: 'PULSE',
    title: 'Audit color contrast ratios for WCAG 2.1 AAA compliance',
    description:
      'Verify all text tokens, icon states, and interactive focus borders achieve 7:1 contrast on dark and light themes.',
    status: 'BACKLOG',
    priority: 'MEDIUM',
    assigneeEmail: `designer.maya@${DEMO_DOMAIN}`,
    position: 1000,
    dueDaysFromNow: 35,
  },
  {
    projectKey: 'PULSE',
    title: 'Create Figma token sync automation script',
    description:
      'Export design tokens (colors, spacing, typography) from Figma Tokens plugin into typed JSON and CSS variables.',
    status: 'TODO',
    priority: 'HIGH',
    assigneeEmail: `designer.maya@${DEMO_DOMAIN}`,
    position: 1000,
    dueDaysFromNow: 10,
  },
  {
    projectKey: 'PULSE',
    title: 'Implement accessible modal and dialog primitives',
    description:
      'Build Radix-based dialog with focus trapping, portal rendering, ARIA attributes, and smooth entry transitions.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    assigneeEmail: `dev.alex@${DEMO_DOMAIN}`,
    position: 1000,
    dueDaysFromNow: 6,
  },
  {
    projectKey: 'PULSE',
    title: 'Cross-browser regression testing on dropdown components',
    description:
      'Test dropdown popovers across Safari, Chrome, Firefox, and mobile viewports for position overflow bugs.',
    status: 'TESTING',
    priority: 'MEDIUM',
    assigneeEmail: `designer.maya@${DEMO_DOMAIN}`,
    position: 1000,
    dueDaysFromNow: 1,
  },
  {
    projectKey: 'PULSE',
    title: 'Establish base typographic hierarchy and spacing scales',
    description:
      'Document responsive typography scale from 12px to 48px and 4px-grid spacing scale in Storybook docs.',
    status: 'DONE',
    priority: 'LOW',
    assigneeEmail: `designer.maya@${DEMO_DOMAIN}`,
    position: 1000,
    dueDaysFromNow: -10,
  },
];

// ----------------------------------------------------------------------------
// Demo Comments Definition
// ----------------------------------------------------------------------------
interface DemoCommentDef {
  projectKey: string;
  taskTitle: string;
  authorEmail: string;
  content: string;
}

const DEMO_COMMENTS: DemoCommentDef[] = [
  {
    projectKey: 'APOLLO',
    taskTitle: 'Implement automated zero-downtime rolling deployments',
    authorEmail: `dev.alex@${DEMO_DOMAIN}`,
    content:
      'Tested rolling update with maxSurge 25% and maxUnavailable 0. Pod evictions completed smoothly without dropped HTTP connections.',
  },
  {
    projectKey: 'APOLLO',
    taskTitle: 'Implement automated zero-downtime rolling deployments',
    authorEmail: `pm.sarah@${DEMO_DOMAIN}`,
    content:
      'Excellent progress. Ensure health check probes have sufficient initial delay so services warm their cache before accepting traffic.',
  },
  {
    projectKey: 'APOLLO',
    taskTitle: 'Load test API gateway under 10k concurrent WebSockets',
    authorEmail: `qa.liam@${DEMO_DOMAIN}`,
    content:
      'Sustained 10,000 connections with p99 latency under 42ms. Bottleneck shifted to open file descriptors on the ingress node, which we have tuned.',
  },
  {
    projectKey: 'MOBILE',
    taskTitle: 'Build offline task cache with SQLite local storage',
    authorEmail: `dev.elena@${DEMO_DOMAIN}`,
    content:
      'Optimistic updates are working smoothly locally. The sync engine successfully reconciles server timestamp conflicts on reconnect.',
  },
  {
    projectKey: 'MOBILE',
    taskTitle: 'Build offline task cache with SQLite local storage',
    authorEmail: `pm.marcus@${DEMO_DOMAIN}`,
    content:
      'Superb work Elena! Let’s review the migration strategy for offline schema upgrades during tomorrow’s sprint sync.',
  },
  {
    projectKey: 'PULSE',
    taskTitle: 'Implement accessible modal and dialog primitives',
    authorEmail: `designer.maya@${DEMO_DOMAIN}`,
    content:
      'Focus trapping, ARIA roles, and keyboard Escape listeners match the design specifications perfectly. Verified with screen reader.',
  },
];

// ============================================================================
// Main Idempotent Seeding Logic
// ============================================================================
export const seedDemo = async (): Promise<SeedResult> => {
  const result: SeedResult = {
    users: { created: 0, reused: 0, total: 0 },
    projects: { created: 0, reused: 0, total: 0 },
    memberships: { created: 0, reused: 0, total: 0 },
    tasks: {
      created: 0,
      reused: 0,
      total: 0,
      byStatus: {
        BACKLOG: 0,
        TODO: 0,
        IN_PROGRESS: 0,
        TESTING: 0,
        DONE: 0,
      },
    },
    comments: { created: 0, reused: 0, total: 0 },
    conversations: { created: 0, reused: 0, total: 0 },
    messages: { created: 0, reused: 0, total: 0 },
    notifications: { created: 0, reused: 0, total: 0, unread: 0 },
    activityLogs: { created: 0, reused: 0, total: 0 },
  };

  try {
    console.log('🚀 Starting WorkSpace Demo Data Seeding...');
    await connectDatabase();

    // ------------------------------------------------------------------------
    // 1. Identify or Create Administrator
    // ------------------------------------------------------------------------
    let admin = await User.findOne({ globalRole: 'ADMIN' });
    if (!admin) {
      console.log('ℹ️ No existing Administrator found. Bootstrapping demo administrator...');
      const adminHash = await hashPassword(DEMO_PASSWORD);
      admin = await User.create({
        email: `admin@${DEMO_DOMAIN}`,
        passwordHash: adminHash,
        fullName: 'Demo Administrator',
        avatarUrl: null,
        globalRole: 'ADMIN',
        isActive: true,
      });
      console.log(`   Created Demo Administrator: ${admin.email}`);
    } else {
      console.log(`ℹ️ Using existing Organization Administrator: ${admin.email}`);
    }

    // ------------------------------------------------------------------------
    // 2. Seed Users
    // ------------------------------------------------------------------------
    console.log('\n👤 Seeding demo users...');
    const userMap = new Map<string, IUser>();
    const commonPasswordHash = await hashPassword(DEMO_PASSWORD);

    for (const u of DEMO_USERS) {
      let user = await User.findOne({ email: u.email });
      if (user) {
        user.fullName = u.fullName;
        user.avatarUrl = u.avatarUrl;
        user.isActive = true;
        await user.save();
        result.users.reused++;
      } else {
        user = await User.create({
          email: u.email,
          passwordHash: commonPasswordHash,
          fullName: u.fullName,
          avatarUrl: u.avatarUrl,
          globalRole: 'USER',
          isActive: true,
        });
        result.users.created++;
      }
      result.users.total++;
      userMap.set(u.email, user);
      console.log(`   - [${user.email}] ${user.fullName} (${u.roleDescription})`);
    }

    // ------------------------------------------------------------------------
    // 3. Seed Projects
    // ------------------------------------------------------------------------
    console.log('\n📁 Seeding demo projects...');
    const projectMap = new Map<string, IProject>();

    for (const p of DEMO_PROJECTS) {
      const pmUser = userMap.get(p.pmEmail);
      if (!pmUser) {
        throw new Error(`PM user ${p.pmEmail} not found for project ${p.key}`);
      }

      let project = await Project.findOne({ key: p.key });
      if (project) {
        project.name = p.name;
        project.description = p.description;
        project.visibility = p.visibility;
        project.status = 'ACTIVE';
        project.primaryManagerId = pmUser._id;
        await project.save();
        result.projects.reused++;
      } else {
        project = await Project.create({
          name: p.name,
          key: p.key,
          description: p.description,
          visibility: p.visibility,
          status: 'ACTIVE',
          createdBy: admin._id,
          primaryManagerId: pmUser._id,
        });
        result.projects.created++;
      }
      result.projects.total++;
      projectMap.set(p.key, project);
      console.log(`   - [${project.key}] ${project.name} (${project.visibility}) -> PM: ${pmUser.fullName}`);
    }

    // ------------------------------------------------------------------------
    // 4. Seed Project Memberships
    // ------------------------------------------------------------------------
    console.log('\n🤝 Seeding project memberships...');
    for (const p of DEMO_PROJECTS) {
      const project = projectMap.get(p.key)!;

      for (const memberEmail of p.memberEmails) {
        const memberUser = userMap.get(memberEmail)!;
        const existingMembership = await ProjectMembership.findOne({
          projectId: project._id,
          userId: memberUser._id,
        });

        if (existingMembership) {
          existingMembership.status = 'ACTIVE';
          existingMembership.role = 'MEMBER';
          await existingMembership.save();
          result.memberships.reused++;
        } else {
          await ProjectMembership.create({
            projectId: project._id,
            userId: memberUser._id,
            role: 'MEMBER',
            status: 'ACTIVE',
            joinedAt: new Date(),
          });
          result.memberships.created++;
        }
        result.memberships.total++;
      }
    }
    console.log(`   Created: ${result.memberships.created}, Reused: ${result.memberships.reused}`);

    // ------------------------------------------------------------------------
    // 5. Seed Tasks
    // ------------------------------------------------------------------------
    console.log('\n📋 Seeding tasks across Kanban columns...');
    const taskMap = new Map<string, ITask>();

    for (const t of DEMO_TASKS) {
      const project = projectMap.get(t.projectKey)!;
      const pmUser = userMap.get(DEMO_PROJECTS.find((p) => p.key === t.projectKey)!.pmEmail)!;
      const assigneeUser = t.assigneeEmail ? userMap.get(t.assigneeEmail) : null;

      const dueDate =
        t.dueDaysFromNow !== null
          ? new Date(Date.now() + t.dueDaysFromNow * 24 * 60 * 60 * 1000)
          : null;

      let task = await Task.findOne({
        projectId: project._id,
        title: t.title,
      });

      if (task) {
        task.description = t.description;
        task.status = t.status;
        task.priority = t.priority;
        task.assigneeId = assigneeUser ? assigneeUser._id : null;
        task.creatorId = pmUser._id;
        task.dueDate = dueDate;
        task.position = t.position;
        await task.save();
        result.tasks.reused++;
      } else {
        task = await Task.create({
          projectId: project._id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          assigneeId: assigneeUser ? assigneeUser._id : null,
          creatorId: pmUser._id,
          dueDate,
          position: t.position,
          version: 0,
        });
        result.tasks.created++;
      }
      result.tasks.total++;
      result.tasks.byStatus[t.status]++;
      taskMap.set(`${t.projectKey}:${t.title}`, task);
    }
    console.log(
      `   Total Tasks: ${result.tasks.total} (BACKLOG: ${result.tasks.byStatus.BACKLOG}, TODO: ${result.tasks.byStatus.TODO}, IN_PROGRESS: ${result.tasks.byStatus.IN_PROGRESS}, TESTING: ${result.tasks.byStatus.TESTING}, DONE: ${result.tasks.byStatus.DONE})`
    );

    // ------------------------------------------------------------------------
    // 6. Seed Task Comments
    // ------------------------------------------------------------------------
    console.log('\n💬 Seeding task comments...');
    for (const c of DEMO_COMMENTS) {
      const task = taskMap.get(`${c.projectKey}:${c.taskTitle}`)!;
      const author = userMap.get(c.authorEmail)!;

      let comment = await TaskComment.findOne({
        taskId: task._id,
        authorId: author._id,
        content: c.content,
      });

      if (comment) {
        result.comments.reused++;
      } else {
        comment = await TaskComment.create({
          taskId: task._id,
          projectId: task.projectId,
          authorId: author._id,
          content: c.content,
        });
        result.comments.created++;
      }
      result.comments.total++;
    }
    console.log(`   Created: ${result.comments.created}, Reused: ${result.comments.reused}`);

    // ------------------------------------------------------------------------
    // 7. Seed Conversations & Messages
    // ------------------------------------------------------------------------
    console.log('\n💬 Seeding conversations and real-time chat messages...');

    // 7a. Project Group Conversations
    for (const p of DEMO_PROJECTS) {
      const project = projectMap.get(p.key)!;
      const pmUser = userMap.get(p.pmEmail)!;
      const memberIds = p.memberEmails.map((email) => userMap.get(email)!._id);
      const participantIds = [admin._id, pmUser._id, ...memberIds];
      const uniqueParticipantIds = Array.from(
        new Set(participantIds.map((id) => id.toString()))
      ).map((id) => new Types.ObjectId(id));

      let conv = await Conversation.findOne({
        type: 'PROJECT_GROUP',
        projectId: project._id,
      });

      if (conv) {
        conv.participants = uniqueParticipantIds;
        conv.lastMessageAt = new Date();
        await conv.save();
        result.conversations.reused++;
      } else {
        conv = await Conversation.create({
          type: 'PROJECT_GROUP',
          projectId: project._id,
          participants: uniqueParticipantIds,
          lastMessageAt: new Date(),
        });
        result.conversations.created++;
      }
      result.conversations.total++;

      // Seed realistic group chat messages
      const groupMessages =
        p.key === 'APOLLO'
          ? [
              {
                sender: pmUser,
                text: 'Welcome team to Project Apollo! Please review your sprint tasks in the Backlog and Todo columns.',
              },
              {
                sender: userMap.get(`dev.alex@${DEMO_DOMAIN}`)!,
                text: 'Thanks Sarah. EKS cluster provisioning is complete, and I am finalizing the Helm templates.',
              },
              {
                sender: userMap.get(`dev.elena@${DEMO_DOMAIN}`)!,
                text: 'Rolling update pipelines are ready on staging. Beginning zero-downtime test runs.',
              },
              {
                sender: userMap.get(`qa.liam@${DEMO_DOMAIN}`)!,
                text: 'Automated end-to-end load test suite is active. Sustained 10k concurrent WebSocket connections.',
              },
            ]
          : p.key === 'MOBILE'
          ? [
              {
                sender: pmUser,
                text: 'Morning team! Let’s keep today’s focus on the offline caching and synchronization layer.',
              },
              {
                sender: userMap.get(`designer.maya@${DEMO_DOMAIN}`)!,
                text: 'Updated Figma prototypes for the mobile Kanban board cards are published in Pulse.',
              },
              {
                sender: userMap.get(`dev.elena@${DEMO_DOMAIN}`)!,
                text: 'Received the design tokens Maya, integrating the offline cache mutations now.',
              },
            ]
          : [
              {
                sender: pmUser,
                text: 'Pulse Design System 2.0 kickoff! Goal is 100% WCAG 2.1 AA compliance across all components.',
              },
              {
                sender: userMap.get(`designer.maya@${DEMO_DOMAIN}`)!,
                text: 'Figma token synchronization script is nearly ready. Color palette contrast ratios are verified.',
              },
            ];

      for (const gm of groupMessages) {
        let msg = await Message.findOne({
          conversationId: conv._id,
          senderId: gm.sender._id,
          content: gm.text,
        });

        if (msg) {
          result.messages.reused++;
        } else {
          msg = await Message.create({
            conversationId: conv._id,
            senderId: gm.sender._id,
            content: gm.text,
            readBy: [{ userId: gm.sender._id, readAt: new Date() }],
          });
          result.messages.created++;
        }
        result.messages.total++;
      }
    }

    // 7b. Private Admin–PM Direct Message Conversations
    const sarahUser = userMap.get(`pm.sarah@${DEMO_DOMAIN}`)!;
    let adminSarahDm = await Conversation.findOne({
      type: 'ADMIN_PM_DM',
      participants: { $all: [admin._id, sarahUser._id], $size: 2 },
    });

    if (adminSarahDm) {
      result.conversations.reused++;
    } else {
      adminSarahDm = await Conversation.create({
        type: 'ADMIN_PM_DM',
        projectId: null,
        participants: [admin._id, sarahUser._id],
        lastMessageAt: new Date(),
      });
      result.conversations.created++;
    }
    result.conversations.total++;

    const adminSarahMessages = [
      {
        sender: admin,
        text: 'Hi Sarah, please give me a quick status update on the Apollo infrastructure migration timeline.',
      },
      {
        sender: sarahUser,
        text: 'Hi! We are on schedule. The EKS cluster is fully provisioned and load tests met our latency SLA.',
      },
      {
        sender: admin,
        text: 'Great work. Let me know if you need additional cloud resource quotas.',
      },
    ];

    for (const dmMsg of adminSarahMessages) {
      let msg = await Message.findOne({
        conversationId: adminSarahDm._id,
        senderId: dmMsg.sender._id,
        content: dmMsg.text,
      });

      if (msg) {
        result.messages.reused++;
      } else {
        msg = await Message.create({
          conversationId: adminSarahDm._id,
          senderId: dmMsg.sender._id,
          content: dmMsg.text,
          readBy: [{ userId: dmMsg.sender._id, readAt: new Date() }],
        });
        result.messages.created++;
      }
      result.messages.total++;
    }

    // ------------------------------------------------------------------------
    // 8. Seed Notifications (Covering All 5 Required Types)
    // ------------------------------------------------------------------------
    console.log('\n🔔 Seeding notifications (all 5 supported types)...');
    const apolloProject = projectMap.get('APOLLO')!;
    const mobileProject = projectMap.get('MOBILE')!;
    const alexUser = userMap.get(`dev.alex@${DEMO_DOMAIN}`)!;
    const elenaUser = userMap.get(`dev.elena@${DEMO_DOMAIN}`)!;
    const liamUser = userMap.get(`qa.liam@${DEMO_DOMAIN}`)!;
    const mayaUser = userMap.get(`designer.maya@${DEMO_DOMAIN}`)!;
    const marcusUser = userMap.get(`pm.marcus@${DEMO_DOMAIN}`)!;

    const demoNotifications: {
      recipient: IUser;
      type: NotificationType;
      title: string;
      body: string;
      link: string;
      isRead: boolean;
    }[] = [
      {
        recipient: alexUser,
        type: 'TASK_ASSIGNED',
        title: 'Task Assigned',
        body: 'You have been assigned to task "Define Helm chart templates for microservices"',
        link: `/projects/${apolloProject._id}/tasks`,
        isRead: true,
      },
      {
        recipient: elenaUser,
        type: 'TASK_ASSIGNED',
        title: 'Task Assigned',
        body: 'You have been assigned to task "Implement automated zero-downtime rolling deployments"',
        link: `/projects/${apolloProject._id}/tasks`,
        isRead: false,
      },
      {
        recipient: sarahUser,
        type: 'TASK_STATUS_CHANGED',
        title: 'Task Status Changed',
        body: 'Task "Load test API gateway under 10k concurrent WebSockets" was moved to TESTING',
        link: `/projects/${apolloProject._id}/tasks`,
        isRead: false,
      },
      {
        recipient: marcusUser,
        type: 'JOIN_REQUEST_CREATED',
        title: 'New Join Request',
        body: 'A user submitted a join request for project "Mobile Companion App"',
        link: `/projects/${mobileProject._id}/join-requests`,
        isRead: false,
      },
      {
        recipient: mayaUser,
        type: 'JOIN_REQUEST_RESOLVED',
        title: 'Join Request Approved',
        body: 'Your join request for project "Mobile Companion App" has been approved',
        link: `/projects/${mobileProject._id}`,
        isRead: true,
      },
      {
        recipient: liamUser,
        type: 'INVITATION_RECEIVED',
        title: 'Project Invitation',
        body: 'You were invited to join project "Cloud Infrastructure Modernization"',
        link: `/projects/${apolloProject._id}`,
        isRead: false,
      },
    ];

    for (const notif of demoNotifications) {
      let n = await Notification.findOne({
        recipientId: notif.recipient._id,
        type: notif.type,
        title: notif.title,
      });

      if (n) {
        n.body = notif.body;
        n.link = notif.link;
        n.isRead = notif.isRead;
        await n.save();
        result.notifications.reused++;
      } else {
        n = await Notification.create({
          recipientId: notif.recipient._id,
          type: notif.type,
          title: notif.title,
          body: notif.body,
          link: notif.link,
          isRead: notif.isRead,
          createdAt: new Date(),
        });
        result.notifications.created++;
      }
      result.notifications.total++;
      if (!n.isRead) {
        result.notifications.unread++;
      }
    }
    console.log(
      `   Total Notifications: ${result.notifications.total} (Unread: ${result.notifications.unread}, Read: ${result.notifications.total - result.notifications.unread})`
    );

    // ------------------------------------------------------------------------
    // 9. Seed Activity Logs
    // ------------------------------------------------------------------------
    console.log('\n📜 Seeding activity audit logs...');
    const demoActivities: {
      projectId: Types.ObjectId;
      actorId: Types.ObjectId;
      action: string;
      entityType: ActivityEntityType;
      entityId: Types.ObjectId;
      metadata: Record<string, unknown>;
    }[] = [
      {
        projectId: apolloProject._id,
        actorId: admin._id,
        action: 'PROJECT_CREATED',
        entityType: 'PROJECT',
        entityId: apolloProject._id,
        metadata: { name: apolloProject.name, key: apolloProject.key },
      },
      {
        projectId: apolloProject._id,
        actorId: sarahUser._id,
        action: 'MEMBER_ADDED',
        entityType: 'MEMBERSHIP',
        entityId: alexUser._id,
        metadata: { memberEmail: alexUser.email, role: 'MEMBER' },
      },
      {
        projectId: apolloProject._id,
        actorId: sarahUser._id,
        action: 'TASK_CREATED',
        entityType: 'TASK',
        entityId: taskMap.get('APOLLO:Define Helm chart templates for microservices')!._id,
        metadata: { title: 'Define Helm chart templates for microservices', priority: 'HIGH' },
      },
      {
        projectId: apolloProject._id,
        actorId: elenaUser._id,
        action: 'TASK_STATUS_CHANGED',
        entityType: 'TASK',
        entityId: taskMap.get('APOLLO:Implement automated zero-downtime rolling deployments')!._id,
        metadata: { fromStatus: 'TODO', toStatus: 'IN_PROGRESS' },
      },
      {
        projectId: mobileProject._id,
        actorId: admin._id,
        action: 'PROJECT_CREATED',
        entityType: 'PROJECT',
        entityId: mobileProject._id,
        metadata: { name: mobileProject.name, key: mobileProject.key },
      },
      {
        projectId: mobileProject._id,
        actorId: marcusUser._id,
        action: 'TASK_CREATED',
        entityType: 'TASK',
        entityId: taskMap.get('MOBILE:Build offline task cache with SQLite local storage')!._id,
        metadata: { title: 'Build offline task cache with SQLite local storage', priority: 'URGENT' },
      },
    ];

    for (const act of demoActivities) {
      let log = await ActivityLog.findOne({
        projectId: act.projectId,
        action: act.action,
        entityId: act.entityId,
      });

      if (log) {
        result.activityLogs.reused++;
      } else {
        log = await ActivityLog.create({
          projectId: act.projectId,
          actorId: act.actorId,
          action: act.action,
          entityType: act.entityType,
          entityId: act.entityId,
          metadata: act.metadata,
          createdAt: new Date(),
        });
        result.activityLogs.created++;
      }
      result.activityLogs.total++;
    }
    console.log(`   Created: ${result.activityLogs.created}, Reused: ${result.activityLogs.reused}`);

    console.log('\n============================================================');
    console.log('✅ Demo Data Seeding Completed Successfully');
    console.log('============================================================');
    console.log(`  Users:         ${result.users.total} (${result.users.created} created, ${result.users.reused} reused)`);
    console.log(`  Projects:      ${result.projects.total} (${result.projects.created} created, ${result.projects.reused} reused)`);
    console.log(`  Memberships:   ${result.memberships.total} (${result.memberships.created} created, ${result.memberships.reused} reused)`);
    console.log(`  Tasks:         ${result.tasks.total} (${result.tasks.created} created, ${result.tasks.reused} reused)`);
    console.log(`  Comments:      ${result.comments.total} (${result.comments.created} created, ${result.comments.reused} reused)`);
    console.log(`  Conversations: ${result.conversations.total} (${result.conversations.created} created, ${result.conversations.reused} reused)`);
    console.log(`  Messages:      ${result.messages.total} (${result.messages.created} created, ${result.messages.reused} reused)`);
    console.log(`  Notifications: ${result.notifications.total} (${result.notifications.created} created, ${result.notifications.reused} reused)`);
    console.log(`  Activity Logs: ${result.activityLogs.total} (${result.activityLogs.created} created, ${result.activityLogs.reused} reused)`);
    console.log('============================================================\n');

    return result;
  } catch (error) {
    console.error('❌ Failed to seed demo data:', (error as Error).message);
    throw error;
  } finally {
    // Only disconnect if executed directly from CLI
    if (require.main === module) {
      await disconnectDatabase().catch(() => {});
    }
  }
};

// Execute if run directly from CLI
if (require.main === module) {
  seedDemo()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
