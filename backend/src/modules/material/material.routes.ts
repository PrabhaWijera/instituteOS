import { Router } from 'express';
import multer from 'multer';
import * as materialController from './material.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

router.post('/class/:classId', authenticate, requireRole('TEACHER'), upload.single('file'), materialController.create);
router.get('/class/:classId', authenticate, materialController.getByClass);
router.patch('/:id/visibility', authenticate, requireRole('TEACHER', 'INSTITUTE_ADMIN'), materialController.toggleVisibility);
router.delete('/:id', authenticate, requireRole('TEACHER', 'INSTITUTE_ADMIN'), materialController.remove);

export default router;
