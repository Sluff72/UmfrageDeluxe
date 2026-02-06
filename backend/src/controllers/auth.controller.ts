import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { NotFoundError } from '../utils/errors';
import type { RegisterInput, LoginInput } from '../validators/auth.schema';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: RegisterInput = req.body;
      const user = await authService.registerUser(input);
      res.status(201).json({ user });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: LoginInput = req.body;
      const { user, token } = await authService.loginUser(input);

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      res.json({ user, token });
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.sub;
      const user = authService.getUserById(userId);

      if (!user) {
        throw new NotFoundError('User');
      }

      res.json({ user });
    } catch (error) {
      next(error);
    }
  }

  async logout(_req: Request, res: Response): Promise<void> {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
  }
}

export const authController = new AuthController();
