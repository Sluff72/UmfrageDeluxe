import { z } from 'zod';

export const batchVoteSchema = z.object({
  votes: z
    .array(
      z.object({
        optionId: z.string().min(1, 'Option ID ist erforderlich'),
        value: z.number().int('Wert muss eine ganze Zahl sein'),
      })
    )
    .min(1, 'Mindestens eine Stimme ist erforderlich'),
});

export type BatchVoteSchemaInput = z.infer<typeof batchVoteSchema>;
