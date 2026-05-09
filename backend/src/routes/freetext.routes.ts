import { Router } from 'express';
import { freetextController } from '../controllers/freetext.controller';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { optionalAuth } from '../middleware/optionalAuth';
import { requireRole } from '../middleware/surveyRole';
import {
  createQuestionSchema,
  submitAnswersSchema,
  updateQuestionSchema,
} from '../validators/freetext.schema';

const freetextRouter = Router();

// List questions for a survey (any participant)
freetextRouter.get(
  '/surveys/:id/questions',
  optionalAuth,
  requireRole('host', 'co_host', 'teilnehmer'),
  (req, res, next) => freetextController.listQuestions(req, res, next)
);

// Create a question under a specific option (host/co-host only)
freetextRouter.post(
  '/surveys/:id/options/:optionId/questions',
  requireAuth,
  requireRole('host', 'co_host'),
  validate(createQuestionSchema),
  (req, res, next) => freetextController.createQuestion(req, res, next)
);

// Update a question (host/co-host only)
freetextRouter.put(
  '/surveys/:id/questions/:questionId',
  requireAuth,
  requireRole('host', 'co_host'),
  validate(updateQuestionSchema),
  (req, res, next) => freetextController.updateQuestion(req, res, next)
);

// Delete a question (host/co-host only)
freetextRouter.delete(
  '/surveys/:id/questions/:questionId',
  requireAuth,
  requireRole('host', 'co_host'),
  (req, res, next) => freetextController.deleteQuestion(req, res, next)
);

// Submit answers (any participant)
freetextRouter.post(
  '/surveys/:id/answers',
  optionalAuth,
  validate(submitAnswersSchema),
  (req, res, next) => freetextController.submitAnswers(req, res, next)
);

// Get own answers
freetextRouter.get(
  '/surveys/:id/answers/mine',
  optionalAuth,
  (req, res, next) => freetextController.getMyAnswers(req, res, next)
);

// Aggregated results (any participant)
freetextRouter.get(
  '/surveys/:id/answers',
  optionalAuth,
  requireRole('host', 'co_host', 'teilnehmer'),
  (req, res, next) => freetextController.getResults(req, res, next)
);

export { freetextRouter };
