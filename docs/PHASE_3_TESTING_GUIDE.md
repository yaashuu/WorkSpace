# WorkSpace — Phase 3: Postman Manual Testing Guide

This guide provides step-by-step instructions for testing the **Phase 3 Project Governance, Visibility, and Primary Manager Lifecycle** endpoints in Postman or cURL.

---

## 1. MongoDB Replica Set Setup (For Multi-Document Transactions)

WorkSpace utilizes MongoDB ACID multi-document transactions for atomic manager replacement and membership synchronization (Section 4.2 of `docs/PROJECT_SPEC.md`).

MongoDB multi-document transactions **require** a replica set (even a single-node replica set).

### How to Enable a Single-Node Replica Set Locally (Windows)

1. Open your MongoDB configuration file (`C:\Program Files\MongoDB\Server\8.3\bin\mongod.cfg`).
2. Add or uncomment the `replication` section:
   ```yaml
   replication:
     replSetName: rs0
   ```
3. Restart the MongoDB service in PowerShell as Administrator:
   ```powershell
   Restart-Service MongoDB
   ```
4. Initiate the replica set using `mongosh` or Node:
   ```powershell
   mongosh --eval "rs.initiate()"
   ```
5. Update `MONGODB_URI` in `server/.env` if replica set discovery is specified:
   ```env
   MONGODB_URI=mongodb://localhost:27017/workspace?directConnection=true
   ```

*Note:* If running on a standalone MongoDB instance, the server detects the standalone topology and executes safely with an informative warning, but full transactional rollback across multiple documents requires a replica set.

---

## 2. Authentication Tokens Setup

Before testing project endpoints, obtain JWT bearer tokens for both an **Organization Administrator** and a **Standard Employee User**.

### Step A: Seed the Initial Administrator
Run the idempotent seed script from the `server/` directory:
```powershell
$env:ADMIN_EMAIL = "admin@workspace.local"
$env:ADMIN_PASSWORD = "AdminSecurePassword123!"
$env:ADMIN_NAME = "Workspace Administrator"
npm run seed:admin
```

### Step B: Login as Admin to Obtain Admin JWT
- **POST** `http://localhost:5000/api/v1/auth/login`
- **Body (JSON):**
  ```json
  {
    "email": "admin@workspace.local",
    "password": "AdminSecurePassword123!"
  }
  ```
- **Copy `token`** from the response $\rightarrow$ Save as `{{ADMIN_TOKEN}}`.

### Step C: Register Two Standard Users (Managers / Employees)
1. **User 1 (Initial Manager):**
   - **POST** `http://localhost:5000/api/v1/auth/register`
   - **Body (JSON):**
     ```json
     {
       "email": "manager1@workspace.local",
       "password": "ManagerPass123!",
       "fullName": "Alice Johnson"
     }
     ```
   - **Copy `_id`** $\rightarrow$ Save as `{{MANAGER_1_ID}}`.
   - **Copy `token`** $\rightarrow$ Save as `{{MANAGER_1_TOKEN}}`.

2. **User 2 (New Manager):**
   - **POST** `http://localhost:5000/api/v1/auth/register`
   - **Body (JSON):**
     ```json
     {
       "email": "manager2@workspace.local",
       "password": "ManagerPass123!",
       "fullName": "Bob Smith"
     }
     ```
   - **Copy `_id`** $\rightarrow$ Save as `{{MANAGER_2_ID}}`.

3. **User 3 (Non-Member Discoverer):**
   - **POST** `http://localhost:5000/api/v1/auth/register`
   - **Body (JSON):**
     ```json
     {
       "email": "employee@workspace.local",
       "password": "EmployeePass123!",
       "fullName": "Charlie Brown"
     }
     ```
   - **Copy `token`** $\rightarrow$ Save as `{{EMPLOYEE_TOKEN}}`.

---

## 3. Practical Testing Sequence

### 1. Create a New Project (Admin Only)
- **Method:** `POST`
- **URL:** `http://localhost:5000/api/v1/projects`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{ADMIN_TOKEN}}`
- **Body:**
  ```json
  {
    "name": "Apollo Mission",
    "key": "APOLLO",
    "description": "Next generation platform",
    "primaryManagerId": "{{MANAGER_1_ID}}"
  }
  ```
- **Expected Status:** `201 Created`
- **Expected Response:**
  ```json
  {
    "success": true,
    "data": {
      "project": {
        "_id": "<PROJECT_ID>",
        "name": "Apollo Mission",
        "key": "APOLLO",
        "description": "Next generation platform",
        "visibility": "PRIVATE",
        "status": "ACTIVE",
        "createdBy": "<ADMIN_ID>",
        "primaryManagerId": "{{MANAGER_1_ID}}",
        "primaryManager": {
          "_id": "{{MANAGER_1_ID}}",
          "fullName": "Alice Johnson",
          "email": "manager1@workspace.local",
          "avatarUrl": null
        },
        "createdAt": "...",
        "updatedAt": "..."
      }
    },
    "timestamp": "..."
  }
  ```
- **Copy `_id`** $\rightarrow$ Save as `{{PROJECT_ID}}`.

---

### 2. Verify Private Project Invisibility to Non-Members
- **Method:** `GET`
- **URL:** `http://localhost:5000/api/v1/projects/{{PROJECT_ID}}`
- **Headers:**
  - `Authorization: Bearer {{EMPLOYEE_TOKEN}}`
