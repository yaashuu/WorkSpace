/**
 * WorkSpace Phase 8.1 — Structured Fictional Demonstration Data
 *
 * NOTE: This data serves as the visual layout and interaction prototype
 * for the UI foundation. Live backend REST and Socket.IO connections
 * will be connected in subsequent phases without modifying this schema.
 */

export interface WorkstreamProject {
  id: string;
  key: string;
  name: string;
  description: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  primaryManager: string;
  memberCount: number;
  completedTasks: number;
  totalTasks: number;
  progressPercent: number;
  health: 'On Track' | 'At Risk' | 'Needs Review';
  dueDaysRemaining: number;
}

export interface UrgentTaskItem {
  id: string;
  title: string;
  projectKey: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'TESTING' | 'DONE';
  assigneeName: string;
  assigneeInitials: string;
  dueDateText: string;
  dueSoon: boolean;
}

export interface ActivityStreamItem {
  id: string;
  actorName: string;
  actorInitials: string;
  actionVerb: string;
  targetEntity: string;
  projectKey: string;
  entityType: 'TASK' | 'PROJECT' | 'MEMBERSHIP' | 'COMMENT';
  timestamp: string;
}

export interface DemoNotificationItem {
  id: string;
  title: string;
  body: string;
  projectKey?: string;
  timestamp: string;
  isRead: boolean;
  type: 'TASK_ASSIGNED' | 'TASK_STATUS_CHANGED' | 'JOIN_REQUEST_CREATED' | 'INVITATION_RECEIVED';
}

export interface DemoUserPersona {
  id: string;
  fullName: string;
  initials: string;
  email: string;
  roleTitle: string;
  globalRole: 'ADMIN' | 'USER';
  isPrimaryManager: boolean;
}

// ----------------------------------------------------------------------------
// Available Demo User Personas for Instant Switching
// ----------------------------------------------------------------------------
export const DEMO_PERSONAS: DemoUserPersona[] = [
  {
    id: 'u1',
    fullName: 'Sarah Chen',
    initials: 'SC',
    email: 'pm.sarah@demo.workspace.com',
    roleTitle: 'Primary Project Manager (Apollo & Pulse)',
    globalRole: 'USER',
    isPrimaryManager: true,
  },
  {
    id: 'u2',
    fullName: 'Marcus Vance',
    initials: 'MV',
    email: 'pm.marcus@demo.workspace.com',
    roleTitle: 'Primary Project Manager (Mobile)',
    globalRole: 'USER',
    isPrimaryManager: true,
  },
  {
    id: 'u3',
    fullName: 'Alex Rivera',
    initials: 'AR',
    email: 'dev.alex@demo.workspace.com',
    roleTitle: 'Lead Backend Engineer',
    globalRole: 'USER',
    isPrimaryManager: false,
  },
  {
    id: 'u4',
    fullName: 'Workspace Administrator',
    initials: 'WA',
    email: 'admin@workspace.local',
    roleTitle: 'Organization Administrator',
    globalRole: 'ADMIN',
    isPrimaryManager: false,
  },
];

// ----------------------------------------------------------------------------
// Active WorkSpace Projects
// ----------------------------------------------------------------------------
export const SAMPLE_PROJECTS: WorkstreamProject[] = [
  {
    id: 'proj-apollo',
    key: 'APOLLO',
    name: 'Cloud Infrastructure Modernization',
    description: 'Migration to high-availability Kubernetes clusters with automated GitOps delivery.',
    visibility: 'PRIVATE',
    primaryManager: 'Sarah Chen',
    memberCount: 4,
    completedTasks: 5,
    totalTasks: 6,
    progressPercent: 83,
    health: 'On Track',
    dueDaysRemaining: 12,
  },
  {
    id: 'proj-mobile',
    key: 'MOBILE',
    name: 'Mobile Companion App',
    description: 'Cross-platform client with offline task caching and local SQLite sync engine.',
    visibility: 'PUBLIC',
    primaryManager: 'Marcus Vance',
    memberCount: 4,
    completedTasks: 2,
    totalTasks: 5,
    progressPercent: 40,
    health: 'Needs Review',
    dueDaysRemaining: 22,
  },
  {
    id: 'proj-pulse',
    key: 'PULSE',
    name: 'Design System 2.0',
    description: 'Tokenized component library, accessible dialog primitives, and WCAG AA tokens.',
    visibility: 'PUBLIC',
    primaryManager: 'Sarah Chen',
    memberCount: 3,
    completedTasks: 4,
    totalTasks: 5,
    progressPercent: 80,
    health: 'On Track',
    dueDaysRemaining: 15,
  },
];

