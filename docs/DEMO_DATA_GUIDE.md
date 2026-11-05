# WorkSpace — Demo Data Guide & Database Reference

This guide provides instructions for populating, verifying, and troubleshooting realistic, fictional demo data for local development, API exploration, and frontend testing in WorkSpace.

> [!CAUTION]
> **LOCAL DEVELOPMENT USE ONLY**  
> All credentials, emails, and tokens documented here are exclusively intended for local development, automated testing, and demonstration. **Never use or deploy demo accounts or hardcoded demo passwords to production environments.**

---

## 1. Quick Start

### Seeding Demo Data
To populate or refresh demo data, navigate to the `server/` directory and run:

```bash
cd server
npm run seed:demo
```

### Verifying Database Integrity & Idempotency
To run the automated referential-integrity and idempotency verification suite:

```bash
cd server
npm run verify:demo
```

---

## 2. Fictional Demo Accounts

All demo user accounts use a shared development password with strong entropy (`DemoPassword123!`), meeting the minimum 8-character, letter, number, and special character requirements.

| Full Name | Email Address | Global Role | Project / Organizational Responsibilities | Local Demo Password |
|---|---|---|---|---|
| **Sarah Chen** | `pm.sarah@demo.workspace.com` | `USER` | **Primary Project Manager** for Project Apollo (`APOLLO`) and Pulse Design System (`PULSE`) | `DemoPassword123!` |
| **Marcus Vance** | `pm.marcus@demo.workspace.com` | `USER` | **Primary Project Manager** for Mobile Companion App (`MOBILE`) | `DemoPassword123!` |
| **Alex Rivera** | `dev.alex@demo.workspace.com` | `USER` | **Senior Backend Engineer**; active member on `APOLLO` and `PULSE` | `DemoPassword123!` |
| **Elena Rostova** | `dev.elena@demo.workspace.com` | `USER` | **Full Stack Engineer**; active member on `APOLLO` and `MOBILE` | `DemoPassword123!` |
| **Liam Gallagher** | `qa.liam@demo.workspace.com` | `USER` | **QA Automation Engineer**; active member on `APOLLO` and `MOBILE` | `DemoPassword123!` |
| **Maya Patel** | `designer.maya@demo.workspace.com` | `USER` | **Lead Product Designer**; active member on `MOBILE` and `PULSE` | `DemoPassword123!` |
| **Workspace Admin** | `admin@workspace.local` | `ADMIN` | **Organization Administrator** (Created via `npm run seed:admin`) | *Configured in `server/.env`* |

> [!NOTE]
> If `npm run seed:demo` is executed on a clean database before running `seed:admin`, the script automatically bootstraps `admin@demo.workspace.com` with global role `ADMIN` and password `DemoPassword123!`.

---

## 3. Seeded Demo Projects & Workspaces

The seeding script generates three realistic projects demonstrating different project visibilities, team compositions, and domain concerns:

### 1. Cloud Infrastructure Modernization (`APOLLO`)
- **Key:** `APOLLO`
- **Visibility:** `PRIVATE` *(Spec 4.1: Strictly inaccessible and invisible to non-members)*
- **Primary Project Manager:** Sarah Chen (`pm.sarah@demo.workspace.com`)
- **Active Team Members:** Sarah Chen, Alex Rivera, Elena Rostova, Liam Gallagher
- **Scope:** Kubernetes cluster architecture, Terraform provisioning, zero-downtime rolling deployments, and high-concurrency WebSocket load testing.

### 2. Mobile Companion App (`MOBILE`)
- **Key:** `MOBILE`
- **Visibility:** `PUBLIC` *(Discoverable by all authenticated users; supports join requests)*
- **Primary Project Manager:** Marcus Vance (`pm.marcus@demo.workspace.com`)
- **Active Team Members:** Marcus Vance, Elena Rostova, Maya Patel, Liam Gallagher
- **Scope:** Cross-platform React Native / Expo application, offline task caching with SQLite, push notification channels, and universal deep links.