- **Expected Status:** `404 Not Found` (Private projects are completely hidden from non-members).
- **Expected Error:**
  ```json
  {
    "success": false,
    "error": {
      "code": "PROJECT_NOT_FOUND",
      "message": "Project not found"
    },
    "timestamp": "..."
  }
  ```

---

### 3. Update Project Visibility to PUBLIC (Admin Only)
- **Method:** `PATCH`
- **URL:** `http://localhost:5000/api/v1/projects/{{PROJECT_ID}}/visibility`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{ADMIN_TOKEN}}`
- **Body:**
  ```json
  {
    "visibility": "PUBLIC"
  }
  ```
- **Expected Status:** `200 OK`
- **Expected Response:** `project.visibility` is now `"PUBLIC"`.

---

### 4. Non-Member Public Project Discovery
- **Method:** `GET`
- **URL:** `http://localhost:5000/api/v1/projects/{{PROJECT_ID}}`
- **Headers:**
  - `Authorization: Bearer {{EMPLOYEE_TOKEN}}`
- **Expected Status:** `200 OK`
- **Expected Response (Limited Public Metadata Only):**
  ```json
  {
    "success": true,
    "data": {
      "project": {
        "_id": "{{PROJECT_ID}}",
        "name": "Apollo Mission",
        "key": "APOLLO",
        "description": "Next generation platform",
        "visibility": "PUBLIC",
        "primaryManager": {
          "_id": "{{MANAGER_1_ID}}",
          "fullName": "Alice Johnson",
          "avatarUrl": null
        },
        "activeMemberCount": 1,
        "createdAt": "..."
      }
    },
    "timestamp": "..."
  }
  ```

---

### 5. Replace Primary Project Manager (Admin Only)
- **Method:** `PATCH`
- **URL:** `http://localhost:5000/api/v1/projects/{{PROJECT_ID}}/primary-manager`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{ADMIN_TOKEN}}`
- **Body:**
  ```json
  {
    "primaryManagerId": "{{MANAGER_2_ID}}"
  }
  ```
- **Expected Status:** `200 OK`
- **Expected Behavior:**
  - `project.primaryManagerId` updated to `{{MANAGER_2_ID}}`.
  - Previous manager (`Alice Johnson`) automatically demoted to active regular employee (`role: 'MEMBER'`, `status: 'ACTIVE'` in `ProjectMembership`).
  - Incoming manager (`Bob Smith`) granted active `ProjectMembership`.
  - `ActivityLog` of action `'MANAGER_REPLACED'` recorded in MongoDB.

---

### 6. Update Project Details (Admin Only)
- **Method:** `PATCH`
- **URL:** `http://localhost:5000/api/v1/projects/{{PROJECT_ID}}`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{ADMIN_TOKEN}}`
- **Body:**
  ```json
  {
    "name": "Apollo Space Program",
    "description": "Updated project objective description"
  }
  ```
- **Expected Status:** `200 OK`

---

## 4. Negative & Security Test Cases

| Test Case | Method | URL | Token | Payload | Expected Status & Code |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Regular user creates project** | `POST` | `/api/v1/projects` | `{{EMPLOYEE_TOKEN}}` | `{ "name": "Hack", "key": "HACK", "primaryManagerId": "..." }` | `403 FORBIDDEN` |
| **Duplicate project key** | `POST` | `/api/v1/projects` | `{{ADMIN_TOKEN}}` | `{ "name": "Dup", "key": "APOLLO", "primaryManagerId": "..." }` | `409 DUPLICATE_KEY` |
| **Invalid project key format** | `POST` | `/api/v1/projects` | `{{ADMIN_TOKEN}}` | `{ "name": "Bad", "key": "apollo_1!", "primaryManagerId": "..." }` | `400 VALIDATION_ERROR` |
| **Assign nonexistent manager** | `PATCH` | `/api/v1/projects/{{PROJECT_ID}}/primary-manager` | `{{ADMIN_TOKEN}}` | `{ "primaryManagerId": "507f1f77bcf86cd799439011" }` | `404 USER_NOT_FOUND` |
| **Assign same manager again** | `PATCH` | `/api/v1/projects/{{PROJECT_ID}}/primary-manager` | `{{ADMIN_TOKEN}}` | `{ "primaryManagerId": "{{MANAGER_2_ID}}" }` | `400 ALREADY_PRIMARY_MANAGER` |
| **Non-admin changes visibility** | `PATCH` | `/api/v1/projects/{{PROJECT_ID}}/visibility` | `{{MANAGER_1_TOKEN}}` | `{ "visibility": "PRIVATE" }` | `403 FORBIDDEN` |
| **Unauthenticated request** | `GET` | `/api/v1/projects` | *(None)* | *(None)* | `401 UNAUTHORIZED` |
