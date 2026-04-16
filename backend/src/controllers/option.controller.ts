import { Request, Response, NextFunction } from 'express';
import { optionService } from '../services/option.service';
import { getSocketServer } from '../socket/index';
import { SOCKET_EVENTS, buildSurveyRoomName } from '../socket/events';
import type {
  CreateOptionSchemaInput,
  UpdateOptionSchemaInput,
  MoveOptionSchemaInput,
} from '../validators/option.schema';

export class OptionController {
  async createOption(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const input: CreateOptionSchemaInput = req.body;
      const userId = req.user?.sub ?? null;

      const participantId = optionService.resolveParticipantId(surveyId, userId, req.participant);

      const option = optionService.createOption(surveyId, input, participantId);

      // Broadcast via Socket.IO
      try {
        const io = getSocketServer();
        io.to(buildSurveyRoomName(surveyId)).emit(SOCKET_EVENTS.OPTION_ADDED, { option });
      } catch {
        // Socket.IO not initialized – skip
      }

      res.status(201).json({ option });
    } catch (error) {
      next(error);
    }
  }

  async listOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const options = optionService.listOptionsForSurvey(surveyId);
      res.json({ options });
    } catch (error) {
      next(error);
    }
  }

  async updateOption(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const optionId = req.params.optionId as string;
      const input: UpdateOptionSchemaInput = req.body;
      const userId = req.user?.sub ?? null;

      // Resolve participant from the option's survey
      const existingOption = optionService.getOptionById(optionId);
      const participantId = optionService.resolveParticipantId(
        existingOption.survey_id,
        userId,
        req.participant
      );

      const option = optionService.updateOption(optionId, input, participantId, userId);

      // Broadcast via Socket.IO
      try {
        const io = getSocketServer();
        io.to(buildSurveyRoomName(option.survey_id)).emit(SOCKET_EVENTS.OPTION_UPDATED, { option });
      } catch {
        // Socket.IO not initialized – skip
      }

      res.json({ option });
    } catch (error) {
      next(error);
    }
  }

  async moveOption(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const optionId = req.params.optionId as string;
      const { direction } = req.body as MoveOptionSchemaInput;
      const userId = req.user?.sub ?? null;

      const existingOption = optionService.getOptionById(optionId);
      const surveyId = existingOption.survey_id;

      // Ensures the caller is a participant of the survey before touching data.
      optionService.resolveParticipantId(surveyId, userId, req.participant);

      const options = optionService.moveOption(optionId, direction, userId);

      // Broadcast via Socket.IO
      try {
        const io = getSocketServer();
        io.to(buildSurveyRoomName(surveyId)).emit(SOCKET_EVENTS.OPTION_REORDERED, {
          surveyId,
          options,
        });
      } catch {
        // Socket.IO not initialized – skip
      }

      res.json({ options });
    } catch (error) {
      next(error);
    }
  }

  async deleteOption(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const optionId = req.params.optionId as string;
      const userId = req.user?.sub ?? null;

      // Resolve participant from the option's survey
      const existingOption = optionService.getOptionById(optionId);
      const surveyId = existingOption.survey_id;
      const participantId = optionService.resolveParticipantId(
        surveyId,
        userId,
        req.participant
      );

      optionService.deleteOption(optionId, participantId, userId);

      // Broadcast via Socket.IO
      try {
        const io = getSocketServer();
        io.to(buildSurveyRoomName(surveyId)).emit(SOCKET_EVENTS.OPTION_REMOVED, { optionId });
      } catch {
        // Socket.IO not initialized – skip
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const optionController = new OptionController();
