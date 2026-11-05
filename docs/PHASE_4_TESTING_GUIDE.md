# WorkSpace — Phase 4: Postman Manual Testing Guide

This guide details step-by-step instructions for testing the **Phase 4 Member Onboarding: Invitations and Project Join Requests** endpoints in Postman, cURL, or terminal commands.

---

## 1. Setup & Environment Variables

Ensure your backend server is running from `server/`:
```powershell
cd server
npm run dev
```

Base URL: `http://localhost:5000/api/v1`

### Required User Tokens & IDs
Ensure you have obtained:
1. `{{ADMIN_TOKEN}}`: Organization Administrator JWT.
2. `{{PM_TOKEN}}`: Primary Project Manager JWT for the test project.
3. `{{EMPLOYEE_TOKEN}}`: Standard registered user (non-member) JWT.
4. `{{EMPLOYEE_EMAIL}}`: Email address of the standard employee.
5. `{{PUBLIC_PROJECT_ID}}`: A project with `visibility: 'PUBLIC'`.
6. `{{PRIVATE_PROJECT_ID}}`: A project with `visibility: 'PRIVATE'`.

---

## 2. API Endpoints Directory

### A. Invitations (`/api/v1/invitations`)

#### 1. Generate General Invitation Link (Admin or PM)
- **Method:** `POST`
- **URL:** `http://localhost:5000/api/v1/invitations`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{PM_TOKEN}}`
- **Body:**
  ```json
  {
    "projectId": "{{PRIVATE_PROJECT_ID}}",
    "maxUses": 5,
    "expiresInDays": 7
  }
  ```
- **Expected Status:** `201 Created`
- **Expected Response:**
  ```json
  {
    "success": true,
    "data": {
      "invitation": {
        "_id": "<INVITATION_ID>",
        "projectId": "{{PRIVATE_PROJECT_ID}}",
        "invitedEmail": null,
        "expiresAt": "...",
        "maxUses": 5,
        "usedCount": 0,
        "status": "PENDING",
        "createdAt": "..."
      },
      "token": "<RAW_TOKEN_HEX_64_CHARS>",
      "inviteLink": "/invite?token=<RAW_TOKEN_HEX_64_CHARS>"
    },
    "timestamp": "..."
  }
  ```
- **Save `token`** as `{{GENERAL_INVITE_TOKEN}}`.

#### 2. Generate Email-Restricted Invitation Link (Admin or PM)
- **Method:** `POST`
- **URL:** `http://localhost:5000/api/v1/invitations`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{PM_TOKEN}}`
- **Body:**
  ```json
  {
    "projectId": "{{PRIVATE_PROJECT_ID}}",
    "invitedEmail": "employee@workspace.local",
    "maxUses": 1,
    "expiresInDays": 3
  }
  ```
- **Expected Status:** `201 Created`
- **Save `token`** as `{{RESTRICTED_INVITE_TOKEN}}`.

#### 3. Accept Invitation (Authenticated User)
- **Method:** `POST`
- **URL:** `http://localhost:5000/api/v1/invitations/accept`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{EMPLOYEE_TOKEN}}`
- **Body:**
  ```json
  {
    "token": "{{GENERAL_INVITE_TOKEN}}"
  }
  ```
- **Expected Status:** `200 OK`
- **Expected Response:**
  ```json
  {
    "success": true,
    "data": {
      "message": "Successfully joined project via invitation",
      "project": {
        "_id": "{{PRIVATE_PROJECT_ID}}",
        "name": "...",
        "key": "...",
        "visibility": "PRIVATE",
        "status": "ACTIVE"
      },
      "membership": {
        "_id": "<MEMBERSHIP_ID>",
        "role": "MEMBER",
        "status": "ACTIVE",
        "joinedAt": "..."
      }
    },
    "timestamp": "..."
  }
  ```

---

### B. Project Join Requests (`/api/v1/projects/:id/join-requests` & `/api/v1/join-requests/:id`)

#### 1. Submit Join Request for a PUBLIC Project
- **Method:** `POST`
- **URL:** `http://localhost:5000/api/v1/projects/{{PUBLIC_PROJECT_ID}}/join-requests`
- **Headers:**
  - `Authorization: Bearer {{EMPLOYEE_TOKEN}}`
- **Expected Status:** `201 Created`
- **Expected Response:**
  ```json
  {
    "success": true,
    "data": {
      "joinRequest": {
        "_id": "<JOIN_REQUEST_ID>",
        "projectId": "{{PUBLIC_PROJECT_ID}}",
        "userId": "<EMPLOYEE_ID>",
        "status": "PENDING",
        "reviewedBy": null,
        "reviewedAt": null,
        "rejectionReason": null,
        "createdAt": "..."
      }
    },
    "timestamp": "..."
  }
  ```
- **Save `_id`** as `{{JOIN_REQUEST_ID}}`.

