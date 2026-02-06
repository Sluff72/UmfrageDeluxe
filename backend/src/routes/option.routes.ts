import { Router } from 'express';
import { optionController } from '../controllers/option.controller';
import { validate } from '../middleware/validate';
import { optionalAuth } from '../middleware/optionalAuth';
import { createOptionSchema, updateOptionSchema } from '../validators/option.schema';

const optionRouter = Router();

// List options for a survey
optionRouter.get(
  '/surveys/:id/options',
  optionalAuth,
  (req, res, next) => optionController.listOptions(req, res, next)
);

// Create option in a survey
optionRouter.post(
  '/surveys/:id/options',
  optionalAuth,
  validate(createOptionSchema),
  (req, res, next) => optionController.createOption(req, res, next)
);

// Update option
optionRouter.put(
  '/options/:optionId',
  optionalAuth,
  validate(updateOptionSchema),
  (req, res, next) => optionController.updateOption(req, res, next)
);

// Delete option
optionRouter.delete(
  '/options/:optionId',
  optionalAuth,
  (req, res, next) => optionController.deleteOption(req, res, next)
);

export { optionRouter };
