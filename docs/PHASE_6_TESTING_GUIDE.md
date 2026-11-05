# WorkSpace — Phase 6 Manual Testing Guide
## Chat & Real-Time Updates (Socket.IO, Group Conversations & Isolated DMs)

This guide provides step-by-step instructions for testing and verifying all Phase 6 features in WorkSpace using Postman, WebSocket clients (e.g. Postman WebSocket Request, Firecamp, or `wscat`), or cURL.

---

## 1. Prerequisites & Environment Setup

### 1.1 Start the Server
Start the backend server:
```bash
npm --prefix server run dev
```
The server will start on `http://localhost:5000` (HTTP and Socket.IO engine combined on the same port).

### 1.2 Base URL & Endpoints
- **REST Base URL:** `http://localhost:5000/api/v1`
- **Socket.IO Endpoint:** `ws://localhost:5000/socket.io/?EIO=4&transport=websocket`
- **Headers for REST:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <JWT_TOKEN>`

### 1.3 Recommended Postman Environment Variables
| Variable | Description |
| :--- | :--- |
| `baseUrl` | `http://localhost:5000/api/v1` |
| `wsUrl` | `ws://localhost:5000` |
| `adminToken` | JWT Bearer token for an Administrator |
| `pmToken` | JWT Bearer token for the Project's Primary Manager |
| `memberToken` | JWT Bearer token for an active Project Member |
| `outsiderToken` | JWT Bearer token for a user with no membership |
| `projectId` | Active Project ID |
| `conversationId` | Project Group Conversation ID |
| `dmId` | Admin–PM Direct Message Conversation ID |

---

## 2. API Endpoints Reference

### 2.1 REST Endpoints (`/api/v1/conversations`)

| Method | Endpoint | Authorized Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/conversations/project/:projectId` | Admin, Primary PM, Active Member | Fetch or initialize project group conversation |
| `GET` | `/conversations/admin-pm/:managerId` | Admin, Primary PM | Fetch or initialize isolated 1-on-1 Admin–PM DM |
| `GET` | `/conversations/:id/messages` | Conversation Participants | Paginated reverse-chronological message history |
| `POST` | `/conversations/:id/messages` | Conversation Participants | Send message; persists in MongoDB & broadcasts via Socket.IO |

---

## 3. Socket.IO Real-Time Events Reference

### 3.1 Handshake Authentication (Spec 9.3)
Connecting clients must supply a valid JWT token in the handshake:
```json
{
  "auth": {
    "token": "<JWT_BEARER_TOKEN>"
  }
}
```
If the token is missing, expired, or the user is inactive, the connection is rejected with an `Authentication error`.

### 3.2 Client Emit Events
| Event | Payload | Description |
| :--- | :--- | :--- |
| `join:project` | `{ "projectId": "<ID>" }` | Subscribes socket to room `project:<ID>` (server verifies membership) |
| `leave:project` | `{ "projectId": "<ID>" }` | Unsubscribes socket from room `project:<ID>` |
| `join:conversation` | `{ "conversationId": "<ID>" }` | Subscribes socket to room `conversation:<ID>` (server verifies access) |
| `leave:conversation` | `{ "conversationId": "<ID>" }` | Unsubscribes socket from room `conversation:<ID>` |
| `message:send` | `{ "conversationId": "<ID>", "content": "..." }` | Sends message via WebSocket; persists to MongoDB and broadcasts |

### 3.3 Server Emitted Events
| Event | Room | Payload | Description |
| :--- | :--- | :--- | :--- |
| `joined:project` | Caller | `{ "projectId": "<ID>" }` | Confirmation of project room subscription |
| `joined:conversation` | Caller | `{ "conversationId": "<ID>" }` | Confirmation of conversation room subscription |
| `message:received` | `conversation:<ID>` | Message object with sender | Real-time message broadcast to participants |
| `task:created` | `project:<ID>` | Task object | Real-time card creation broadcast |
| `task:updated` | `project:<ID>` | Task object | Real-time card metadata update broadcast |
| `task:moved` | `project:<ID>` | Task object | Real-time card status & position move |
| `task:deleted` | `project:<ID>` | `{ "taskId": "<ID>" }` | Real-time card deletion broadcast |
| `board:rebalanced` | `project:<ID>` | `{ "projectId": "<ID>", "status": "..." }` | Column rebalance notification |
| `project:evicted` | Evicted User | `{ "projectId": "<ID>", "conversationId": "<ID>" }` | Ejection notification when membership revoked |
| `error` | Caller | `{ "code": "...", "message": "..." }` | Real-time error notification |

---

## 4. Step-by-Step Test Scenarios

### Scenario 1: Socket Authentication Handshake
**Objective:** Confirm that unauthenticated or invalid socket connections are rejected, while valid JWTs are admitted.

1. **Attempt connection without token:**
   - Configure a Socket.IO connection to `http://localhost:5000` with no auth.
   - **Expected Result:** Connection rejected: `Authentication error: Token missing`.
