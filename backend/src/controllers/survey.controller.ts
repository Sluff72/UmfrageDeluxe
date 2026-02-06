import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { surveyService } from '../services/survey.service';
import type { CreateSurveySchemaInput, UpdateSurveySchemaInput } from '../validators/survey.schema';

export class SurveyController {
  async createSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: CreateSurveySchemaInput = req.body;
      const userId = req.user!.sub;

      const survey = surveyService.createSurvey(input, userId);
      res.status(201).json({ survey });
    } catch (error) {
      next(error);
    }
  }

  async listSurveys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.sub;
      const surveys = surveyService.listSurveysForUser(userId);
      res.json({ surveys });
    } catch (error) {
      next(error);
    }
  }

  async getSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const survey = surveyService.getSurveyById(surveyId);
      const participants = surveyService.getParticipantsForSurvey(surveyId);

      res.json({ survey, participants });
    } catch (error) {
      next(error);
    }
  }

  async updateSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const input: UpdateSurveySchemaInput = req.body;
      const userId = req.user!.sub;

      const survey = surveyService.updateSurvey(surveyId, input, userId);
      res.json({ survey });
    } catch (error) {
      next(error);
    }
  }

  async deleteSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const userId = req.user!.sub;

      surveyService.deleteSurvey(surveyId, userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async archiveSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const userId = req.user!.sub;

      const survey = surveyService.archiveSurvey(surveyId, userId);
      res.json({ survey });
    } catch (error) {
      next(error);
    }
  }

  async joinSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inviteCode = req.params.inviteCode as string;
      const displayName: string | undefined = req.body.displayName;

      const userId = req.user?.sub ?? null;
      const anonymousName = displayName ?? null;
      const anonymousToken = userId ? null : crypto.randomBytes(32).toString('hex');

      const { survey, participant } = surveyService.joinSurveyByInviteCode(
        inviteCode,
        userId,
        anonymousName,
        anonymousToken
      );

      res.json({
        survey,
        participant: {
          id: participant.id,
          role: participant.role,
          anonymousToken: participant.anonymous_token,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const surveyController = new SurveyController();
