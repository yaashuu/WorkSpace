# WorkSpace — Local Setup, Installation & Developer Guide

This guide walks through configuring, installing, running, and verifying **WorkSpace** in your local development environment.

The authoritative project specification is maintained in [`PROJECT_SPEC.md`](PROJECT_SPEC.md). For demo data details, refer to [`DEMO_DATA_GUIDE.md`](DEMO_DATA_GUIDE.md).

---

## 1. Prerequisites

Before installing WorkSpace, ensure your development machine has the following tools installed:

| Requirement | Minimum Version | Recommended Version | Verification Command |
|---|---|---|---|
| **Node.js** | 18.x LTS | 20.x LTS or 22.x | `node -v` |
| **npm** | 9.x | 10.x+ | `npm -v` |
| **MongoDB Community** | 6.0+ | 7.0+ | `mongod --version` |

---

## 2. Repository Cloning & Dependency Installation

WorkSpace is structured as a modular repository with independent `client` and `server` directories:

### Step 1: Install Backend Dependencies
```bash
cd server
npm install
```

### Step 2: Install Frontend Dependencies
```bash
cd ../client
npm install
```

---

## 3. Environment Variable Configuration

Both the frontend and backend require environment files created from their respective `.env.example` templates.

### 3.1 Backend Configuration (`server/.env`)

In the `server/` directory, copy `.env.example` to `.env`:

```bash
cd server
cp .env.example .env
```

| Variable Name | Required | Default / Example | Purpose & Security Invariants |
|---|---|---|---|
| `PORT` | Optional | `5000` | HTTP port on which the Express and Socket.IO server listens. |
| `NODE_ENV` | Optional | `development` | Environment mode (`development`, `production`, `test`). |
| `MONGODB_URI` | **Required** | `mongodb://localhost:27017/workspace` | Primary development database connection URI. |
| `MONGODB_TEST_URI` | **Required for Tests** | `mongodb://localhost:27017/workspace_test` | Dedicated test database URI. **Must end with `_test`**; never points to dev database. |
| `JWT_SECRET` | **Required** | `your_development_jwt_secret_min_16_chars` | Secret key used to sign JWT tokens. Minimum 16 characters in dev; **minimum 32 characters in production**. |
| `JWT_EXPIRES_IN` | Optional | `7d` | Token lifetime duration (e.g. `24h`, `7d`). |
| `CORS_ORIGIN` | Optional | `http://localhost:5173,http://localhost:5000` | Comma-separated list of allowed origins. Wildcard `*` is strictly forbidden in production. |
| `BODY_LIMIT` | Optional | `1mb` | Maximum incoming JSON request payload size. |
| `RATE_LIMIT_LOGIN_MAX` | Optional | `10` | Maximum login attempts per 15-minute window per IP. |
| `RATE_LIMIT_REGISTER_MAX` | Optional | `10` | Maximum registration attempts per 15-minute window per IP. |
| `RATE_LIMIT_API_MAX` | Optional | `300` | Maximum general API calls per 15-minute window per IP. |
| `ADMIN_EMAIL` | Optional | `admin@workspace.local` | Email used by `npm run seed:admin` to bootstrap the initial Administrator. |
| `ADMIN_PASSWORD` | Optional | `AdminPassword123!` | Password used by `npm run seed:admin` (minimum 8 characters, letters, numbers, symbols). |
| `ADMIN_NAME` | Optional | `Workspace Administrator` | Display name for the initial Administrator. |

### 3.2 Frontend Configuration (`client/.env`)

In the `client/` directory, copy `.env.example` to `.env`:

```bash
cd client
cp .env.example .env
```

| Variable Name | Required | Default | Purpose |
|---|---|---|---|
| `VITE_API_URL` | Optional | `http://localhost:5000` | Base URL of the running backend server. |

---

## 4. MongoDB Deployment: Standalone vs. Replica Set

WorkSpace is fully tested and functional with a standard **standalone MongoDB** instance for local development.

```bash
# Start standalone MongoDB locally
mongod --dbpath /path/to/data/db
```

