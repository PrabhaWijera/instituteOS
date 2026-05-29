import { Router } from 'express';
import * as aiController from './ai.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { chatSchema } from './ai.schema';
import { aiUserLimiter } from '../../middleware/rateLimit.middleware';

const router = Router();

// AI chat is rate-limited per user (20 req/min) to prevent Groq abuse
router.post('/chat', authenticate, requireRole('STUDENT'), aiUserLimiter, validate(chatSchema), aiController.chat);
router.get('/history', authenticate, requireRole('STUDENT'), aiController.getHistory);
router.delete('/history', authenticate, requireRole('STUDENT'), aiController.clearHistory);

export default router;
