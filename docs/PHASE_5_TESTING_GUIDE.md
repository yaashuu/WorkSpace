# WorkSpace — Phase 5 Manual Postman Testing Guide
## Kanban Tasks, Fractional Positioning & Task Comments

This testing guide provides step-by-step instructions for verifying all Phase 5 capabilities in WorkSpace using Postman, cURL, or any HTTP REST client.

---

## 1. Prerequisites & Environment Setup

### 1.1 Start the Server
From the root workspace directory, ensure the backend is running:
```bash
npm --prefix server run dev
```
The server will start on `http://localhost:5000` (or the configured `PORT` in `.env`).

### 1.2 Base URL & Common Headers
- **Base URL:** `http://localhost:5000/api/v1`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <JWT_TOKEN>`

### 1.3 Recommended Postman Collection Variables
Configure these variables in your Postman environment:
| Variable | Description |
| :--- | :--- |
| `baseUrl` | `http://localhost:5000/api/v1` |
| `adminToken` | Bearer token for an Admin account |
| `pmToken` | Bearer token for the Project's Primary Manager |
| `memberToken` | Bearer token for an assigned active member |
| `unassignedToken`| Bearer token for an unassigned active member |
| `outsiderToken` | Bearer token for a user with no membership |
| `projectId` | Active project ID |
| `taskId` | Created task ID |
| `taskVersion` | Concurrency version number (integer) |

---

## 2. API Endpoints Reference

| Method | Endpoint | Authorized Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/projects/:id/tasks` | Admin, Primary PM | Create task in column bottom |
| `GET` | `/projects/:id/tasks` | Admin, PM, Project Members | List tasks (deterministic ordering) |
| `GET` | `/tasks/:id` | Admin, PM, Project Members | Fetch single task details |
| `PATCH` | `/tasks/:id` | Admin, Primary PM | Update task metadata / assignee |
| `PATCH` | `/tasks/:id/status` | Admin, PM, Assigned Employee | Move task status / fractional position |
| `DELETE` | `/tasks/:id` | Admin, Primary PM | Delete task (cascades comments) |
| `GET` | `/tasks/:id/comments` | Admin, PM, Project Members | Fetch task comments (chronological) |
| `POST` | `/tasks/:id/comments` | Admin, PM, Project Members | Post a new comment on a task |

---

## 3. Step-by-Step Test Scenarios

### Scenario 1: Task Creation by Project Manager & Default Column Positioning

**Objective:** Verify that PM can create a task, and it is assigned initial position `1000`.

- **Endpoint:** `POST {{baseUrl}}/projects/{{projectId}}/tasks`
- **Headers:** `Authorization: Bearer {{pmToken}}`
- **Request Body:**
  ```json
  {
    "title": "Design Database Schema",
    "description": "Create ER diagrams and Mongoose models",
    "status": "BACKLOG",
    "priority": "HIGH",
    "assigneeId": "{{memberUserId}}"
  }
  ```
- **Expected Status:** `201 Created`
- **Expected Response:**
  ```json
  {
    "success": true,
    "data": {
      "_id": "672...",
      "projectId": "{{projectId}}",
      "title": "Design Database Schema",
      "description": "Create ER diagrams and Mongoose models",
      "status": "BACKLOG",
      "priority": "HIGH",
      "assigneeId": "{{memberUserId}}",
      "position": 1000,
      "version": 0,
      "createdAt": "...",
      "updatedAt": "..."
    },
    "timestamp": "..."
  }
  ```
- **Note:** Save `data._id` as `taskId` and `data.version` as `taskVersion`. Subsequent tasks created in the same column will receive positions `2000`, `3000`, etc.

---

### Scenario 2: Regular Employee Forbidden from Creating Tasks

**Objective:** Enforce that regular members cannot create tasks.

- **Endpoint:** `POST {{baseUrl}}/projects/{{projectId}}/tasks`
- **Headers:** `Authorization: Bearer {{memberToken}}`
- **Request Body:**
  ```json
  {
    "title": "Unauthorized Task"
  }
  ```
- **Expected Status:** `403 Forbidden`
- **Expected Response:**
  ```json
  {
    "success": false,
    "error": {
      "code": "FORBIDDEN",
      "message": "Primary project manager or administrator privileges required"
    },
    "timestamp": "..."
  }
  ```

---

### Scenario 3: Assignee Membership Validation

**Objective:** Prevent assigning users who are not active members of the project.

- **Endpoint:** `POST {{baseUrl}}/projects/{{projectId}}/tasks`
- **Headers:** `Authorization: Bearer {{pmToken}}`
- **Request Body:**
  ```json
  {
    "title": "Task with Invalid Assignee",
    "assigneeId": "{{outsiderUserId}}"
  }
  ```
- **Expected Status:** `400 Bad Request`
- **Expected Response:**
  ```json
  {
    "success": false,
    "error": {
      "code": "INVALID_ASSIGNEE",
      "message": "Assignee must be an active member of this project"
    },
    "timestamp": "..."
  }
  ```

---

### Scenario 4: Non-Member Access Restrictions

**Objective:** Verify that non-members cannot read tasks from private or public projects without proper authorization.

1. **Private Project Query by Outsider:**
   - **Endpoint:** `GET {{baseUrl}}/projects/{{privateProjectId}}/tasks`
   - **Headers:** `Authorization: Bearer {{outsiderToken}}`
   - **Expected Status:** `404 Not Found` (Keeps private project existence hidden)
   - **Error Code:** `PROJECT_NOT_FOUND`

2. **Public Project Query by Outsider:**
   - **Endpoint:** `GET {{baseUrl}}/projects/{{publicProjectId}}/tasks`
   - **Headers:** `Authorization: Bearer {{outsiderToken}}`
   - **Expected Status:** `403 Forbidden`
   - **Error Code:** `FORBIDDEN`

---

### Scenario 5: Kanban Board Retrieval & Deterministic Ordering

**Objective:** Fetch all tasks in a project, deterministically sorted by `{ position: 1, createdAt: 1, _id: 1 }`.

- **Endpoint:** `GET {{baseUrl}}/projects/{{projectId}}/tasks`
- **Headers:** `Authorization: Bearer {{memberToken}}`
- **Query Params (Optional):** `status=BACKLOG`
- **Expected Status:** `200 OK`
- **Expected Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "...",
        "title": "Task 1",
        "status": "BACKLOG",
        "position": 1000,
        "assignee": {
          "_id": "...",
          "fullName": "Jane Developer",
          "email": "jane@example.com"
        }
      },
      {
        "_id": "...",
        "title": "Task 2",
        "status": "BACKLOG",
        "position": 2000
      }
    ],
    "timestamp": "..."
  }
  ```

