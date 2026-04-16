import { z } from 'zod';

export const createOptionSchema = z.object({
  title: z.string().trim().min(1, 'Titel ist erforderlich').max(300, 'Titel darf maximal 300 Zeichen lang sein'),
  description: z.string().max(2000, 'Beschreibung darf maximal 2000 Zeichen lang sein').optional(),
});

export const updateOptionSchema = z.object({
  title: z.string().trim().min(1, 'Titel ist erforderlich').max(300, 'Titel darf maximal 300 Zeichen lang sein').optional(),
  description: z.string().max(2000, 'Beschreibung darf maximal 2000 Zeichen lang sein').optional(),
});

export const moveOptionSchema = z.object({
  direction: z.enum(['up', 'down'], {
    errorMap: () => ({ message: 'Richtung muss "up" oder "down" sein' }),
  }),
});

export type CreateOptionSchemaInput = z.infer<typeof createOptionSchema>;
export type UpdateOptionSchemaInput = z.infer<typeof updateOptionSchema>;
export type MoveOptionSchemaInput = z.infer<typeof moveOptionSchema>;
