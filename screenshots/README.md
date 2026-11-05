# WorkSpace — Application Screenshots Directory

This directory is designated for high-resolution, unedited visual screenshots of the WorkSpace application.

> [!NOTE]
> WorkSpace strictly prohibits fabricated or placeholder mockups. When capturing screenshots, run the application locally with seeded demo data (`npm run seed:demo` in `server/`) and capture genuine browser views.

---

## Recommended Screenshots Checklist

| Recommended Filename | Screen / Interface | Description & Key UI Elements to Capture | Recommended Resolution |
|---|---|---|---|
| `01-landing-page.png` | Public SaaS Landing Page | Hero section, value proposition, navigation header, and features overview. | 1920 × 1080 |
| `02-login-page.png` | Authentication / Sign In | Minimalist centered authentication card with branded header and validation states. | 1920 × 1080 |
| `03-dashboard.png` | Workspace Dashboard | KPI summary metrics (Active Projects, Open Tasks, Overdue Tasks, Completed Tasks), Project Progress bars, and Tasks Requiring Attention. | 1920 × 1080 |
| `04-project-directory.png` | Projects Directory | Grid of accessible projects, visibility indicators (Public / Private), member counts, and project manager badges. | 1920 × 1080 |
| `05-project-details.png` | Project Overview & Team | Project metadata, active team member roster, join requests queue, and invite link generation modal. | 1920 × 1080 |
| `06-kanban-board.png` | Kanban Sprint Board | 5-column workflow (`BACKLOG`, `TODO`, `IN_PROGRESS`, `TESTING`, `DONE`), priority tags, assignee avatars, and due date flags. | 1920 × 1080 |
| `07-chat.png` | Real-Time Chat System | Project group conversation channel and isolated 1-on-1 Admin–PM direct messaging tab. | 1920 × 1080 |
| `08-notifications.png` | Notifications & Activity | Real-time notification center, unread indicators, and audit activity stream. | 1920 × 1080 |

---

## Capturing Instructions

1. Start MongoDB:
   ```bash
   mongod
   ```
2. Seed the development database with demo data:
   ```bash
   cd server
   npm run seed:demo
   ```
3. Start the backend and frontend:
   ```bash
   # Terminal 1: Server
   cd server
   npm run dev

   # Terminal 2: Client
   cd client
   npm run dev
   ```
4. Open `http://localhost:5173` in a Chromium-based browser at 100% zoom (1920 × 1080).
5. Log in using a demo persona (e.g. `pm.sarah@demo.workspace.com` or `admin@workspace.local` as configured in `server/.env`).
6. Save the captured PNG files directly into this directory using the filenames listed above.