---

### Scenario 6: Task Metadata Update (Admin / PM Only)

**Objective:** Update task title, description, priority, or due date.

- **Endpoint:** `PATCH {{baseUrl}}/tasks/{{taskId}}`
- **Headers:** `Authorization: Bearer {{pmToken}}`
- **Request Body:**
  ```json
  {
    "title": "Design Database Schema — Revised",
    "priority": "URGENT",
    "description": "Include indexes for compound Kanban queries"
  }
  ```
- **Expected Status:** `200 OK`
- **Expected Response:**
  ```json
  {
    "success": true,
    "data": {
      "_id": "{{taskId}}",
      "title": "Design Database Schema — Revised",
      "priority": "URGENT",
      "version": 1
    },
    "timestamp": "..."
  }
  ```
- **Note:** `version` is incremented to `1`. Regular employees calling this endpoint will receive `403 Forbidden`.

---

### Scenario 7: Task Status Move by Assigned Employee

**Objective:** Verify that an assigned employee can move their task through the Kanban workflow.

- **Endpoint:** `PATCH {{baseUrl}}/tasks/{{taskId}}/status`
- **Headers:** `Authorization: Bearer {{memberToken}}`
- **Request Body:**
  ```json
  {
    "status": "IN_PROGRESS",
    "version": 1
  }
  ```
- **Expected Status:** `200 OK`
- **Expected Response:**
  ```json
  {
    "success": true,
    "data": {
      "_id": "{{taskId}}",
      "status": "IN_PROGRESS",
      "position": 1000,
      "version": 2
    },
    "timestamp": "..."
  }
  ```
- **Note:** The task is moved to `IN_PROGRESS` and its `version` increments to `2`.

---

### Scenario 8: Unassigned Member Forbidden from Moving Task Status

**Objective:** Prevent team members from moving tasks that are assigned to someone else.

- **Endpoint:** `PATCH {{baseUrl}}/tasks/{{taskId}}/status`
- **Headers:** `Authorization: Bearer {{unassignedToken}}`
- **Request Body:**
  ```json
  {
    "status": "DONE",
    "version": 2
  }
  ```
