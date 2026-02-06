import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { getDatabase } from '../config/database';
import type { JwtPayload, SurveyParticipant } from '../types/user.types';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      participant?: SurveyParticipant;
    }
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  // Try JWT first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      req.user = authService.verifyToken(token);
      return next();
    } catch {
      // Token invalid, try anonymous auth
    }
  }

  // Try cookie token
  const cookieToken = req.cookies?.token;
  if (cookieToken) {
    try {
      req.user = authService.verifyToken(cookieToken);
      return next();
    } catch {
      // Token invalid, try anonymous auth
    }
  }

  // Try anonymous participant token
  const participantToken = req.headers['x-participant-token'] as string | undefined;
  const surveyId = req.params.id || (req.headers['x-survey-id'] as string | undefined);

  if (participantToken && surveyId) {
    const database = getDatabase();
    const participant = database
      .prepare(
        'SELECT * FROM survey_participants WHERE survey_id = ? AND anonymous_token = ?'
      )
      .get(surveyId, participantToken) as SurveyParticipant | undefined;

    if (participant) {
      req.participant = participant;
      return next();
    }
  }

  res.status(401).json({ error: 'Authentication required' });
}
