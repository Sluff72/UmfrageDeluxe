import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';

const adminRouter = Router();

adminRouter.get(
  '/admin/users',
  requireAuth,
  requireAdmin,
  (req, res, next) => adminController.listUsers(req, res, next)
);

adminRouter.post(
  '/admin/users/:userId/unlock',
  requireAuth,
  requireAdmin,
  (req, res, next) => adminController.unlockUser(req, res, next)
);

export { adminRouter };
