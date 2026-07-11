import { Request, Response, NextFunction } from 'express';
import { voteService } from '../services/vote.service';
import { optionService } from '../services/option.service';
import { getSocketServer } from '../socket/index';
import { SOCKET_EVENTS, buildSurveyRoomName } from '../socket/events';
import type { BatchVoteSchemaInput } from '../validators/vote.schema';

export class VoteController {
  async submitVotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const { votes: voteInputs }: BatchVoteSchemaInput = req.body;
      const userId = req.user?.sub ?? null;

      const participantId = optionService.resolveParticipantId(surveyId, userId, req.participant);

      const votes = voteService.submitVotes(surveyId, voteInputs, participantId);

      // Broadcast that someone voted (without revealing values)
      try {
        const io = getSocketServer();
        io.to(buildSurveyRoomName(surveyId)).emit(SOCKET_EVENTS.VOTE_RECEIVED, {
          surveyId,
          participantId,
        });
      } catch {
        // Socket.IO not initialized – skip
      }

      res.json({ votes });
    } catch (error) {
      next(error);
    }
  }

  async getMyVotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const userId = req.user?.sub ?? null;

      const participantId = optionService.resolveParticipantId(surveyId, userId, req.participant);
      const votes = voteService.getMyVotes(surveyId, participantId);

      res.json({ votes });
    } catch (error) {
      next(error);
    }
  }

  async getAllVotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const votes = voteService.getAllVotes(surveyId);

      res.json({ votes });
    } catch (error) {
      next(error);
    }
  }

  async getResults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const results = voteService.getResultsWithObjections(surveyId);

      res.json({ results });
    } catch (error) {
      next(error);
    }
  }

  async getResultsByParticipant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const surveyId = req.params.id as string;
      const results = voteService.getResultsByParticipant(surveyId);

      res.json({ results });
    } catch (error) {
      next(error);
    }
  }
}

export const voteController = new VoteController();
