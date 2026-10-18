import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { NotFoundError } from '../utils/errors';
import type { RegisterInput, LoginInput, ChangePasswordInput } from '../validators/auth.schema';

const AUTH_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

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
      this.setAuthCookie(res, token);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: ChangePasswordInput = req.body;
      const { user, token } = await authService.changePassword(input);
      this.setAuthCookie(res, token);
      res.json({ user });
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

  private setAuthCookie(res: Response, token: string): void {
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: AUTH_COOKIE_MAX_AGE_MS,
    });
  }

  async logout(_req: Request, res: Response): Promise<void> {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
  }
}

export const authController = new AuthController();
