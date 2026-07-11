import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { surveyService } from '../services/survey.service';
import { stateMachineService } from '../services/stateMachine.service';
import { getSocketServer } from '../socket/index';
import { SOCKET_EVENTS, buildSurveyRoomName } from '../socket/events';
import type {
  CreateSurveySchemaInput,
  UpdateSurveySchemaInput,
  UpdateParticipantRoleSchemaInput,
  BulkImportSurveysSchemaInput,
} from '../validators/survey.schema';

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

  async bulkImportSurveys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { surveys }: BulkImportSurveysSchemaInput = req.body;
      const userId = req.user!.sub;

      const created = surveyService.bulkImportSurveys(surveys, userId);
      res.status(201).json({ surveys: created, count: created.length });
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

      // Broadcast so other clients (e.g. participants looking at the details
      // panel) see the new configuration without a manual reload.
      try {
        const io = getSocketServer();
        io.to(buildSurveyRoomName(surveyId)).emit(SOCKET_EVENTS.SURVEY_UPDATED, { survey });
      } catch {
        // Socket.IO not initialized (e.g. in tests) – skip broadcast
      }

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

  async duplicateSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const userId = req.user!.sub;

      const survey = surveyService.duplicateSurvey(surveyId, userId);
      res.status(201).json({ survey });
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
  async transitionSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const { targetStatus } = req.body;
      const userId = req.user!.sub;

      const result = stateMachineService.transitionSurvey(surveyId, targetStatus, userId);

      // Broadcast phase change via Socket.IO
      try {
        const io = getSocketServer();
        io.to(buildSurveyRoomName(surveyId)).emit(SOCKET_EVENTS.SURVEY_PHASE_CHANGED, {
          surveyId,
          previousStatus: result.previousStatus,
          newStatus: result.survey.status,
        });
      } catch {
        // Socket.IO not initialized (e.g. in tests) – skip broadcast
      }

      res.json({
        survey: result.survey,
        previousStatus: result.previousStatus,
        warning: result.warning,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateParticipantRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const participantId = req.params.participantId as string;
      const { role }: UpdateParticipantRoleSchemaInput = req.body;
      const userId = req.user!.sub;

      const participant = surveyService.updateParticipantRole(surveyId, participantId, role, userId);

      // Broadcast role change via Socket.IO so all participants see the update live
      try {
        const io = getSocketServer();
        io.to(buildSurveyRoomName(surveyId)).emit(SOCKET_EVENTS.PARTICIPANT_ROLE_CHANGED, {
          surveyId,
          participantId,
          newRole: role,
        });
      } catch {
        // Socket.IO not initialized (e.g. in tests) – skip broadcast
      }

      res.json({ participant });
    } catch (error) {
      next(error);
    }
  }

  async getTransitionInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const info = stateMachineService.getTransitionInfo(surveyId);

      // Voting progress is management information – only host/co-host receive it
      const role = req.surveyParticipant?.role;
      if (role !== 'host' && role !== 'co_host') {
        delete info.votingProgress;
      }

      res.json(info);
    } catch (error) {
      next(error);
    }
  }
}

export const surveyController = new SurveyController();
