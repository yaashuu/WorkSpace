import { Router } from 'express';
import { getMe } from '../controllers/authController';
import { getEligibleManagers } from '../controllers/userController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/me', authenticate, getMe);
router.get('/eligible-managers', authenticate, requireAdmin, getEligibleManagers);

export { router as userRouter };
export default router;
