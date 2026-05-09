import { describe, it, expect, beforeEach } from 'vitest';
import argon2 from 'argon2';
import { getDatabase } from '../config/database';
import { FreetextService } from './freetext.service';
import { SurveyService } from './survey.service';
import { OptionService } from './option.service';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../utils/errors';
import type { Survey, VotingMethod } from '../types/survey.types';
import type { Option } from '../types/option.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTestUser(username = 'testhost'): Promise<string> {
  const db = getDatabase();
  const hash = await argon2.hash('password123', { type: argon2.argon2id });
  const user = db
    .prepare(
      'INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING id'
    )
    .get(username, hash) as { id: string };
  return user.id;
}

function createTestSurvey(
  userId: string,
  votingMethod: VotingMethod = 'freitext',
  opts?: { showAnswerAuthors?: boolean }
): Survey {
  const surveyService = new SurveyService();
  return surveyService.createSurvey(
    {
      title: 'Freetext Survey',
      votingMethod,
      showAnswerAuthors: opts?.showAnswerAuthors,
    },
    userId
  );
}

function setSurveyStatus(surveyId: string, status: string): void {
  const db = getDatabase();
  db.prepare('UPDATE surveys SET status = ? WHERE id = ?').run(
    status,
    surveyId
  );
}

function getParticipantId(surveyId: string, userId: string): string {
  const db = getDatabase();
  const row = db
    .prepare(
      'SELECT id FROM survey_participants WHERE survey_id = ? AND user_id = ?'
    )
    .get(surveyId, userId) as { id: string };
  return row.id;
}

function addParticipant(
  surveyId: string,
  userId: string | null,
  role: 'host' | 'co_host' | 'teilnehmer' = 'teilnehmer',
  anonymousName: string | null = null
): string {
  const db = getDatabase();
  const row = db
    .prepare(
      `INSERT INTO survey_participants (survey_id, user_id, anonymous_name, role)
       VALUES (?, ?, ?, ?)
       RETURNING id`
    )
    .get(surveyId, userId, anonymousName, role) as { id: string };
  return row.id;
}

