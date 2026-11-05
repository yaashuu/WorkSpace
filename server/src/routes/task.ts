import { Router } from 'express';
import {
  getTaskById,
  updateTask,
  moveTaskStatus,
  deleteTask,
} from '../controllers/taskController';
import {
  listTaskComments,
  createTaskComment,
} from '../controllers/commentController';
import { authenticate } from '../middleware/auth';
import {
  requireTaskAccess,
  requireTaskProjectManager,
  requireTaskAssigneeOrManager,
} from '../middleware/projectAuth';

const router = Router();

// All task routes require bearer JWT authentication
router.use(authenticate);

// Task CRUD and status transitions
router.get('/:id', requireTaskAccess, getTaskById);
router.patch('/:id', requireTaskProjectManager, updateTask);
router.patch('/:id/status', requireTaskAssigneeOrManager, moveTaskStatus);
router.delete('/:id', requireTaskProjectManager, deleteTask);

// Task comments
router.get('/:id/comments', requireTaskAccess, listTaskComments);
router.post('/:id/comments', requireTaskAccess, createTaskComment);

export { router as taskRouter };
export default router;