### 3. Design System 2.0 (`PULSE`)
- **Key:** `PULSE`
- **Visibility:** `PUBLIC`
- **Primary Project Manager:** Sarah Chen (`pm.sarah@demo.workspace.com`)
- **Active Team Members:** Sarah Chen, Maya Patel, Alex Rivera
- **Scope:** Tokenized design architecture, Figma token sync automation, accessible dialogs with focus trapping, and WCAG 2.1 AAA color contrast compliance.

---

## 4. Kanban Tasks & Status Distribution

A total of **16 realistic tasks** are distributed across all 5 required Kanban columns according to Spec 5:

| Project | Task Title | Status | Priority | Assignee | Position |
|---|---|---|---|---|---|
| `APOLLO` | Evaluate Service Mesh alternatives (Istio vs Linkerd) | `BACKLOG` | `MEDIUM` | Alex Rivera | `1000` |
| `APOLLO` | Configure Prometheus & Grafana alerting thresholds | `BACKLOG` | `LOW` | *Unassigned* | `2000` |
| `APOLLO` | Define Helm chart templates for microservices | `TODO` | `HIGH` | Alex Rivera | `1000` |
| `APOLLO` | Implement automated zero-downtime rolling deployments | `IN_PROGRESS` | `URGENT` | Elena Rostova | `1000` |
| `APOLLO` | Load test API gateway under 10k concurrent WebSockets | `TESTING` | `HIGH` | Liam Gallagher | `1000` |
| `APOLLO` | Provision production EKS cluster and VPC peering | `DONE` | `URGENT` | Alex Rivera | `1000` |
| `MOBILE` | Implement biometric authentication (FaceID / Fingerprint) | `BACKLOG` | `LOW` | *Unassigned* | `1000` |
| `MOBILE` | Design push notification payload schemas and channels | `TODO` | `MEDIUM` | Elena Rostova | `1000` |
| `MOBILE` | Build offline task cache with SQLite local storage | `IN_PROGRESS` | `URGENT` | Elena Rostova | `1000` |
| `MOBILE` | Validate deep-linking navigation routes on iOS and Android | `TESTING` | `HIGH` | Liam Gallagher | `1000` |
| `MOBILE` | Setup React Native project architecture and navigation stack | `DONE` | `HIGH` | Marcus Vance | `1000` |
| `PULSE` | Audit color contrast ratios for WCAG 2.1 AAA compliance | `BACKLOG` | `MEDIUM` | Maya Patel | `1000` |
| `PULSE` | Create Figma token sync automation script | `TODO` | `HIGH` | Maya Patel | `1000` |
| `PULSE` | Implement accessible modal and dialog primitives | `IN_PROGRESS` | `HIGH` | Alex Rivera | `1000` |
| `PULSE` | Cross-browser regression testing on dropdown components | `TESTING` | `MEDIUM` | Maya Patel | `1000` |
| `PULSE` | Establish base typographic hierarchy and spacing scales | `DONE` | `LOW` | Maya Patel | `1000` |

### Kanban Status Breakdown:
- **`BACKLOG`**: 4 tasks (includes unassigned and assigned cards)
- **`TODO`**: 3 tasks
- **`IN_PROGRESS`**: 3 tasks
- **`TESTING`**: 3 tasks
- **`DONE`**: 3 tasks

---

## 5. Conversations, Chat Messages & Direct Message Isolation

The seeding script establishes both group and private direct-message communication channels matching Spec 6:

### Project Group Conversations
- **Apollo Group Chat:** Admin, Sarah Chen (PM), Alex Rivera, Elena Rostova, Liam Gallagher.
- **Mobile Group Chat:** Admin, Marcus Vance (PM), Elena Rostova, Maya Patel.
- **Pulse Group Chat:** Admin, Sarah Chen (PM), Maya Patel, Alex Rivera.

