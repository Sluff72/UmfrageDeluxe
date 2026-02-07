import { Router } from 'express';
import { voteController } from '../controllers/vote.controller';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { optionalAuth } from '../middleware/optionalAuth';
import { requireRole } from '../middleware/surveyRole';
import { batchVoteSchema } from '../validators/vote.schema';

const voteRouter = Router();

// Submit votes (any participant)
voteRouter.post(
  '/surveys/:id/votes',
  optionalAuth,
  validate(batchVoteSchema),
  (req, res, next) => voteController.submitVotes(req, res, next)
);

// Get own votes
voteRouter.get(
  '/surveys/:id/votes/mine',
  optionalAuth,
  (req, res, next) => voteController.getMyVotes(req, res, next)
);

// Get all votes (host/co-host only)
voteRouter.get(
  '/surveys/:id/votes',
  requireAuth,
  requireRole('host', 'co_host'),
  (req, res, next) => voteController.getAllVotes(req, res, next)
);

// Get aggregated results
voteRouter.get(
  '/surveys/:id/results',
  optionalAuth,
  requireRole('host', 'co_host', 'teilnehmer'),
  (req, res, next) => voteController.getResults(req, res, next)
);

export { voteRouter };