// ----------------------------------------------------------------------------
// High Priority & Urgent Attention Tasks
// ----------------------------------------------------------------------------
export const SAMPLE_URGENT_TASKS: UrgentTaskItem[] = [
  {
    id: 't-1',
    title: 'Zero-downtime rolling deployment verification',
    projectKey: 'APOLLO',
    priority: 'URGENT',
    status: 'IN_PROGRESS',
    assigneeName: 'Elena Rostova',
    assigneeInitials: 'ER',
    dueDateText: 'Due in 2 days',
    dueSoon: true,
  },
  {
    id: 't-2',
    title: 'Offline SQLite cache mutation reconciliation',
    projectKey: 'MOBILE',
    priority: 'URGENT',
    status: 'IN_PROGRESS',
    assigneeName: 'Elena Rostova',
    assigneeInitials: 'ER',
    dueDateText: 'Due in 3 days',
    dueSoon: true,
  },
  {
    id: 't-3',
    title: 'Load test WebSocket gateway under 10k connections',
    projectKey: 'APOLLO',
    priority: 'HIGH',
    status: 'TESTING',
    assigneeName: 'Liam Gallagher',
    assigneeInitials: 'LG',
    dueDateText: 'Due in 5 days',
    dueSoon: false,
  },
  {
    id: 't-4',
    title: 'Dialog primitive keyboard focus-trap testing',
    projectKey: 'PULSE',
    priority: 'HIGH',
    status: 'TODO',
    assigneeName: 'Alex Rivera',
    assigneeInitials: 'AR',
    dueDateText: 'Due in 7 days',
    dueSoon: false,
  },
  {
    id: 't-5',
    title: 'Evaluate Service Mesh memory footprints',
    projectKey: 'APOLLO',
    priority: 'MEDIUM',
    status: 'BACKLOG',
    assigneeName: 'Alex Rivera',
    assigneeInitials: 'AR',
    dueDateText: 'Due in 18 days',
    dueSoon: false,
  },
];

// ----------------------------------------------------------------------------
// Kanban Column Distribution Summary
// ----------------------------------------------------------------------------
export const KANBAN_FLOW_METRICS = {
  totalTasks: 16,
  byStatus: [
    { status: 'BACKLOG' as const, label: 'Backlog', count: 4, color: 'bg-slate-400' },
    { status: 'TODO' as const, label: 'To Do', count: 3, color: 'bg-blue-500' },
    { status: 'IN_PROGRESS' as const, label: 'In Progress', count: 3, color: 'bg-primary' },
    { status: 'TESTING' as const, label: 'Testing', count: 3, color: 'bg-amber-500' },
    { status: 'DONE' as const, label: 'Done', count: 3, color: 'bg-emerald-500' },
  ],
};

// ----------------------------------------------------------------------------
// Activity Audit Trail
// ----------------------------------------------------------------------------
export const SAMPLE_ACTIVITY_STREAM: ActivityStreamItem[] = [
  {
    id: 'act-1',
    actorName: 'Sarah Chen',
    actorInitials: 'SC',
    actionVerb: 'completed task',
    targetEntity: 'Production EKS cluster & VPC peering',
    projectKey: 'APOLLO',
    entityType: 'TASK',
    timestamp: '1 hour ago',
  },
  {
    id: 'act-2',
    actorName: 'Marcus Vance',
    actorInitials: 'MV',
    actionVerb: 'approved join request for',
    targetEntity: 'Maya Patel (UI Designer)',
    projectKey: 'MOBILE',
    entityType: 'MEMBERSHIP',
    timestamp: '3 hours ago',
  },
  {
    id: 'act-3',
    actorName: 'Elena Rostova',
    actorInitials: 'ER',
    actionVerb: 'moved task to IN_PROGRESS',
    targetEntity: 'Offline SQLite cache sync engine',
    projectKey: 'MOBILE',
    entityType: 'TASK',
    timestamp: '5 hours ago',
  },
  {
    id: 'act-4',
    actorName: 'Liam Gallagher',
    actorInitials: 'LG',
    actionVerb: 'posted load test results on',
    targetEntity: 'WebSocket API Gateway',
    projectKey: 'APOLLO',
    entityType: 'COMMENT',
    timestamp: '7 hours ago',
  },
  {
    id: 'act-5',
    actorName: 'Alex Rivera',
    actorInitials: 'AR',
    actionVerb: 'updated Helm chart ingress templates for',
    targetEntity: 'APOLLO microservices',
    projectKey: 'APOLLO',
    entityType: 'TASK',
    timestamp: '9 hours ago',
  },
];

// ----------------------------------------------------------------------------
// Sample In-App Notifications
// ----------------------------------------------------------------------------
export const SAMPLE_NOTIFICATIONS: DemoNotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Task Assigned',
    body: 'You were assigned to task "Zero-downtime rolling deployments"',
    projectKey: 'APOLLO',
    timestamp: '15 mins ago',
    isRead: false,
    type: 'TASK_ASSIGNED',
  },
  {
    id: 'notif-2',
    title: 'Card Moved to Testing',
    body: 'Task "WebSocket API Gateway" was moved to TESTING column',
    projectKey: 'APOLLO',
    timestamp: '2 hours ago',
    isRead: false,
    type: 'TASK_STATUS_CHANGED',
  },
  {
    id: 'notif-3',
    title: 'New Join Request',
    body: 'Liam Gallagher requested to join project "Mobile Companion App"',
    projectKey: 'MOBILE',
    timestamp: '4 hours ago',
    isRead: false,
    type: 'JOIN_REQUEST_CREATED',
  },
  {
    id: 'notif-4',
    title: 'Project Invitation',
    body: 'You were invited to collaborate on "Cloud Infrastructure Modernization"',
    projectKey: 'APOLLO',
    timestamp: 'Yesterday',
    isRead: true,
    type: 'INVITATION_RECEIVED',
  },
];
