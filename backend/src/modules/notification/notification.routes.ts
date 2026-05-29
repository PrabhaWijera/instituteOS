import { Router } from 'express';
import * as notificationController from './notification.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, notificationController.getNotifications);
router.patch('/:id/read', authenticate, notificationController.markRead);
router.patch('/read-all', authenticate, notificationController.markAllRead);

export default router;
