import { Router } from 'express';
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  updateVisibility,
  replacePrimaryManager,
} from '../controllers/projectController';
import {
  submitJoinRequest,
  listProjectJoinRequests,
} from '../controllers/joinRequestController';
import {
  listProjectMembers,
  removeProjectMember,
} from '../controllers/membershipController';
import {
  createTask,
  getProjectTasks,
} from '../controllers/taskController';
import { getProjectActivityLogs } from '../controllers/activityController';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  requireProjectAccess,
  requireProjectManager,
} from '../middleware/projectAuth';

const router = Router();

// All project endpoints require valid bearer JWT authentication
router.use(authenticate);

// List projects (Admin: all; PM/Member: joined; Non-member: public metadata)
router.get('/', getProjects);

// Create project (Admin only)
router.post('/', requireAdmin, createProject);

// Detailed project view or public project metadata
router.get('/:id', getProjectById);

// Update general project details (Admin only, strictly allowlisted fields)
router.patch('/:id', requireAdmin, updateProject);

// Update project visibility (Admin only)
router.patch('/:id/visibility', requireAdmin, updateVisibility);

// Reassign primary manager with automated member demotion (Admin only)
router.patch('/:id/primary-manager', requireAdmin, replacePrimaryManager);

// Memberships
router.get('/:id/members', listProjectMembers);
router.delete('/:id/members/:userId', removeProjectMember);

// Join requests
router.post('/:id/join-requests', submitJoinRequest);
router.get('/:id/join-requests', listProjectJoinRequests);

// Tasks (Kanban Board)
router.get('/:id/tasks', requireProjectAccess, getProjectTasks);
router.post('/:id/tasks', requireProjectManager, createTask);

// Activity History Feed
router.get('/:id/activity', requireProjectAccess, getProjectActivityLogs);
router.get('/:id/activity-logs', requireProjectAccess, getProjectActivityLogs);

export { router as projectRouter };
export default router;