function addTestOption(
  surveyId: string,
  participantId: string,
  title: string
): Option {
  const optionService = new OptionService();
  return optionService.createOption(surveyId, { title }, participantId);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FreetextService', () => {
  let service: FreetextService;

  beforeEach(() => {
    service = new FreetextService();
    const db = getDatabase();
    db.exec(`
      DELETE FROM freetext_answers;
      DELETE FROM freetext_questions;
      DELETE FROM objections;
      DELETE FROM votes;
      DELETE FROM options;
      DELETE FROM survey_participants;
      DELETE FROM surveys;
      DELETE FROM users;
    `);
  });

  // =========================================================================
  // Question CRUD
  // =========================================================================

  describe('createQuestion', () => {
    it('creates a question for a freitext survey during optionen_sammeln', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const hostParticipant = getParticipantId(survey.id, userId);
      const option = addTestOption(survey.id, hostParticipant, 'Option A');

      const question = service.createQuestion(
        survey.id,
        option.id,
        'Wohin möchtest du fahren?',
        userId
      );

      expect(question.option_id).toBe(option.id);
      expect(question.text).toBe('Wohin möchtest du fahren?');
      expect(question.position).toBe(0);
    });

    it('assigns positions sequentially per option', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const host = getParticipantId(survey.id, userId);
      const option = addTestOption(survey.id, host, 'O');

      const q1 = service.createQuestion(survey.id, option.id, 'Q1', userId);
      const q2 = service.createQuestion(survey.id, option.id, 'Q2', userId);

      expect(q1.position).toBe(0);
      expect(q2.position).toBe(1);
    });

    it('rejects creation by non-host participants', async () => {
      const hostId = await createTestUser('host');
      const otherId = await createTestUser('other');
      const survey = createTestSurvey(hostId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const host = getParticipantId(survey.id, hostId);
      const option = addTestOption(survey.id, host, 'O');
      addParticipant(survey.id, otherId, 'teilnehmer');

      expect(() =>
        service.createQuestion(survey.id, option.id, 'Q', otherId)
      ).toThrow(ForbiddenError);
    });

    it('rejects empty question text', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const host = getParticipantId(survey.id, userId);
      const option = addTestOption(survey.id, host, 'O');

      expect(() =>
        service.createQuestion(survey.id, option.id, '   ', userId)
      ).toThrow(ValidationError);
    });

    it('rejects creation on non-freitext surveys', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand');
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const host = getParticipantId(survey.id, userId);
      const option = addTestOption(survey.id, host, 'O');

      expect(() =>
        service.createQuestion(survey.id, option.id, 'Q', userId)
      ).toThrow(ValidationError);
    });

    it('rejects creation outside entwurf/optionen_sammeln', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const host = getParticipantId(survey.id, userId);
      const option = addTestOption(survey.id, host, 'O');
      setSurveyStatus(survey.id, 'abstimmen');

      expect(() =>
        service.createQuestion(survey.id, option.id, 'Q', userId)
      ).toThrow(ForbiddenError);
    });
  });

  describe('updateQuestion / deleteQuestion', () => {
    async function setupQuestion() {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const host = getParticipantId(survey.id, userId);
      const option = addTestOption(survey.id, host, 'O');
      const question = service.createQuestion(survey.id, option.id, 'Q', userId);
      return { userId, surveyId: survey.id, questionId: question.id };
    }

    it('updates the question text', async () => {
      const { userId, questionId } = await setupQuestion();
      const updated = service.updateQuestion(questionId, 'New text', userId);
      expect(updated.text).toBe('New text');
    });

    it('deletes the question', async () => {
      const { userId, questionId } = await setupQuestion();
      service.deleteQuestion(questionId, userId);
      expect(() =>
        service.updateQuestion(questionId, 'x', userId)
      ).toThrow(NotFoundError);
    });
  });

  // =========================================================================
  // submitAnswers
  // =========================================================================

  describe('submitAnswers', () => {
    async function setupSurveyInVotingPhase() {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const host = getParticipantId(survey.id, userId);
      const option = addTestOption(survey.id, host, 'Option A');
      const q1 = service.createQuestion(survey.id, option.id, 'Q1', userId);
      const q2 = service.createQuestion(survey.id, option.id, 'Q2', userId);
      setSurveyStatus(survey.id, 'abstimmen');
      return { userId, host, surveyId: survey.id, q1, q2 };
    }

    it('inserts answers for the current voting round', async () => {
      const { surveyId, host, q1, q2 } = await setupSurveyInVotingPhase();

      const inserted = service.submitAnswers(
        surveyId,
        [
          { questionId: q1.id, text: 'Antwort 1' },
          { questionId: q2.id, text: 'Antwort 2' },
        ],
        host
      );

      expect(inserted).toHaveLength(2);
      expect(inserted[0].voting_round).toBe(1);
      expect(inserted[0].text).toBe('Antwort 1');
    });

    it('replaces existing answers in the same round', async () => {
      const { surveyId, host, q1 } = await setupSurveyInVotingPhase();

      service.submitAnswers(
        surveyId,
        [{ questionId: q1.id, text: 'old' }],
        host
      );
      service.submitAnswers(
        surveyId,
        [{ questionId: q1.id, text: 'new' }],
        host
      );

      const my = service.getMyAnswers(surveyId, host);
      expect(my).toHaveLength(1);
      expect(my[0].text).toBe('new');
    });

    it('rejects answers for questions from other surveys', async () => {
      const { surveyId, host } = await setupSurveyInVotingPhase();

      // Create a second survey + question
      const otherUserId = await createTestUser('other');
      const other = createTestSurvey(otherUserId);
      setSurveyStatus(other.id, 'optionen_sammeln');
      const otherHost = getParticipantId(other.id, otherUserId);
      const otherOption = addTestOption(other.id, otherHost, 'X');
      const otherQ = service.createQuestion(
        other.id,
        otherOption.id,
        'X?',
        otherUserId
      );

      expect(() =>
        service.submitAnswers(
          surveyId,
          [{ questionId: otherQ.id, text: 'leak' }],
          host
        )
      ).toThrow(ValidationError);
    });

    it('rejects empty answers', async () => {
      const { surveyId, host, q1 } = await setupSurveyInVotingPhase();
      expect(() =>
        service.submitAnswers(
          surveyId,
          [{ questionId: q1.id, text: '   ' }],
          host
        )
      ).toThrow(ValidationError);
    });

    it('rejects when survey not in abstimmen phase', async () => {
      const { surveyId, host, q1 } = await setupSurveyInVotingPhase();
      setSurveyStatus(surveyId, 'beendet');
      expect(() =>
        service.submitAnswers(
          surveyId,
          [{ questionId: q1.id, text: 'x' }],
          host
        )
      ).toThrow(ForbiddenError);
    });
  });

  // =========================================================================
  // getResults — author masking
  // =========================================================================

  describe('getResults', () => {
    it('returns author names when show_answer_authors=1', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'freitext', {
        showAnswerAuthors: true,
      });
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const host = getParticipantId(survey.id, userId);
      const option = addTestOption(survey.id, host, 'O');
      const q = service.createQuestion(survey.id, option.id, 'Q', userId);
      setSurveyStatus(survey.id, 'abstimmen');
      service.submitAnswers(survey.id, [{ questionId: q.id, text: 'A' }], host);

      const results = service.getResults(survey.id);
      expect(results).toHaveLength(1);
      expect(results[0].questions[0].answers[0].author_name).not.toBeNull();
    });

    it('masks author names when show_answer_authors=0', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'freitext', {
        showAnswerAuthors: false,
      });
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const host = getParticipantId(survey.id, userId);
      const option = addTestOption(survey.id, host, 'O');
      const q = service.createQuestion(survey.id, option.id, 'Q', userId);
      setSurveyStatus(survey.id, 'abstimmen');
      service.submitAnswers(survey.id, [{ questionId: q.id, text: 'A' }], host);

      const results = service.getResults(survey.id);
      expect(results[0].questions[0].answers[0].author_name).toBeNull();
    });
  });

  describe('countQuestionsForSurvey', () => {
    it('counts questions across all options in the survey', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const host = getParticipantId(survey.id, userId);
      const o1 = addTestOption(survey.id, host, 'O1');
      const o2 = addTestOption(survey.id, host, 'O2');
      service.createQuestion(survey.id, o1.id, 'Q1', userId);
      service.createQuestion(survey.id, o1.id, 'Q2', userId);
      service.createQuestion(survey.id, o2.id, 'Q3', userId);

      expect(service.countQuestionsForSurvey(survey.id)).toBe(3);
    });
  });
});
