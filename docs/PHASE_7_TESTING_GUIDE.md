# WorkSpace — Phase 7 Manual Testing Guide
## Notifications & Activity History

This guide provides step-by-step instructions for testing and verifying all Phase 7 features in WorkSpace using Postman, WebSocket clients, or cURL.

---

## 1. Prerequisites & Environment Setup

### 1.1 Start the Server
Start the backend server:
```bash
npm --prefix server run dev
```
The server will run on `http://localhost:5000`.

### 1.2 Base URL & Endpoints
- **REST Base URL:** `http://localhost:5000/api/v1`
- **Socket.IO Endpoint:** `ws://localhost:5000/socket.io/?EIO=4&transport=websocket`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <JWT_TOKEN>`

### 1.3 Recommended Postman Environment Variables
| Variable | Description |
| :--- | :--- |
| `baseUrl` | `http://localhost:5000/api/v1` |
| `adminToken` | JWT Bearer token for an Administrator |
| `pmToken` | JWT Bearer token for the Project's Primary Manager |
| `memberToken` | JWT Bearer token for an assigned Project Member |
| `outsiderToken` | JWT Bearer token for an unassociated user |
| `projectId` | Active Project ID |
| `notificationId` | Created notification ID |

---

## 2. API Endpoints Reference

### 2.1 Notifications (`/api/v1/notifications`)

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/notifications` | Authenticated User | Paginated notifications list with unread counts (`?page=1&limit=20&isRead=false`) |
| `GET` | `/notifications/unread-count` | Authenticated User | Fetch total unread notifications count |
| `PATCH` | `/notifications/:id/read` | Recipient Only | Mark single notification as read |
| `PATCH` | `/notifications/read-all` | Authenticated User | Bulk mark all unread notifications as read |

### 2.2 Project Activity History (`/api/v1/projects/:id/activity`)

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/projects/:id/activity` | Admin, Primary PM, Project Member | Paginated project activity feed (`?page=1&limit=50&entityType=TASK`) |
| `GET` | `/projects/:id/activity-logs` | Admin, Primary PM, Project Member | Alias route for activity feed |

---

## 3. Notification Triggers & Recipient Rules

| Event / Business Operation | Generated Notification Type | Intended Recipient | Title & Body Content |
| :--- | :--- | :--- | :--- |
| **Task Creation with Assignee** (`POST /projects/:id/tasks`) | `TASK_ASSIGNED` | Assigned User (`assigneeId`) | Title: `"Task Assigned"`<br/>Body: `"You have been assigned to task \"{task.title}\"."` |
| **Task Reassignment** (`PATCH /tasks/:id`) | `TASK_ASSIGNED` | New Assignee (`assigneeId`) | Title: `"Task Assigned"`<br/>Body: `"You have been assigned to task \"{task.title}\"."` |
| **Task Status Move** (`PATCH /tasks/:id/status`) | `TASK_STATUS_CHANGED` | Assigned Member (if moved by PM/Admin) OR Primary PM (if moved by Member) | Title: `"Task Status Updated"`<br/>Body: `"Task \"{task.title}\" status changed to {newStatus}."` |
| **Public Join Request Submitted** (`POST /projects/:id/join-requests`) | `JOIN_REQUEST_CREATED` | Primary Project Manager | Title: `"New Join Request"`<br/>Body: `"A new join request has been submitted for project \"{project.name}\"."` |
| **Join Request Approved / Rejected** (`PATCH /join-requests/:id/approve` or `reject`) | `JOIN_REQUEST_RESOLVED` | Requesting User (`userId`) | Title: `"Join Request Approved"` / `"Join Request Rejected"`<br/>Body: `"Your request to join project \"{project.name}\" has been {status}."` |
| **Project Invitation Sent to Registered Email** (`POST /invitations`) | `INVITATION_RECEIVED` | Registered User matching `invitedEmail` | Title: `"Project Invitation Received"`<br/>Body: `"You have been invited to join project \"{project.name}\"."` |

---

## 4. Socket.IO Real-Time Delivery

### 4.1 Private User Room
When any socket connects with a valid JWT token:
- The socket automatically subscribes to private room: `user:{userId}`.
- All real-time notifications are emitted to `user:{recipientId}` with event: `notification:received`.
- Notification contents are never broadcast to public or project rooms.

### 4.2 Real-Time Event Schema (`notification:received`)
```json
{
  "_id": "6729a1...",
  "recipientId": "6729a0...",
  "type": "TASK_ASSIGNED",
  "title": "Task Assigned",
  "body": "You have been assigned to task \"Build Auth Engine\".",
  "link": "/projects/6729a0.../tasks/6729a1...",
  "isRead": false,
  "createdAt": "2026-11-04T01:00:00.000Z"
}
```

---

## 5. Step-by-Step Test Scenarios

### Scenario 1: Receive Real-Time TASK_ASSIGNED Notification
1. **Open Socket Connection for Member:**
   - Connect to `ws://localhost:5000` with auth token: `{{memberToken}}`.
   - Listen for event: `notification:received`.
