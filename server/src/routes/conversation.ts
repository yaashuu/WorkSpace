import { Router } from 'express';
import {
  getProjectConversation,
  getAdminPmConversation,
  getConversationMessages,
  sendMessage,
} from '../controllers/conversationController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All conversation endpoints require bearer JWT authentication
router.use(authenticate);

// Fetch or initialize project group conversation
router.get('/project/:projectId', getProjectConversation);

// Fetch or initialize isolated Admin–PM DM
router.get('/admin-pm/:managerId', getAdminPmConversation);

// Message history retrieval and message submission
router.get('/:id/messages', getConversationMessages);
router.post('/:id/messages', sendMessage);

export { router as conversationRouter };
export default router;