- **Expected Status:** `403 Forbidden`
- **Expected Response:**
  ```json
  {
    "success": false,
    "error": {
      "code": "FORBIDDEN",
      "message": "Only the assigned employee, project manager, or an administrator can update this task status"
    },
    "timestamp": "..."
  }
  ```

---

### Scenario 9: Stale Optimistic Concurrency Conflict (409 Conflict)

**Objective:** Protect against concurrent overwrites or stale drag-and-drop operations.

- **Endpoint:** `PATCH {{baseUrl}}/tasks/{{taskId}}/status`
- **Headers:** `Authorization: Bearer {{memberToken}}`
- **Request Body:**
  ```json
  {
    "status": "TESTING",
    "version": 1
  }
  ```
  *(Note: current version in the database is 2)*
- **Expected Status:** `409 Conflict`
- **Expected Response:**
  ```json
  {
    "success": false,
    "error": {
      "code": "CONCURRENT_MODIFICATION",
      "message": "Task was modified concurrently by another user",
      "details": {
        "currentVersion": 2,
        "currentStatus": "IN_PROGRESS"
      }
    },
    "timestamp": "..."
  }
  ```

---

### Scenario 10: Fractional Positioning Calculation

**Objective:** Move a card between two cards in a column using `previousTaskId` and `nextTaskId`.

- **Context:** Suppose Task A is at `position: 2000` and Task B is at `position: 3000`.
- **Endpoint:** `PATCH {{baseUrl}}/tasks/{{taskId}}/status`
- **Headers:** `Authorization: Bearer {{pmToken}}`
- **Request Body:**
  ```json
  {
    "status": "BACKLOG",
    "version": 2,
    "previousTaskId": "{{taskAId}}",
    "nextTaskId": "{{taskBId}}"
  }
  ```
- **Expected Status:** `200 OK`
- **Expected Response Position:**
  $$\frac{2000 + 3000}{2} = 2500$$
  ```json
  {
    "success": true,
    "data": {
      "_id": "{{taskId}}",
      "position": 2500,
      "version": 3
    }
  }
  ```

---

### Scenario 11: Task Comments (Add & Fetch)

**Objective:** Verify that project members can comment and list comments chronologically.

1. **Add Comment:**
   - **Endpoint:** `POST {{baseUrl}}/tasks/{{taskId}}/comments`
   - **Headers:** `Authorization: Bearer {{memberToken}}`
   - **Request Body:**
     ```json
     {
       "content": "Added the requested Mongoose schema indexes."
     }
     ```
   - **Expected Status:** `201 Created`
   - **Expected Response:**
     ```json
     {
       "success": true,
       "data": {
         "_id": "...",
         "taskId": "{{taskId}}",
         "content": "Added the requested Mongoose schema indexes.",
         "author": {
           "_id": "{{memberUserId}}",
           "fullName": "Jane Developer",
           "email": "jane@example.com"
         },
         "createdAt": "..."
       }
     }
     ```

2. **List Comments:**
   - **Endpoint:** `GET {{baseUrl}}/tasks/{{taskId}}/comments`
   - **Headers:** `Authorization: Bearer {{memberToken}}`
   - **Expected Status:** `200 OK`
   - **Expected Response:** Array of comments sorted in ascending chronological order (`createdAt: 1`).

---

### Scenario 12: Task Deletion and Cascading Comment Cleanup

**Objective:** Verify that deleting a task cleanly removes the task and cascades to its comments.

1. **Delete Request:**
   - **Endpoint:** `DELETE {{baseUrl}}/tasks/{{taskId}}`
   - **Headers:** `Authorization: Bearer {{pmToken}}`
   - **Expected Status:** `200 OK`
   - **Expected Response:**
     ```json
     {
       "success": true,
       "data": {
         "message": "Task deleted successfully",
         "taskId": "{{taskId}}"
       },
       "timestamp": "..."
     }
     ```

2. **Verify Cascaded Deletion:**
   - `GET {{baseUrl}}/tasks/{{taskId}}` returns `404 TASK_NOT_FOUND`.
   - `GET {{baseUrl}}/tasks/{{taskId}}/comments` returns `404 TASK_NOT_FOUND`.

---

## 4. Automated Verification Test Suite

To run the full end-to-end automated verification test suite for Phase 5:

```bash
npm --prefix server run test:phase5
```

All 15 verification criteria will run sequentially with isolated test data and report real-time status.