### Admin–PM Private Direct Messages
- **Admin & Sarah Chen DM:** Strictly isolated between the Organization Administrator and Sarah Chen (`projectId: null`, `participants: [AdminId, SarahId]`). Regular developers or members cannot access or query this conversation.

---

## 6. Notifications & Activity History

### Notifications (All 5 Types Covered)
The demo dataset seeds instances of all 5 supported notification types with a mix of read and unread records:
1. `TASK_ASSIGNED` (Read) — Recipient: Alex Rivera
2. `TASK_ASSIGNED` (Unread) — Recipient: Elena Rostova
3. `TASK_STATUS_CHANGED` (Unread) — Recipient: Sarah Chen
4. `JOIN_REQUEST_CREATED` (Unread) — Recipient: Marcus Vance
5. `JOIN_REQUEST_RESOLVED` (Read) — Recipient: Maya Patel
6. `INVITATION_RECEIVED` (Unread) — Recipient: Liam Gallagher

### Activity History Logs
Representative audit logs are recorded for:
- `PROJECT_CREATED` (Admin)
- `MEMBER_ADDED` (PM / Admin)
- `TASK_CREATED` (PM)
- `TASK_STATUS_CHANGED` (Developer)

---

## 7. How to Authenticate & Test via API or Postman

Once the server is running (`npm run dev`), login using the standard endpoint:

### HTTP Request
```http
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json

{
  "email": "pm.sarah@demo.workspace.com",
  "password": "DemoPassword123!"
}
```

### Response
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "67c71...ab8",
      "email": "pm.sarah@demo.workspace.com",
      "fullName": "Sarah Chen",
      "avatarUrl": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
      "globalRole": "USER",
      "isActive": true
    }
  }
}
```

Copy the returned `token` into the `Authorization: Bearer <TOKEN>` header for subsequent requests:
- **Fetch Notifications:** `GET http://localhost:5000/api/v1/notifications`
- **Fetch Tasks:** `GET http://localhost:5000/api/v1/projects/:projectId/tasks`
- **Fetch Activity History:** `GET http://localhost:5000/api/v1/projects/:projectId/activity`

---

## 8. Inspecting Collections in MongoDB Compass

To inspect the raw documents in **MongoDB Compass**:

1. Open MongoDB Compass.
2. Connect to the local connection string:
   ```
   mongodb://localhost:27017
   ```
3. Open the `workspace` database.
4. Filter collections by demo records:
   - **Users:** `{ email: { $regex: /@demo\.workspace\.com$/ } }`
   - **Projects:** `{ key: { $in: ["APOLLO", "MOBILE", "PULSE"] } }`
   - **Tasks:** `{ position: { $exists: true } }`
   - **Notifications:** `{ recipientId: { $exists: true } }`
   - **Conversations:** `{ type: "ADMIN_PM_DM" }`

---

## 9. Idempotency & Troubleshooting

### Safe Re-running
The `seedDemo.ts` script uses domain-scoped lookups (email, project key, task title within project, conversation type/participants) to update or reuse existing demo records:
- **No duplicates:** Re-running `npm run seed:demo` creates 0 new records.
- **Data safety:** Collections are never dropped. Non-demo records from other tests or development sessions remain completely untouched.

### Troubleshooting Missing Data
1. **MongoDB Connection Failed:**
   - Verify that your local MongoDB service is running:
     ```powershell
     Get-Service MongoDB
     ```
   - Check that `MONGODB_URI` in `server/.env` points to `mongodb://localhost:27017/workspace`.
2. **Missing Admin Account:**
   - If an Administrator account is missing, run:
     ```bash
     npm run seed:admin
     ```
   - Alternatively, `npm run seed:demo` will automatically bootstrap `admin@demo.workspace.com`.
3. **Database Consistency Check:**
   - Run the automated verification suite to diagnose any orphaned or invalid references:
     ```bash
     npm run verify:demo
     ```