2. **Attempt connection with invalid token:**
   - Auth: `{ "token": "malformed.token.value" }`
   - **Expected Result:** Connection rejected: `Authentication error: ...`.
3. **Connect with valid token:**
   - Auth: `{ "token": "{{memberToken}}" }`
   - **Expected Result:** Handshake succeeds, socket enters `connected` state.

---

### Scenario 2: Project Group Conversation Initialization & Access Control
**Objective:** Verify that project members can access their project's group conversation while outsiders are blocked.

1. **Member fetches project conversation:**
   - **Endpoint:** `GET {{baseUrl}}/conversations/project/{{projectId}}`
   - **Headers:** `Authorization: Bearer {{memberToken}}`
   - **Expected Status:** `200 OK`
   - **Expected Response:**
     ```json
     {
       "success": true,
       "data": {
         "_id": "672...",
         "type": "PROJECT_GROUP",
         "projectId": "{{projectId}}",
         "participants": ["..."],
         "lastMessageAt": "..."
       }
     }
     ```
   - Save `data._id` as `conversationId`.

2. **Outsider attempts to access private project conversation:**
   - **Headers:** `Authorization: Bearer {{outsiderToken}}`
   - **Expected Status:** `404 Not Found` (Keeps private project hidden).

---

### Scenario 3: Isolated Administrator–Manager Direct Messaging (ADMIN_PM_DM)
**Objective:** Verify that 1-on-1 DMs between an Admin and PM are strictly isolated and omitted from project queries.

1. **Admin initiates DM with PM:**
   - **Endpoint:** `GET {{baseUrl}}/conversations/admin-pm/{{pmUserId}}`
   - **Headers:** `Authorization: Bearer {{adminToken}}`
   - **Expected Status:** `200 OK`
   - **Expected Response:**
     ```json
     {
       "success": true,
       "data": {
         "_id": "672...",
         "type": "ADMIN_PM_DM",
         "projectId": null,
         "participants": ["{{adminUserId}}", "{{pmUserId}}"]
       }
     }
     ```
   - Note: `projectId` is strictly `null` (Spec 7.2) to prevent inclusion in any project queries.

2. **Non-PM Regular Member attempts to access Admin-PM DM endpoint:**
   - **Headers:** `Authorization: Bearer {{memberToken}}`
   - **Expected Status:** `403 Forbidden` (`Administrator or Project Manager privileges required`).

3. **Non-participant attempts to read DM messages:**
   - **Endpoint:** `GET {{baseUrl}}/conversations/{{dmId}}/messages`
   - **Headers:** `Authorization: Bearer {{memberToken}}`
   - **Expected Status:** `403 Forbidden` (`You are not a participant in this conversation`).

---

### Scenario 4: Sending Messages & Cursor Pagination
**Objective:** Post a message via REST, verify persistence, and fetch with reverse-chronological pagination.

