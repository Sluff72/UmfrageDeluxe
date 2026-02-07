import { Router } from 'express';
import { objectionController } from '../controllers/objection.controller';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { optionalAuth } from '../middleware/optionalAuth';
import { requireRole } from '../middleware/surveyRole';
import { createObjectionSchema, reviewObjectionSchema } from '../validators/objection.schema';

const objectionRouter = Router();

// Submit an objection (any participant)
objectionRouter.post(
  '/surveys/:id/objections',
  optionalAuth,
  validate(createObjectionSchema),
  (req, res, next) => objectionController.createObjection(req, res, next)
);

// List objections for a survey
objectionRouter.get(
  '/surveys/:id/objections',
  optionalAuth,
  requireRole('host', 'co_host', 'teilnehmer'),
  (req, res, next) => objectionController.listObjections(req, res, next)
);

// Review an objection (host/co-host only)
objectionRouter.put(
  '/surveys/:id/objections/:objectionId',
  requireAuth,
  validate(reviewObjectionSchema),
  (req, res, next) => objectionController.reviewObjection(req, res, next)
);

export { objectionRouter };
