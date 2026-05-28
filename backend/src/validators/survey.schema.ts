import { z } from 'zod';

export const createSurveySchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters'),
  description: z
    .string()
    .max(2000, 'Description must be at most 2000 characters')
    .optional(),
  votingMethod: z.enum(['widerstand_punkte', 'widerstand', 'mehrheit'], {
    errorMap: () => ({ message: 'Invalid voting method' }),
  }),
  wMax: z
    .number()
    .int()
    .positive('W-Max must be a positive number')
    .optional(),
  maxPointsPerOption: z
    .number()
    .int()
    .min(1, 'Max points per option must be at least 1')
    .max(10, 'Max points per option must be at most 10')
    .optional(),
  allowAnonymous: z.boolean().optional(),
});

export const updateSurveySchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters')
    .optional(),
  description: z
    .string()
    .max(2000, 'Description must be at most 2000 characters')
    .optional(),
  votingMethod: z
    .enum(['widerstand_punkte', 'widerstand', 'mehrheit'])
    .optional(),
  wMax: z
    .number()
    .int()
    .positive('W-Max must be a positive number')
    .optional(),
  maxPointsPerOption: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional(),
  allowAnonymous: z.boolean().optional(),
});

const importOptionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Titel ist erforderlich')
    .max(300, 'Titel darf maximal 300 Zeichen lang sein'),
  description: z
    .string()
    .max(2000, 'Beschreibung darf maximal 2000 Zeichen lang sein')
    .optional(),
});

export const bulkImportSurveysSchema = z.object({
  surveys: z
    .array(
      createSurveySchema.extend({
        options: z
          .array(importOptionSchema)
          .max(100, 'Maximal 100 Optionen pro Umfrage erlaubt')
          .optional(),
      })
    )
    .min(1, 'Mindestens eine Umfrage erforderlich')
    .max(50, 'Maximal 50 Umfragen pro Import erlaubt'),
});

export const updateParticipantRoleSchema = z.object({
  role: z.enum(['co_host', 'teilnehmer'], {
    errorMap: () => ({ message: 'Rolle muss "co_host" oder "teilnehmer" sein' }),
  }),
});

export type CreateSurveySchemaInput = z.infer<typeof createSurveySchema>;
export type BulkImportSurveysSchemaInput = z.infer<typeof bulkImportSurveysSchema>;
export type UpdateSurveySchemaInput = z.infer<typeof updateSurveySchema>;
export type UpdateParticipantRoleSchemaInput = z.infer<typeof updateParticipantRoleSchema>;
