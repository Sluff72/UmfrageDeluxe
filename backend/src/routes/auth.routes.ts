import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { authLoginLimiter, authRegisterLimiter } from '../middleware/rateLimiter';
import { registerSchema, loginSchema } from '../validators/auth.schema';

const authRouter = Router();

authRouter.post(
  '/auth/register',
  authRegisterLimiter,
  validate(registerSchema),
  (req, res, next) => authController.register(req, res, next)
);

authRouter.post(
  '/auth/login',
  authLoginLimiter,
  validate(loginSchema),
  (req, res, next) => authController.login(req, res, next)
);

authRouter.get(
  '/auth/me',
  requireAuth,
  (req, res, next) => authController.getCurrentUser(req, res, next)
);

authRouter.post(
  '/auth/logout',
  (req, res) => authController.logout(req, res)
);

export { authRouter };
