import { Request, Response, NextFunction } from 'express';
import { objectionService } from '../services/objection.service';
import { optionService } from '../services/option.service';
import { getSocketServer } from '../socket/index';
import { SOCKET_EVENTS, buildSurveyRoomName } from '../socket/events';
import type { CreateObjectionSchemaInput, ReviewObjectionSchemaInput } from '../validators/objection.schema';

export class ObjectionController {
  async createObjection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const input: CreateObjectionSchemaInput = req.body;
      const userId = req.user?.sub ?? null;

      const participantId = optionService.resolveParticipantId(surveyId, userId, req.participant);

      const objection = objectionService.createObjection(surveyId, input, participantId);

      // Broadcast new objection
      try {
        const io = getSocketServer();
        io.to(buildSurveyRoomName(surveyId)).emit(SOCKET_EVENTS.OBJECTION_ADDED, {
          surveyId,
          objectionId: objection.id,
        });
      } catch {
        // Socket.IO not initialized – skip
      }

      res.status(201).json({ objection });
    } catch (error) {
      next(error);
    }
  }

  async listObjections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const objections = objectionService.listObjections(surveyId);

      res.json({ objections });
    } catch (error) {
      next(error);
    }
  }

  async reviewObjection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const objectionId = req.params.objectionId as string;
      const input: ReviewObjectionSchemaInput = req.body;
      const userId = req.user!.sub;

      const objection = objectionService.reviewObjection(objectionId, input, surveyId, userId);

      // Broadcast status change
      try {
        const io = getSocketServer();
        io.to(buildSurveyRoomName(surveyId)).emit(SOCKET_EVENTS.OBJECTION_STATUS_CHANGED, {
          surveyId,
          objectionId: objection.id,
          status: objection.status,
        });
      } catch {
        // Socket.IO not initialized – skip
      }

      res.json({ objection });
    } catch (error) {
      next(error);
    }
  }
}

export const objectionController = new ObjectionController();
