import { Router } from 'express';
import { surveyController } from '../controllers/survey.controller';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { optionalAuth } from '../middleware/optionalAuth';
import { createSurveySchema, updateSurveySchema } from '../validators/survey.schema';

const surveyRouter = Router();

// Join via invite code (before :id routes to avoid matching "join" as an ID)
surveyRouter.post(
  '/surveys/join/:inviteCode',
  optionalAuth,
  (req, res, next) => surveyController.joinSurvey(req, res, next)
);

// Collection routes
surveyRouter.post(
  '/surveys',
  requireAuth,
  validate(createSurveySchema),
  (req, res, next) => surveyController.createSurvey(req, res, next)
);

surveyRouter.get(
  '/surveys',
  requireAuth,
  (req, res, next) => surveyController.listSurveys(req, res, next)
);

// Single survey routes
surveyRouter.get(
  '/surveys/:id',
  optionalAuth,
  (req, res, next) => surveyController.getSurvey(req, res, next)
);

surveyRouter.put(
  '/surveys/:id',
  requireAuth,
  validate(updateSurveySchema),
  (req, res, next) => surveyController.updateSurvey(req, res, next)
);

surveyRouter.delete(
  '/surveys/:id',
  requireAuth,
  (req, res, next) => surveyController.deleteSurvey(req, res, next)
);

surveyRouter.post(
  '/surveys/:id/archive',
  requireAuth,
  (req, res, next) => surveyController.archiveSurvey(req, res, next)
);

export { surveyRouter };
