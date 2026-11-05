import { Router } from 'express';
import {
  approveJoinRequest,
  rejectJoinRequest,
} from '../controllers/joinRequestController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Approve pending join request atomically
router.patch('/:id/approve', approveJoinRequest);

// Reject pending join request atomically
router.patch('/:id/reject', rejectJoinRequest);

export { router as joinRequestRouter };
export default router;
