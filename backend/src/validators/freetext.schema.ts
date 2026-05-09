import { z } from 'zod';

export const QUESTION_TEXT_MAX = 500;
export const ANSWER_TEXT_MAX = 2000;

export const createQuestionSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Frage darf nicht leer sein')
    .max(QUESTION_TEXT_MAX, `Frage darf max. ${QUESTION_TEXT_MAX} Zeichen lang sein`),
});

export const updateQuestionSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Frage darf nicht leer sein')
    .max(QUESTION_TEXT_MAX, `Frage darf max. ${QUESTION_TEXT_MAX} Zeichen lang sein`),
});

export const submitAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1, 'questionId fehlt'),
        text: z
          .string()
          .trim()
          .min(1, 'Antwort darf nicht leer sein')
          .max(
            ANSWER_TEXT_MAX,
            `Antwort darf max. ${ANSWER_TEXT_MAX} Zeichen lang sein`
          ),
      })
    )
    .min(1, 'Mindestens eine Antwort erforderlich'),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type SubmitAnswersInput = z.infer<typeof submitAnswersSchema>;
