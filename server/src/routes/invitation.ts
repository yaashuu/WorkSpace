import { Router } from 'express';
import {
  createInvitation,
  acceptInvitation,
} from '../controllers/invitationController';
import { authenticate } from '../middleware/auth';
import { invitationLimiter } from '../middleware/rateLimiter';

const router = Router();

router.use(authenticate);

// Generate invitation link (Admin or Primary PM)
router.post('/', invitationLimiter, createInvitation);

// Unified acceptance endpoint for authenticated users
router.post('/accept', invitationLimiter, acceptInvitation);

export { router as invitationRouter };
export default router;
