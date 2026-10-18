import { Request, Response, NextFunction } from 'express';
import { userAdministrationService } from '../services/userAdministration.service';

/** Must run after requireAuth. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const username = req.user?.username;

  if (!username || !userAdministrationService.isAdmin(username)) {
    res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
    return;
  }

  next();
}
