import { Router } from 'express';
import multer from 'multer';
import * as authController from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { loginLimiter } from '../../middleware/rateLimit.middleware';
import {
  registerOwnerSchema,
  loginSchema,
  acceptInviteSchema,
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema';
import { auditLog } from '../../middleware/audit.middleware';
import { validateImageUpload } from '../../middleware/fileValidation.middleware';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

router.post('/register/owner', validate(registerOwnerSchema), auditLog('auth.register_owner'), authController.registerOwner);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/invite/:token', authController.getInvite);
router.post('/invite/accept', validate(acceptInviteSchema), authController.acceptInvite);
router.get('/me', authenticate, authController.getMe);
router.patch('/profile', authenticate, validate(updateProfileSchema), authController.updateProfile);
router.post('/profile/image', authenticate, upload.single('image'), validateImageUpload, authController.uploadProfileImage);
router.post('/password/change', authenticate, validate(changePasswordSchema), auditLog('auth.password_change'), authController.changePassword);
router.post('/password/forgot', loginLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/password/reset', validate(resetPasswordSchema), auditLog('auth.password_reset'), authController.resetPassword);

export default router;
