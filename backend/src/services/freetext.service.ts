import { getDatabase } from '../config/database';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../utils/errors';
import { surveyService } from './survey.service';
import { stateMachineService } from './stateMachine.service';
import type {
  FreetextAnswer,
  FreetextAnswerEntry,
  FreetextAnswerInput,
  FreetextOptionResults,
  FreetextQuestion,
  FreetextQuestionResults,
} from '../types/freetext.types';
import type { Survey } from '../types/survey.types';
import type { SurveyParticipant } from '../types/user.types';
import type { Option } from '../types/option.types';
import {
  ANSWER_TEXT_MAX,
  QUESTION_TEXT_MAX,
} from '../validators/freetext.schema';

export class FreetextService {
  // ---------------------------------------------------------------------------
  // Questions (host / co-host only)
  // ---------------------------------------------------------------------------

  createQuestion(
    surveyId: string,
    optionId: string,
    text: string,
    userId: string | null
  ): FreetextQuestion {
    const survey = surveyService.getSurveyById(surveyId);
    this.assertFreetextSurvey(survey);
    this.assertEditablePhase(survey);
    this.assertHostOrCoHost(surveyId, userId);

    const trimmed = this.assertQuestionText(text);

    const database = getDatabase();
    const option = database
      .prepare('SELECT * FROM options WHERE id = ?')
      .get(optionId) as Option | undefined;

    if (!option || option.survey_id !== surveyId) {
      throw new NotFoundError('Option');
    }

    const nextPosition = database
      .prepare(
        `SELECT COALESCE(MAX(position), -1) + 1 AS next_position
         FROM freetext_questions WHERE option_id = ?`
      )
      .get(optionId) as { next_position: number };

    return database
      .prepare(
        `INSERT INTO freetext_questions (option_id, text, position)
         VALUES (?, ?, ?)
         RETURNING *`
      )
      .get(optionId, trimmed, nextPosition.next_position) as FreetextQuestion;
  }

  updateQuestion(
    questionId: string,
    text: string,
    userId: string | null
  ): FreetextQuestion {
    const question = this.getQuestionById(questionId);
    const option = this.getOptionById(question.option_id);
    const survey = surveyService.getSurveyById(option.survey_id);

    this.assertFreetextSurvey(survey);
    this.assertEditablePhase(survey);
    this.assertHostOrCoHost(survey.id, userId);

    const trimmed = this.assertQuestionText(text);

    const database = getDatabase();
    return database
      .prepare(
        `UPDATE freetext_questions SET text = ? WHERE id = ? RETURNING *`
      )
      .get(trimmed, questionId) as FreetextQuestion;
  }

  deleteQuestion(questionId: string, userId: string | null): void {
    const question = this.getQuestionById(questionId);
    const option = this.getOptionById(question.option_id);
    const survey = surveyService.getSurveyById(option.survey_id);

    this.assertFreetextSurvey(survey);
    this.assertEditablePhase(survey);
    this.assertHostOrCoHost(survey.id, userId);

    const database = getDatabase();
    database
      .prepare('DELETE FROM freetext_questions WHERE id = ?')
      .run(questionId);
  }

  /**
   * List all questions for a survey, joined with their option title for
   * convenient client-side grouping.
   */
  listQuestionsForSurvey(surveyId: string): FreetextQuestion[] {
    surveyService.getSurveyById(surveyId); // throws if not found

    const database = getDatabase();
    return database
      .prepare(
        `SELECT q.*
         FROM freetext_questions q
         INNER JOIN options o ON o.id = q.option_id
         WHERE o.survey_id = ?
         ORDER BY o.position ASC, q.position ASC`
      )
      .all(surveyId) as FreetextQuestion[];
  }

  countQuestionsForSurvey(surveyId: string): number {
    const database = getDatabase();
    const result = database
      .prepare(
        `SELECT COUNT(*) AS count
         FROM freetext_questions q
         INNER JOIN options o ON o.id = q.option_id
         WHERE o.survey_id = ?`
      )
      .get(surveyId) as { count: number };
    return result.count;
  }

  // ---------------------------------------------------------------------------
  // Answers
  // ---------------------------------------------------------------------------