2. **PM creates task assigned to Member:**
   - **Endpoint:** `POST {{baseUrl}}/projects/{{projectId}}/tasks`
   - **Headers:** `Authorization: Bearer {{pmToken}}`
   - **Body:**
     ```json
     {
       "title": "Build WebSocket Notification Gateway",
       "status": "BACKLOG",
       "assigneeId": "{{memberUserId}}"
     }
     ```
   - **Expected Status:** `201 Created`
3. **Verify Event Received:**
   - Member socket receives `notification:received` with `type: "TASK_ASSIGNED"`.
   - Save `data._id` as `{{notificationId}}`.

---

### Scenario 2: Fetch Notifications List with Pagination & Unread Count
1. **Fetch Notifications:**
   - **Endpoint:** `GET {{baseUrl}}/notifications?page=1&limit=10&isRead=false`
   - **Headers:** `Authorization: Bearer {{memberToken}}`
   - **Expected Status:** `200 OK`
   - **Expected Response:**
     ```json
     {
       "success": true,
       "data": {
         "notifications": [
           {
             "_id": "{{notificationId}}",
             "recipientId": "{{memberUserId}}",
             "type": "TASK_ASSIGNED",
             "title": "Task Assigned",
             "body": "You have been assigned to task \"Build WebSocket Notification Gateway\".",
             "isRead": false,
             "createdAt": "..."
           }
         ],
         "unreadCount": 1,
         "pagination": {
           "page": 1,
           "limit": 10,
           "total": 1,
           "totalPages": 1
         }
       },
       "timestamp": "..."
     }
     ```

2. **Check Dedicated Unread Count Endpoint:**
   - **Endpoint:** `GET {{baseUrl}}/notifications/unread-count`
   - **Headers:** `Authorization: Bearer {{memberToken}}`
   - **Expected Status:** `200 OK`
   - **Expected Response:**
     ```json
     {
       "success": true,
       "data": {
         "unreadCount": 1
       },
       "timestamp": "..."
     }
     ```

---

### Scenario 3: Mark Notification as Read & Ownership Enforcement
1. **Unauthorized User Attempts to Mark Read:**
   - **Endpoint:** `PATCH {{baseUrl}}/notifications/{{notificationId}}/read`
   - **Headers:** `Authorization: Bearer {{outsiderToken}}`
   - **Expected Status:** `403 Forbidden` (`You are not authorized to modify this notification`).

2. **Recipient Marks Notification Read:**
   - **Headers:** `Authorization: Bearer {{memberToken}}`
   - **Expected Status:** `200 OK`
   - **Expected Response:**
     ```json
     {
       "success": true,
       "data": {
         "_id": "{{notificationId}}",
         "isRead": true
       }
     }
     ```

3. **Repeat Call (Idempotency Check):**
   - Call the same endpoint again with `{{memberToken}}`.
   - **Expected Status:** `200 OK` (stays `isRead: true`).

---

### Scenario 4: Bulk Mark All Notifications as Read
1. **Execute Bulk Read:**
   - **Endpoint:** `PATCH {{baseUrl}}/notifications/read-all`
   - **Headers:** `Authorization: Bearer {{memberToken}}`
   - **Expected Status:** `200 OK`
   - **Expected Response:**
     ```json
     {
       "success": true,
       "data": {
         "message": "All notifications marked as read",
         "modifiedCount": 1
       }
     }
     ```
2. **Verify Count Reset:**
   - `GET {{baseUrl}}/notifications/unread-count` returns `"unreadCount": 0`.

---

### Scenario 5: Retrieve Project Activity History Feed
1. **Member Queries Project Activity:**
   - **Endpoint:** `GET {{baseUrl}}/projects/{{projectId}}/activity?limit=10&page=1`
   - **Headers:** `Authorization: Bearer {{memberToken}}`
   - **Expected Status:** `200 OK`
   - **Expected Response:**
     ```json
     {
       "success": true,
       "data": {
         "activityLogs": [
           {
             "_id": "...",
             "projectId": "{{projectId}}",
             "actorId": "...",
             "actor": {
               "fullName": "Primary PM",
               "email": "pm@example.com"
             },
             "action": "TASK_CREATED",
             "entityType": "TASK",
             "metadata": {
               "title": "Build WebSocket Notification Gateway"
             },
             "createdAt": "..."
           }
         ],
         "pagination": {
           "page": 1,
           "limit": 10,
           "total": 5,
           "totalPages": 1
         }
       }
     }
     ```

2. **Filter by Entity Type:**
   - **Endpoint:** `GET {{baseUrl}}/projects/{{projectId}}/activity?entityType=TASK`
   - **Expected Status:** `200 OK` (all items have `entityType === "TASK"`).

3. **Unauthorized Non-Member Query on Private Project:**
   - **Headers:** `Authorization: Bearer {{outsiderToken}}`
   - **Expected Status:** `404 Not Found` (preserves private project invisibility).

4. **Unauthorized Non-Member Query on Public Project:**
   - **Headers:** `Authorization: Bearer {{outsiderToken}}`
   - **Expected Status:** `403 Forbidden` (Spec 3.2 line 84: non-members cannot access activity logs).

---

## 6. Automated Verification Test Suite

To run the automated verification suite covering all 15 Phase 7 scenarios:

```bash
npm --prefix server run test:phase7
```
