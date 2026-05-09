import { Request, Response, NextFunction } from 'express';
import { freetextService } from '../services/freetext.service';
import { optionService } from '../services/option.service';
import { getSocketServer } from '../socket/index';
import { SOCKET_EVENTS, buildSurveyRoomName } from '../socket/events';
import type { SubmitAnswersInput } from '../validators/freetext.schema';

function broadcast(surveyId: string, event: string, payload: unknown): void {
  try {
    const io = getSocketServer();
    io.to(buildSurveyRoomName(surveyId)).emit(event, payload);
  } catch {
    // Socket.IO not initialized – skip silently
  }
}

export class FreetextController {
  async listQuestions(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const questions = freetextService.listQuestionsForSurvey(surveyId);
      res.json({ questions });
    } catch (error) {
      next(error);
    }
  }

  async createQuestion(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const optionId = req.params.optionId as string;
      const userId = req.user?.sub ?? null;
      const { text } = req.body as { text: string };

      const question = freetextService.createQuestion(
        surveyId,
        optionId,
        text,
        userId
      );

      broadcast(surveyId, SOCKET_EVENTS.FREETEXT_QUESTIONS_UPDATED, {
        surveyId,
      });

      res.status(201).json({ question });
    } catch (error) {
      next(error);
    }
  }

  async updateQuestion(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const questionId = req.params.questionId as string;
      const userId = req.user?.sub ?? null;
      const { text } = req.body as { text: string };

      const question = freetextService.updateQuestion(
        questionId,
        text,
        userId
      );

      broadcast(surveyId, SOCKET_EVENTS.FREETEXT_QUESTIONS_UPDATED, {
        surveyId,
      });

      res.json({ question });
    } catch (error) {
      next(error);
    }
  }

  async deleteQuestion(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const questionId = req.params.questionId as string;
      const userId = req.user?.sub ?? null;

      freetextService.deleteQuestion(questionId, userId);

      broadcast(surveyId, SOCKET_EVENTS.FREETEXT_QUESTIONS_UPDATED, {
        surveyId,
      });

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  async submitAnswers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const { answers }: SubmitAnswersInput = req.body;
      const userId = req.user?.sub ?? null;

      const participantId = optionService.resolveParticipantId(
        surveyId,
        userId,
        req.participant
      );

      const inserted = freetextService.submitAnswers(
        surveyId,
        answers,
        participantId
      );

      broadcast(surveyId, SOCKET_EVENTS.FREETEXT_ANSWER_RECEIVED, {
        surveyId,
        participantId,
      });

      res.json({ answers: inserted });
    } catch (error) {
      next(error);
    }
  }

  async getMyAnswers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const userId = req.user?.sub ?? null;
      const participantId = optionService.resolveParticipantId(
        surveyId,
        userId,
        req.participant
      );

      const answers = freetextService.getMyAnswers(surveyId, participantId);
      res.json({ answers });
    } catch (error) {
      next(error);
    }
  }

  async getResults(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const results = freetextService.getResults(surveyId);
      res.json({ results });
    } catch (error) {
      next(error);
    }
  }
}

export const freetextController = new FreetextController();
