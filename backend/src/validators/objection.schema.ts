import { z } from 'zod';

export const createObjectionSchema = z.object({
  text: z.string().min(1, 'Einwandtext ist erforderlich').max(2000),
  optionId: z.string().min(1, 'Eine Option muss ausgewählt werden'),
});

export const reviewObjectionSchema = z.object({
  status: z.enum(['integrated', 'dismissed'], {
    errorMap: () => ({ message: 'Status muss "integrated" oder "dismissed" sein' }),
  }),
  hostResponse: z.string().max(2000).optional(),
});

export type CreateObjectionSchemaInput = z.infer<typeof createObjectionSchema>;
export type ReviewObjectionSchemaInput = z.infer<typeof reviewObjectionSchema>;
