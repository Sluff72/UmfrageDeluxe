import { z } from 'zod';

export const createOptionSchema = z.object({
  title: z.string().trim().min(1, 'Titel ist erforderlich').max(300, 'Titel darf maximal 300 Zeichen lang sein'),
  description: z.string().max(2000, 'Beschreibung darf maximal 2000 Zeichen lang sein').optional(),
});

export const updateOptionSchema = z.object({
  title: z.string().trim().min(1, 'Titel ist erforderlich').max(300, 'Titel darf maximal 300 Zeichen lang sein').optional(),
  description: z.string().max(2000, 'Beschreibung darf maximal 2000 Zeichen lang sein').optional(),
});

export type CreateOptionSchemaInput = z.infer<typeof createOptionSchema>;
export type UpdateOptionSchemaInput = z.infer<typeof updateOptionSchema>;
