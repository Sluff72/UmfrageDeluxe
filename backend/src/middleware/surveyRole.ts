import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../config/database';
import type { SurveyRole, SurveyParticipant } from '../types/user.types';

declare global {
  namespace Express {
    interface Request {
      surveyParticipant?: SurveyParticipant;
    }
  }
}

export function requireRole(...allowedRoles: SurveyRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const surveyId = req.params.id as string | undefined;

    if (!surveyId) {
      res.status(400).json({ error: 'Survey ID is required' });
      return;
    }

    const database = getDatabase();
    let participant: SurveyParticipant | undefined;

    // If the user is authenticated via JWT, look up by user_id
    if (req.user) {
      participant = database
        .prepare(
          'SELECT * FROM survey_participants WHERE survey_id = ? AND user_id = ?'
        )
        .get(surveyId, req.user.sub) as SurveyParticipant | undefined;
    }

    // If the user is authenticated via anonymous token, use req.participant
    if (!participant && req.participant) {
      participant = req.participant;
    }

    if (!participant) {
      res.status(403).json({ error: 'You are not a participant of this survey' });
      return;
    }

    if (!allowedRoles.includes(participant.role)) {
      res.status(403).json({ error: 'Insufficient permissions for this action' });
      return;
    }

    req.surveyParticipant = participant;
    next();
  };
}