### How WorkSpace Handles Database Deployments:
- **Standalone Instance (Default Local Dev):** Executes multi-document operations sequentially and uses application-level compensating actions (e.g. rolling back invitation counts) if a downstream step fails.
- **Replica Set / MongoDB Atlas (Production Recommended):** WorkSpace automatically detects replica sets and activates native multi-document ACID transactions (`session.startTransaction()`).

---

## 5. Database Bootstrapping & Seeding

WorkSpace provides specialized CLI scripts to initialize the database:

### 5.1 Bootstrap Initial Organization Administrator
The first Administrator cannot be registered via public web forms. Run:

```bash
cd server
npm run seed:admin
```
This reads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME` from `server/.env`, validates the password complexity, hashes the credentials with bcrypt (12 rounds), and creates the account idempotently.

### 5.2 Seed Realistic Demo Data
To populate the database with realistic projects, team members, Kanban tasks, chat threads, and notifications:

```bash
cd server
npm run seed:demo
```

### 5.3 Verify Demo Data Integrity
To run automated referential-integrity and idempotency verification:

```bash
cd server
npm run verify:demo
```

For complete credentials and personas, see [`DEMO_DATA_GUIDE.md`](DEMO_DATA_GUIDE.md).

---

## 6. Running the Application

### 6.1 Development Mode (Hot-Reloading)

Open two terminal windows:

#### Terminal 1 — Backend API Server:
```bash
cd server
npm run dev
```
*Server starts on `http://localhost:5000`. Health check available at `http://localhost:5000/api/v1/health`.*

#### Terminal 2 — Frontend Single Page App:
```bash
cd client
npm run dev
```
*Vite dev server starts on `http://localhost:5173`.*

Open your browser and navigate to `http://localhost:5173`.

---

### 6.2 Production Build Verification

To compile and verify production builds locally:

#### Build Backend:
```bash
cd server
npm run build
npm start
```

#### Build Frontend:
```bash
cd client
npm run build
npm run preview
```

---

## 7. Automated Testing Suite

WorkSpace includes extensive automated tests verifying security hardening, access controls, database isolation, and concurrency.

### Database Safety Guard for Tests
All automated test scripts connect exclusively to `MONGODB_TEST_URI` and run a strict pre-flight safety check. If the test database does not end with `_test`, execution is aborted immediately to protect development data.

### Running Test Suites:

| Command | Focus Area |
|---|---|
| `npm run test` | Phase 2 Verification Suite (Authentication, JWT, Admin Seeding) |
| `npm run test:security` | Helmet headers, CORS policies, JWT cryptographic locking, and rate limiting |
| `npm run test:isolation` | Database safety guard and environment isolation verification |
| `npm run test:authz` | Broken Object Level Authorization (BOLA) and permission scoping checks |
| `npm run test:validation` | Zod runtime schema validation and rejection tests |
| `npm run test:concurrency` | Kanban Optimistic Concurrency Control (OCC) and race condition tests |
| `npm run test:socket-security` | WebSocket handshake auth and unauthorized room join protection |
| `npm run test:integration` | End-to-end user workflows (Project creation → Invite → Kanban → Chat) |

---

## 8. Troubleshooting & Common Issues

### 1. Port Conflicts (`EADDRINUSE: 5000`)
- **Cause:** Another process is running on port 5000.
- **Solution:** Change `PORT=5001` in `server/.env` and update `VITE_API_URL=http://localhost:5001` in `client/.env`.

### 2. Database Safety Guard Violation during Tests
- **Error:** `CRITICAL_SAFETY_GUARD_BLOCK: Target database is not an isolated test database.`
- **Cause:** `MONGODB_TEST_URI` is missing or does not end with `_test`.
- **Solution:** Set `MONGODB_TEST_URI=mongodb://localhost:27017/workspace_test` in `server/.env`.

### 3. Rate Limit Exceeded (`HTTP 429`)
- **Cause:** Exceeded allowable attempts within the 15-minute sliding window during manual testing.
- **Solution:** Temporarily increase `RATE_LIMIT_LOGIN_MAX=100` in `server/.env` for local testing.