  submitAnswers(
    surveyId: string,
    answers: FreetextAnswerInput[],
    participantId: string
  ): FreetextAnswer[] {
    const survey = surveyService.getSurveyById(surveyId);
    this.assertFreetextSurvey(survey);

    if (survey.status !== 'abstimmen') {
      throw new ForbiddenError(
        'Antworten sind nur in der Phase "Abstimmen" möglich'
      );
    }

    if (answers.length === 0) {
      throw new ValidationError('Mindestens eine Antwort erforderlich');
    }

    const database = getDatabase();

    // Collect all valid question_ids for this survey
    const surveyQuestions = database
      .prepare(
        `SELECT q.id FROM freetext_questions q
         INNER JOIN options o ON o.id = q.option_id
         WHERE o.survey_id = ?`
      )
      .all(surveyId) as { id: string }[];
    const validQuestionIds = new Set(surveyQuestions.map((q) => q.id));

    const seenQuestionIds = new Set<string>();
    const trimmedAnswers: FreetextAnswerInput[] = [];

    for (const answer of answers) {
      if (!validQuestionIds.has(answer.questionId)) {
        throw new ValidationError(
          `Frage "${answer.questionId}" gehört nicht zu dieser Umfrage`
        );
      }
      if (seenQuestionIds.has(answer.questionId)) {
        throw new ValidationError('Doppelte Fragen in den Antworten');
      }
      seenQuestionIds.add(answer.questionId);

      const trimmed = answer.text.trim();
      if (trimmed.length === 0) {
        throw new ValidationError('Antwort darf nicht leer sein');
      }
      if (trimmed.length > ANSWER_TEXT_MAX) {
        throw new ValidationError(
          `Antwort darf max. ${ANSWER_TEXT_MAX} Zeichen lang sein`
        );
      }
      trimmedAnswers.push({ questionId: answer.questionId, text: trimmed });
    }

    const currentRound = stateMachineService.getCurrentVotingRound(surveyId);

    database
      .prepare(
        `DELETE FROM freetext_answers
         WHERE survey_id = ? AND participant_id = ? AND voting_round = ?`
      )
      .run(surveyId, participantId, currentRound);

    const insertStmt = database.prepare(
      `INSERT INTO freetext_answers (survey_id, question_id, participant_id, text, voting_round)
       VALUES (?, ?, ?, ?, ?)
       RETURNING *`
    );

    const inserted: FreetextAnswer[] = [];

    const insertAll = database.transaction(() => {
      for (const answer of trimmedAnswers) {
        const row = insertStmt.get(
          surveyId,
          answer.questionId,
          participantId,
          answer.text,
          currentRound
        ) as FreetextAnswer;
        inserted.push(row);
      }
    });

    insertAll();
    return inserted;
  }

  getMyAnswers(surveyId: string, participantId: string): FreetextAnswer[] {
    surveyService.getSurveyById(surveyId);

    const database = getDatabase();
    const currentRound = stateMachineService.getCurrentVotingRound(surveyId);

    return database
      .prepare(
        `SELECT * FROM freetext_answers
         WHERE survey_id = ? AND participant_id = ? AND voting_round = ?
         ORDER BY created_at ASC`
      )
      .all(surveyId, participantId, currentRound) as FreetextAnswer[];
  }