#### 2. List Pending Join Requests (Admin or PM)
- **Method:** `GET`
- **URL:** `http://localhost:5000/api/v1/projects/{{PUBLIC_PROJECT_ID}}/join-requests`
- **Headers:**
  - `Authorization: Bearer {{PM_TOKEN}}`
- **Expected Status:** `200 OK`
- **Expected Response:**
  ```json
  {
    "success": true,
    "data": {
      "joinRequests": [
        {
          "_id": "{{JOIN_REQUEST_ID}}",
          "projectId": "{{PUBLIC_PROJECT_ID}}",
          "userId": {
            "_id": "<EMPLOYEE_ID>",
            "fullName": "...",
            "email": "..."
          },
          "status": "PENDING",
          "createdAt": "..."
        }
      ]
    },
    "timestamp": "..."
  }
  ```

#### 3. Approve Join Request (Admin or PM)
- **Method:** `PATCH`
- **URL:** `http://localhost:5000/api/v1/join-requests/{{JOIN_REQUEST_ID}}/approve`
- **Headers:**
  - `Authorization: Bearer {{PM_TOKEN}}`
- **Expected Status:** `200 OK`
- **Result:** Requester is granted an active `ProjectMembership` in the project.

#### 4. Reject Join Request (Admin or PM)
- **Method:** `PATCH`
- **URL:** `http://localhost:5000/api/v1/join-requests/{{JOIN_REQUEST_ID}}/reject`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{PM_TOKEN}}`
- **Body:**
  ```json
  {
    "rejectionReason": "Project team has reached capacity"
  }
  ```
- **Expected Status:** `200 OK`
- **Result:** Status set to `REJECTED`, rejectionReason recorded.

---

### C. Project Memberships (`/api/v1/projects/:id/members`)

#### 1. List Active Project Members
- **Method:** `GET`
- **URL:** `http://localhost:5000/api/v1/projects/{{PUBLIC_PROJECT_ID}}/members`
- **Headers:**
  - `Authorization: Bearer {{PM_TOKEN}}` (or any active member)
- **Expected Status:** `200 OK`
- **Expected Response:**
  ```json
  {
    "success": true,
    "data": {
      "members": [
        {
          "_id": "<MEMBERSHIP_ID>",
          "user": {
            "_id": "...",
            "fullName": "...",
            "email": "...",
            "globalRole": "USER"
          },
          "role": "MEMBER",
          "status": "ACTIVE",
          "isPrimaryManager": true,
          "joinedAt": "..."
        }
      ],
      "total": 1
    },
    "timestamp": "..."
  }
  ```

#### 2. Remove Member from Project (Admin or PM)
- **Method:** `DELETE`
- **URL:** `http://localhost:5000/api/v1/projects/{{PUBLIC_PROJECT_ID}}/members/<USER_ID>`
- **Headers:**
  - `Authorization: Bearer {{PM_TOKEN}}`
- **Expected Status:** `200 OK`
- **Result:** User's `ProjectMembership` status updated to `REVOKED`. Primary manager cannot be removed.

---

## 3. Negative and Security Test Cases

| Scenario | Endpoint | Token | Condition / Input | Expected Status & Code |
| :--- | :--- | :--- | :--- | :--- |
| **Email Mismatch on Restricted Invite** | `POST /invitations/accept` | `{{OTHER_USER_TOKEN}}` | Token restricted to `employee@workspace.local` | `403 FORBIDDEN_EMAIL_MISMATCH` |
| **Exhausted Invitation** | `POST /invitations/accept` | `{{EMPLOYEE_TOKEN}}` | Single-use invite already consumed | `410 INVITATION_EXHAUSTED` |
| **Revoked Invitation** | `POST /invitations/accept` | `{{EMPLOYEE_TOKEN}}` | Status set to `REVOKED` | `410 INVITATION_REVOKED` |
| **Expired Invitation** | `POST /invitations/accept` | `{{EMPLOYEE_TOKEN}}` | `expiresAt` in the past | `410 INVITATION_EXPIRED` |
| **Join Request on PRIVATE Project** | `POST /projects/:id/join-requests` | `{{EMPLOYEE_TOKEN}}` | Private project ID | `404 PROJECT_NOT_FOUND` |
| **Duplicate Pending Join Request** | `POST /projects/:id/join-requests` | `{{EMPLOYEE_TOKEN}}` | Request already pending | `409 DUPLICATE_PENDING_REQUEST` |
| **Deciding Already-Resolved Request** | `PATCH /join-requests/:id/approve` | `{{PM_TOKEN}}` | Request already APPROVED/REJECTED | `409 JOIN_REQUEST_ALREADY_RESOLVED` |
| **Unauthorized Invitation Generation** | `POST /invitations` | `{{EMPLOYEE_TOKEN}}` | Non-manager user | `403 FORBIDDEN` |
| **Remove Primary PM** | `DELETE /projects/:id/members/:userId` | `{{ADMIN_TOKEN}}` | Targeting primary manager | `400 CANNOT_REMOVE_PRIMARY_MANAGER` |
