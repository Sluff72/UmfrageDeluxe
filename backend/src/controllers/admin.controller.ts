import { Request, Response, NextFunction } from 'express';
import { userAdministrationService } from '../services/userAdministration.service';

export class AdminController {
  listUsers(_req: Request, res: Response, next: NextFunction): void {
    try {
      const users = userAdministrationService.listUsers();
      res.json({ users });
    } catch (error) {
      next(error);
    }
  }

  unlockUser(req: Request, res: Response, next: NextFunction): void {
    try {
      const userId = req.params.userId as string;
      const user = userAdministrationService.unlockUser(userId);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.userId as string;
      const { user, temporaryPassword } = await userAdministrationService.resetPassword(userId);
      res.json({ user, temporaryPassword });
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