  /**
   * Aggregate answers grouped by option → question. Author names are masked
   * to `null` when `surveys.show_answer_authors` is 0.
   */
  getResults(surveyId: string): FreetextOptionResults[] {
    const survey = surveyService.getSurveyById(surveyId);
    this.assertFreetextSurvey(survey);

    const database = getDatabase();
    const currentRound = stateMachineService.getCurrentVotingRound(surveyId);
    const showAuthors = survey.show_answer_authors === 1;

    const optionsRows = database
      .prepare(
        `SELECT id, title, description, position
         FROM options WHERE survey_id = ?
         ORDER BY position ASC, created_at ASC`
      )
      .all(surveyId) as Array<{
        id: string;
        title: string;
        description: string | null;
        position: number;
      }>;

    const questionsRows = database
      .prepare(
        `SELECT id, option_id, text, position
         FROM freetext_questions
         WHERE option_id IN (
           SELECT id FROM options WHERE survey_id = ?
         )
         ORDER BY position ASC, created_at ASC`
      )
      .all(surveyId) as Array<{
        id: string;
        option_id: string;
        text: string;
        position: number;
      }>;

    const answersRows = database
      .prepare(
        `SELECT
           a.id,
           a.question_id,
           a.text,
           a.created_at,
           COALESCE(u.display_name, u.username, sp.anonymous_name, 'Anonym') AS author_name
         FROM freetext_answers a
         INNER JOIN survey_participants sp ON sp.id = a.participant_id
         LEFT JOIN users u ON u.id = sp.user_id
         WHERE a.survey_id = ? AND a.voting_round = ?
         ORDER BY a.created_at ASC`
      )
      .all(surveyId, currentRound) as Array<{
        id: string;
        question_id: string;
        text: string;
        created_at: string;
        author_name: string;
      }>;

    const answersByQuestion = new Map<string, FreetextAnswerEntry[]>();
    for (const row of answersRows) {
      const list = answersByQuestion.get(row.question_id) ?? [];
      list.push({
        id: row.id,
        text: row.text,
        author_name: showAuthors ? row.author_name : null,
        created_at: row.created_at,
      });
      answersByQuestion.set(row.question_id, list);
    }

    const questionsByOption = new Map<string, FreetextQuestionResults[]>();
    for (const q of questionsRows) {
      const list = questionsByOption.get(q.option_id) ?? [];
      list.push({
        question_id: q.id,
        question_text: q.text,
        question_position: q.position,
        answers: answersByQuestion.get(q.id) ?? [],
      });
      questionsByOption.set(q.option_id, list);
    }

    return optionsRows.map((o) => ({
      option_id: o.id,
      option_title: o.title,
      option_description: o.description,
      questions: questionsByOption.get(o.id) ?? [],
    }));
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private getQuestionById(questionId: string): FreetextQuestion {
    const database = getDatabase();
    const row = database
      .prepare('SELECT * FROM freetext_questions WHERE id = ?')
      .get(questionId) as FreetextQuestion | undefined;
    if (!row) {
      throw new NotFoundError('Frage');
    }
    return row;
  }

  private getOptionById(optionId: string): Option {
    const database = getDatabase();
    const row = database
      .prepare('SELECT * FROM options WHERE id = ?')
      .get(optionId) as Option | undefined;
    if (!row) {
      throw new NotFoundError('Option');
    }
    return row;
  }

  private assertFreetextSurvey(survey: Survey): void {
    if (survey.voting_method !== 'freitext') {
      throw new ValidationError(
        'Diese Aktion ist nur für Freitext-Umfragen verfügbar'
      );
    }
  }

  private assertEditablePhase(survey: Survey): void {
    if (
      survey.status !== 'entwurf' &&
      survey.status !== 'optionen_sammeln'
    ) {
      throw new ForbiddenError(
        'Fragen können nur in den Phasen "Entwurf" und "Optionen Sammeln" bearbeitet werden'
      );
    }
  }

  private assertHostOrCoHost(surveyId: string, userId: string | null): void {
    if (!userId) {
      throw new ForbiddenError(
        'Nur Host oder Co-Host können Fragen verwalten'
      );
    }

    const database = getDatabase();
    const participant = database
      .prepare(
        `SELECT * FROM survey_participants
         WHERE survey_id = ? AND user_id = ? AND role IN ('host', 'co_host')`
      )
      .get(surveyId, userId) as SurveyParticipant | undefined;

    if (!participant) {
      throw new ForbiddenError(
        'Nur Host oder Co-Host können Fragen verwalten'
      );
    }
  }

  private assertQuestionText(text: string): string {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('Frage darf nicht leer sein');
    }
    if (trimmed.length > QUESTION_TEXT_MAX) {
      throw new ValidationError(
        `Frage darf max. ${QUESTION_TEXT_MAX} Zeichen lang sein`
      );
    }
    return trimmed;
  }
}

export const freetextService = new FreetextService();