1. **Send Message:**
   - **Endpoint:** `POST {{baseUrl}}/conversations/{{conversationId}}/messages`
   - **Headers:** `Authorization: Bearer {{memberToken}}`
   - **Body:**
     ```json
     {
       "content": "Phase 6 real-time chat is operational!"
     }
     ```
   - **Expected Status:** `201 Created`
   - **Expected Response:**
     ```json
     {
       "success": true,
       "data": {
         "_id": "672...",
         "conversationId": "{{conversationId}}",
         "senderId": "{{memberUserId}}",
         "sender": {
           "fullName": "...",
           "email": "..."
         },
         "content": "Phase 6 real-time chat is operational!",
         "createdAt": "..."
       }
     }
     ```

2. **Empty Message Validation:**
   - **Body:** `{ "content": "   " }`
   - **Expected Status:** `400 Bad Request` (`Message cannot be empty`).

3. **Fetch Message History:**
   - **Endpoint:** `GET {{baseUrl}}/conversations/{{conversationId}}/messages?limit=10`
   - **Headers:** `Authorization: Bearer {{memberToken}}`
   - **Expected Status:** `200 OK`
   - **Result:** Messages sorted with the newest first (`createdAt: -1`).

---

### Scenario 5: Real-Time Chat Message Delivery
**Objective:** Confirm that messages sent via REST or Socket are instantly received by active room members.

1. **Open Socket Connection 1 (Member):**
   - Connect with `{{memberToken}}`.
   - Emit `join:conversation` with `{ "conversationId": "{{conversationId}}" }`.
   - Wait for `joined:conversation` confirmation.
   - Listen for event: `message:received`.

2. **Open Socket Connection 2 or Send REST Message (PM):**
   - Send `POST {{baseUrl}}/conversations/{{conversationId}}/messages` with content `"Hello team"`.
   - **Result:** Connection 1 immediately receives `message:received` containing the message payload with populated sender.

---

### Scenario 6: Real-Time Board & Task Events
**Objective:** Verify that task operations in a project broadcast real-time updates to connected clients in room `project:{{projectId}}`.

1. **Subscribe to Project Room:**
   - Socket client emits `join:project` with `{ "projectId": "{{projectId}}" }`.
   - Client receives `joined:project`.
   - Listen for events: `task:created`, `task:moved`, `task:updated`, `task:deleted`.

2. **Create Task via REST:**
   - `POST {{baseUrl}}/projects/{{projectId}}/tasks` with title `"Test Socket Task"`.
   - **Result:** Socket receives `task:created` with the new task payload.

3. **Move Task via REST:**
   - `PATCH {{baseUrl}}/tasks/{{taskId}}/status` with `{ "status": "IN_PROGRESS", "version": 0 }`.
   - **Result:** Socket receives `task:moved` with updated status.

---

### Scenario 7: Membership Revocation & Socket Ejection (Spec 7.1)
**Objective:** Verify that removing a member from a project immediately ejects their socket from project rooms and blocks future access.

1. **Member connects socket:**
   - Member joins `project:{{projectId}}` and `conversation:{{conversationId}}`.
   - Listen for event: `project:evicted`.

2. **PM removes member:**
   - `DELETE {{baseUrl}}/projects/{{projectId}}/members/{{memberUserId}}`.
   - **Expected Status:** `200 OK`.

3. **Verify Eviction:**
   - Member's socket receives event `project:evicted` with `{ "projectId": "{{projectId}}" }`.
   - Member's socket is ejected from rooms `project:{{projectId}}` and `conversation:{{conversationId}}`.
   - Member attempting to send a message via REST receives `404` or `403`.
   - Member attempting `join:project` via socket receives `{ "code": "FORBIDDEN" }`.

---

## 5. Automated Verification Test Suite

Run the end-to-end automated verification suite covering all 10 Phase 6 scenarios:

```bash
npm --prefix server run test:phase6
```

All 10 test suites run sequentially with isolated test data and real Socket.IO client connections.
