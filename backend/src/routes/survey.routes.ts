import { Router } from 'express';
import { surveyController } from '../controllers/survey.controller';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { optionalAuth } from '../middleware/optionalAuth';
import { requireRole } from '../middleware/surveyRole';
import { createSurveySchema, updateSurveySchema, updateParticipantRoleSchema, bulkImportSurveysSchema } from '../validators/survey.schema';
import { transitionSchema } from '../validators/transition.schema';

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

// Bulk import (before :id routes to avoid matching "import" as an ID)
surveyRouter.post(
  '/surveys/import',
  requireAuth,
  validate(bulkImportSurveysSchema),
  (req, res, next) => surveyController.bulkImportSurveys(req, res, next)
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
  requireRole('host', 'co_host', 'teilnehmer'),
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

// Duplicate survey (host or co-host of the original)
surveyRouter.post(
  '/surveys/:id/duplicate',
  requireAuth,
  (req, res, next) => surveyController.duplicateSurvey(req, res, next)
);

// Participant role management (host only)
surveyRouter.put(
  '/surveys/:id/participants/:participantId/role',
  requireAuth,
  validate(updateParticipantRoleSchema),
  (req, res, next) => surveyController.updateParticipantRole(req, res, next)
);

// Phase transitions
surveyRouter.post(
  '/surveys/:id/transition',
  requireAuth,
  validate(transitionSchema),
  (req, res, next) => surveyController.transitionSurvey(req, res, next)
);

surveyRouter.get(
  '/surveys/:id/transition-info',
  optionalAuth,
  requireRole('host', 'co_host', 'teilnehmer'),
  (req, res, next) => surveyController.getTransitionInfo(req, res, next)
);

export { surveyRouter };
