import { describe, it, expect, beforeEach } from 'vitest';
import argon2 from 'argon2';
import { getDatabase } from '../config/database';
import { VoteService } from './vote.service';
import { SurveyService } from './survey.service';
import { OptionService } from './option.service';
import { ForbiddenError, ValidationError, NotFoundError } from '../utils/errors';
import type { Survey } from '../types/survey.types';
import type { VotingMethod } from '../types/survey.types';
import type { Option } from '../types/option.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTestUser(username = 'testhost'): Promise<string> {
  const db = getDatabase();
  const hash = await argon2.hash('password123', { type: argon2.argon2id });
  const user = db
    .prepare(
      "INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING id"
    )
    .get(username, hash) as { id: string };
  return user.id;
}

function createTestSurvey(
  userId: string,
  votingMethod: VotingMethod = 'widerstand',
  opts?: { wMax?: number; maxPointsPerOption?: number }
): Survey {
  const surveyService = new SurveyService();
  return surveyService.createSurvey(
    {
      title: 'Test Survey',
      votingMethod,
      wMax: opts?.wMax,
      maxPointsPerOption: opts?.maxPointsPerOption,
    },
    userId
  );
}

function setSurveyStatus(surveyId: string, status: string): void {
  const db = getDatabase();
  db.prepare('UPDATE surveys SET status = ? WHERE id = ?').run(status, surveyId);
}

function getParticipantId(surveyId: string, userId: string): string {
  const db = getDatabase();
  const row = db
    .prepare('SELECT id FROM survey_participants WHERE survey_id = ? AND user_id = ?')
    .get(surveyId, userId) as { id: string };
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
// Test suite
// ---------------------------------------------------------------------------

describe('VoteService', () => {
  let service: VoteService;

  beforeEach(() => {
    service = new VoteService();

    const db = getDatabase();
    db.exec(`
      DELETE FROM objections;
      DELETE FROM votes;
      DELETE FROM options;
      DELETE FROM survey_participants;
      DELETE FROM surveys;
      DELETE FROM users;
    `);
  });

  // =========================================================================
  // submitVotes
  // =========================================================================

  describe('submitVotes', () => {
    it('should successfully submit votes for widerstand method', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand');
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');
      const optionB = addTestOption(survey.id, participantId, 'Option B');

      setSurveyStatus(survey.id, 'abstimmen');

      const votes = service.submitVotes(
        survey.id,
        [
          { optionId: optionA.id, value: 3 },
          { optionId: optionB.id, value: 7 },
        ],
        participantId
      );

      expect(votes).toHaveLength(2);
      expect(votes[0].survey_id).toBe(survey.id);
      expect(votes[0].participant_id).toBe(participantId);
      expect(votes[0].value).toBe(3);
      expect(votes[0].voting_round).toBe(1);
      expect(votes[0].id).toBeTypeOf('string');
      expect(votes[0].created_at).toBeTypeOf('string');
      expect(votes[1].value).toBe(7);
    });

    it('should successfully submit votes for widerstand_punkte method', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand_punkte', {
        wMax: 15,
        maxPointsPerOption: 5,
      });
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');
      const optionB = addTestOption(survey.id, participantId, 'Option B');
      const optionC = addTestOption(survey.id, participantId, 'Option C');

      setSurveyStatus(survey.id, 'abstimmen');

      const votes = service.submitVotes(
        survey.id,
        [
          { optionId: optionA.id, value: 5 },
          { optionId: optionB.id, value: 5 },
          { optionId: optionC.id, value: 5 },
        ],
        participantId
      );

      expect(votes).toHaveLength(3);
      expect(votes[0].value).toBe(5);
      expect(votes[1].value).toBe(5);
      expect(votes[2].value).toBe(5);
    });

    it('should successfully submit votes for mehrheit method', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'mehrheit');
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');
      const optionB = addTestOption(survey.id, participantId, 'Option B');

      setSurveyStatus(survey.id, 'abstimmen');

      const votes = service.submitVotes(
        survey.id,
        [
          { optionId: optionA.id, value: 1 },
          { optionId: optionB.id, value: 0 },
        ],
        participantId
      );

      expect(votes).toHaveLength(2);
      expect(votes[0].value).toBe(1);
      expect(votes[1].value).toBe(0);
    });

    it('should replace existing votes in the same round (re-submission)', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand');
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');
      const optionB = addTestOption(survey.id, participantId, 'Option B');

      setSurveyStatus(survey.id, 'abstimmen');

      // First submission
      service.submitVotes(
        survey.id,
        [
          { optionId: optionA.id, value: 3 },
          { optionId: optionB.id, value: 7 },
        ],
        participantId
      );

      // Re-submission with different values
      const votes = service.submitVotes(
        survey.id,
        [
          { optionId: optionA.id, value: 9 },
          { optionId: optionB.id, value: 1 },
        ],
        participantId
      );

      expect(votes).toHaveLength(2);
      expect(votes[0].value).toBe(9);
      expect(votes[1].value).toBe(1);

      // Verify old votes are gone by checking total vote count
      const myVotes = service.getMyVotes(survey.id, participantId);
      expect(myVotes).toHaveLength(2);
    });

    it('should reject when survey is not in abstimmen phase', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand');
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');

      // Survey stays in optionen_sammeln
      expect(() =>
        service.submitVotes(
          survey.id,
          [{ optionId: optionA.id, value: 5 }],
          participantId
        )
      ).toThrow(ForbiddenError);
    });

    it('should reject when survey is in entwurf phase', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand');
      // survey defaults to 'entwurf'
      const participantId = getParticipantId(survey.id, userId);

      expect(() =>
        service.submitVotes(
          survey.id,
          [{ optionId: 'fake-option-id', value: 5 }],
          participantId
        )
      ).toThrow(ForbiddenError);
    });

    it('should reject values outside 0-10 for widerstand', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand');
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');

      setSurveyStatus(survey.id, 'abstimmen');

      // Value above 10
      expect(() =>
        service.submitVotes(
          survey.id,
          [{ optionId: optionA.id, value: 11 }],
          participantId
        )
      ).toThrow(ValidationError);

      // Value below 0
      expect(() =>
        service.submitVotes(
          survey.id,
          [{ optionId: optionA.id, value: -1 }],
          participantId
        )
      ).toThrow(ValidationError);
    });

    it('should reject values outside 0-10 for widerstand_punkte', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand_punkte', {
        wMax: 100,
        maxPointsPerOption: 10,
      });
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');

      setSurveyStatus(survey.id, 'abstimmen');

      // Value above 10
      expect(() =>
        service.submitVotes(
          survey.id,
          [{ optionId: optionA.id, value: 11 }],
          participantId
        )
      ).toThrow(ValidationError);

      // Value below 0
      expect(() =>
        service.submitVotes(
          survey.id,
          [{ optionId: optionA.id, value: -1 }],
          participantId
        )
      ).toThrow(ValidationError);
    });

    it('should reject values not 0 or 1 for mehrheit', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'mehrheit');
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');

      setSurveyStatus(survey.id, 'abstimmen');

      expect(() =>
        service.submitVotes(
          survey.id,
          [{ optionId: optionA.id, value: 2 }],
          participantId
        )
      ).toThrow(ValidationError);

      expect(() =>
        service.submitVotes(
          survey.id,
          [{ optionId: optionA.id, value: 5 }],
          participantId
        )
      ).toThrow(ValidationError);

      expect(() =>
        service.submitVotes(
          survey.id,
          [{ optionId: optionA.id, value: -1 }],
          participantId
        )
      ).toThrow(ValidationError);
    });

    it('should reject when value exceeds max_points_per_option (widerstand_punkte)', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand_punkte', {
        wMax: 30,
        maxPointsPerOption: 3,
      });
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');

      setSurveyStatus(survey.id, 'abstimmen');

      // Value of 5 exceeds maxPointsPerOption of 3
      expect(() =>
        service.submitVotes(
          survey.id,
          [{ optionId: optionA.id, value: 5 }],
          participantId
        )
      ).toThrow(ValidationError);
    });

    it('should reject when total exceeds w_max (widerstand_punkte)', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand_punkte', {
        wMax: 6,
        maxPointsPerOption: 5,
      });
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');
      const optionB = addTestOption(survey.id, participantId, 'Option B');

      setSurveyStatus(survey.id, 'abstimmen');

      // Total 5 + 5 = 10 exceeds w_max of 6
      expect(() =>
        service.submitVotes(
          survey.id,
          [
            { optionId: optionA.id, value: 5 },
            { optionId: optionB.id, value: 5 },
          ],
          participantId
        )
      ).toThrow(ValidationError);
    });

    it('should allow total equal to w_max (widerstand_punkte)', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand_punkte', {
        wMax: 10,
        maxPointsPerOption: 5,
      });
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');
      const optionB = addTestOption(survey.id, participantId, 'Option B');

      setSurveyStatus(survey.id, 'abstimmen');

      // Total 5 + 5 = 10 exactly matches w_max of 10
      const votes = service.submitVotes(
        survey.id,
        [
          { optionId: optionA.id, value: 5 },
          { optionId: optionB.id, value: 5 },
        ],
        participantId
      );

      expect(votes).toHaveLength(2);
    });

    it('should allow high value per option if within w_max budget (widerstand_punkte)', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand_punkte', {
        wMax: 15,
        maxPointsPerOption: 10,
      });
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');
      const optionB = addTestOption(survey.id, participantId, 'Option B');
      const optionC = addTestOption(survey.id, participantId, 'Option C');

      setSurveyStatus(survey.id, 'abstimmen');

      // Value of 10 on one option is allowed because total 10+2+3=15 <= w_max 15
      const votes = service.submitVotes(
        survey.id,
        [
          { optionId: optionA.id, value: 10 },
          { optionId: optionB.id, value: 2 },
          { optionId: optionC.id, value: 3 },
        ],
        participantId
      );

      expect(votes).toHaveLength(3);
      expect(votes[0].value).toBe(10);
    });

    it('should reject high values that exceed w_max budget (widerstand_punkte)', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand_punkte', {
        wMax: 15,
        maxPointsPerOption: 10,
      });
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');
      const optionB = addTestOption(survey.id, participantId, 'Option B');
      const optionC = addTestOption(survey.id, participantId, 'Option C');

      setSurveyStatus(survey.id, 'abstimmen');

      // Total 10+10+0 = 20 exceeds w_max of 15
      expect(() =>
        service.submitVotes(
          survey.id,
          [
            { optionId: optionA.id, value: 10 },
            { optionId: optionB.id, value: 10 },
            { optionId: optionC.id, value: 0 },
          ],
          participantId
        )
      ).toThrow(ValidationError);
    });

    it('should reject when option does not belong to survey', async () => {
      const userId = await createTestUser();
      const survey1 = createTestSurvey(userId, 'widerstand');
      const surveyService = new SurveyService();
      const survey2 = surveyService.createSurvey(
        { title: 'Other Survey', votingMethod: 'widerstand' },
        userId
      );

      setSurveyStatus(survey1.id, 'optionen_sammeln');
      setSurveyStatus(survey2.id, 'optionen_sammeln');

      const participant1Id = getParticipantId(survey1.id, userId);
      const participant2Id = getParticipantId(survey2.id, userId);

      // Create option in survey2
      const foreignOption = addTestOption(survey2.id, participant2Id, 'Foreign Option');
      // Create a valid option in survey1 so the survey has options
      addTestOption(survey1.id, participant1Id, 'Valid Option');

      setSurveyStatus(survey1.id, 'abstimmen');

      // Try to submit vote in survey1 with an option from survey2
      expect(() =>
        service.submitVotes(
          survey1.id,
          [{ optionId: foreignOption.id, value: 5 }],
          participant1Id
        )
      ).toThrow(ValidationError);
    });

    it('should reject duplicate option IDs in batch', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand');
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');

      setSurveyStatus(survey.id, 'abstimmen');

      expect(() =>
        service.submitVotes(
          survey.id,
          [
            { optionId: optionA.id, value: 3 },
            { optionId: optionA.id, value: 7 },
          ],
          participantId
        )
      ).toThrow(ValidationError);
    });

    it('should accept value 0 for widerstand', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand');
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');

      setSurveyStatus(survey.id, 'abstimmen');

      const votes = service.submitVotes(
        survey.id,
        [{ optionId: optionA.id, value: 0 }],
        participantId
      );

      expect(votes).toHaveLength(1);
      expect(votes[0].value).toBe(0);
    });

    it('should accept value 10 for widerstand', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand');
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');

      setSurveyStatus(survey.id, 'abstimmen');

      const votes = service.submitVotes(
        survey.id,
        [{ optionId: optionA.id, value: 10 }],
        participantId
      );

      expect(votes).toHaveLength(1);
      expect(votes[0].value).toBe(10);
    });
  });

  // =========================================================================
  // getMyVotes
  // =========================================================================

  describe('getMyVotes', () => {
    it('should return votes for current participant in current round', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand');
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');
      const optionB = addTestOption(survey.id, participantId, 'Option B');

      setSurveyStatus(survey.id, 'abstimmen');

      service.submitVotes(
        survey.id,
        [
          { optionId: optionA.id, value: 4 },
          { optionId: optionB.id, value: 8 },
        ],
        participantId
      );

      const myVotes = service.getMyVotes(survey.id, participantId);

      expect(myVotes).toHaveLength(2);
      expect(myVotes[0].participant_id).toBe(participantId);
      expect(myVotes[1].participant_id).toBe(participantId);
      expect(myVotes[0].survey_id).toBe(survey.id);
    });

    it('should return empty array when no votes exist', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand');
      const participantId = getParticipantId(survey.id, userId);

      const myVotes = service.getMyVotes(survey.id, participantId);

      expect(myVotes).toEqual([]);
    });

    it('should only return votes for the current round (not previous rounds)', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand');
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');
      const optionB = addTestOption(survey.id, participantId, 'Option B');

      setSurveyStatus(survey.id, 'abstimmen');

      // Submit votes in round 1
      service.submitVotes(
        survey.id,
        [
          { optionId: optionA.id, value: 3 },
          { optionId: optionB.id, value: 5 },
        ],
        participantId
      );

      // Manually insert votes for round 2 to simulate a second round
      const db = getDatabase();
      db.prepare(
        `INSERT INTO votes (survey_id, option_id, participant_id, value, voting_round)
         VALUES (?, ?, ?, ?, 2)`
      ).run(survey.id, optionA.id, participantId, 1);

      // getCurrentVotingRound should now return 2
      const myVotes = service.getMyVotes(survey.id, participantId);

      // Should only return the round-2 vote (1 vote), not the round-1 votes
      expect(myVotes).toHaveLength(1);
      expect(myVotes[0].voting_round).toBe(2);
      expect(myVotes[0].value).toBe(1);
    });

    it('should not return votes from other participants', async () => {
      const hostId = await createTestUser('host');
      const memberId = await createTestUser('member');
      const survey = createTestSurvey(hostId, 'widerstand');

      const surveyService = new SurveyService();
      surveyService.joinSurveyByInviteCode(survey.invite_code, memberId, null, null);

      setSurveyStatus(survey.id, 'optionen_sammeln');
      const hostParticipantId = getParticipantId(survey.id, hostId);
      const memberParticipantId = getParticipantId(survey.id, memberId);

      const optionA = addTestOption(survey.id, hostParticipantId, 'Option A');

      setSurveyStatus(survey.id, 'abstimmen');

      // Host submits votes
      service.submitVotes(
        survey.id,
        [{ optionId: optionA.id, value: 7 }],
        hostParticipantId
      );

      // Member's votes should be empty
      const memberVotes = service.getMyVotes(survey.id, memberParticipantId);
      expect(memberVotes).toEqual([]);
    });
  });

  // =========================================================================
  // getAllVotes
  // =========================================================================

  describe('getAllVotes', () => {
    it('should return all votes for the current round', async () => {
      const hostId = await createTestUser('host');
      const memberId = await createTestUser('member');
      const survey = createTestSurvey(hostId, 'widerstand');

      const surveyService = new SurveyService();
      surveyService.joinSurveyByInviteCode(survey.invite_code, memberId, null, null);

      setSurveyStatus(survey.id, 'optionen_sammeln');
      const hostParticipantId = getParticipantId(survey.id, hostId);
      const memberParticipantId = getParticipantId(survey.id, memberId);

      const optionA = addTestOption(survey.id, hostParticipantId, 'Option A');
      const optionB = addTestOption(survey.id, hostParticipantId, 'Option B');

      setSurveyStatus(survey.id, 'abstimmen');

      // Both participants submit votes
      service.submitVotes(
        survey.id,
        [
          { optionId: optionA.id, value: 3 },
          { optionId: optionB.id, value: 6 },
        ],
        hostParticipantId
      );

      service.submitVotes(
        survey.id,
        [
          { optionId: optionA.id, value: 8 },
          { optionId: optionB.id, value: 2 },
        ],
        memberParticipantId
      );

      const allVotes = service.getAllVotes(survey.id);

      expect(allVotes).toHaveLength(4);
      // Verify votes from both participants are present
      const hostVotes = allVotes.filter((v) => v.participant_id === hostParticipantId);
      const memberVotes = allVotes.filter((v) => v.participant_id === memberParticipantId);
      expect(hostVotes).toHaveLength(2);
      expect(memberVotes).toHaveLength(2);
    });

    it('should throw NotFoundError for non-existent survey', () => {
      expect(() => service.getAllVotes('nonexistent-id')).toThrow(NotFoundError);
    });

    it('should return empty array when no votes exist', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand');

      const allVotes = service.getAllVotes(survey.id);

      expect(allVotes).toEqual([]);
    });
  });

  // =========================================================================
  // getResults
  // =========================================================================

  describe('getResults', () => {
    it('should return aggregated results with total, count, average', async () => {
      const hostId = await createTestUser('host');
      const memberId = await createTestUser('member');
      const survey = createTestSurvey(hostId, 'widerstand');

      const surveyService = new SurveyService();
      surveyService.joinSurveyByInviteCode(survey.invite_code, memberId, null, null);

      setSurveyStatus(survey.id, 'optionen_sammeln');
      const hostParticipantId = getParticipantId(survey.id, hostId);
      const memberParticipantId = getParticipantId(survey.id, memberId);

      const optionA = addTestOption(survey.id, hostParticipantId, 'Option A');
      const optionB = addTestOption(survey.id, hostParticipantId, 'Option B');

      setSurveyStatus(survey.id, 'abstimmen');

      // Host votes: A=2, B=8
      service.submitVotes(
        survey.id,
        [
          { optionId: optionA.id, value: 2 },
          { optionId: optionB.id, value: 8 },
        ],
        hostParticipantId
      );

      // Member votes: A=4, B=6
      service.submitVotes(
        survey.id,
        [
          { optionId: optionA.id, value: 4 },
          { optionId: optionB.id, value: 6 },
        ],
        memberParticipantId
      );

      const results = service.getResults(survey.id);

      expect(results).toHaveLength(2);

      // Results are sorted by average_value ASC
      // Option A: total=6, count=2, avg=3.0
      // Option B: total=14, count=2, avg=7.0
      const resultA = results.find((r) => r.option_id === optionA.id)!;
      const resultB = results.find((r) => r.option_id === optionB.id)!;

      expect(resultA.total_value).toBe(6);
      expect(resultA.vote_count).toBe(2);
      expect(resultA.average_value).toBe(3.0);
      expect(resultA.option_title).toBe('Option A');

      expect(resultB.total_value).toBe(14);
      expect(resultB.vote_count).toBe(2);
      expect(resultB.average_value).toBe(7.0);
      expect(resultB.option_title).toBe('Option B');
    });

    it('should return results sorted by average_value ASC (lowest resistance first)', async () => {
      const hostId = await createTestUser('host');
      const memberId = await createTestUser('member');
      const survey = createTestSurvey(hostId, 'widerstand');

      const surveyService = new SurveyService();
      surveyService.joinSurveyByInviteCode(survey.invite_code, memberId, null, null);

      setSurveyStatus(survey.id, 'optionen_sammeln');
      const hostParticipantId = getParticipantId(survey.id, hostId);
      const memberParticipantId = getParticipantId(survey.id, memberId);

      const optionA = addTestOption(survey.id, hostParticipantId, 'High Resistance');
      const optionB = addTestOption(survey.id, hostParticipantId, 'Low Resistance');
      const optionC = addTestOption(survey.id, hostParticipantId, 'Mid Resistance');

      setSurveyStatus(survey.id, 'abstimmen');

      // Host: A=9, B=1, C=5
      service.submitVotes(
        survey.id,
        [
          { optionId: optionA.id, value: 9 },
          { optionId: optionB.id, value: 1 },
          { optionId: optionC.id, value: 5 },
        ],
        hostParticipantId
      );

      // Member: A=7, B=3, C=5
      service.submitVotes(
        survey.id,
        [
          { optionId: optionA.id, value: 7 },
          { optionId: optionB.id, value: 3 },
          { optionId: optionC.id, value: 5 },
        ],
        memberParticipantId
      );

      const results = service.getResults(survey.id);

      expect(results).toHaveLength(3);
      // Sorted by average ASC: B(2.0), C(5.0), A(8.0)
      expect(results[0].option_id).toBe(optionB.id);
      expect(results[0].average_value).toBe(2.0);
      expect(results[1].option_id).toBe(optionC.id);
      expect(results[1].average_value).toBe(5.0);
      expect(results[2].option_id).toBe(optionA.id);
      expect(results[2].average_value).toBe(8.0);
    });

    it('should return empty array when no votes exist', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand');

      const results = service.getResults(survey.id);

      expect(results).toEqual([]);
    });

    it('should throw NotFoundError for non-existent survey', () => {
      expect(() => service.getResults('nonexistent-id')).toThrow(NotFoundError);
    });
  });

  // =========================================================================
  // hasVoted
  // =========================================================================

  describe('hasVoted', () => {
    it('should return true when participant has voted', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand');
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');

      setSurveyStatus(survey.id, 'abstimmen');

      service.submitVotes(
        survey.id,
        [{ optionId: optionA.id, value: 5 }],
        participantId
      );

      expect(service.hasVoted(survey.id, participantId)).toBe(true);
    });

    it('should return false when participant has not voted', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand');
      const participantId = getParticipantId(survey.id, userId);

      expect(service.hasVoted(survey.id, participantId)).toBe(false);
    });

    it('should return false for a different round after round change', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'widerstand');
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const optionA = addTestOption(survey.id, participantId, 'Option A');
      const optionB = addTestOption(survey.id, participantId, 'Option B');

      setSurveyStatus(survey.id, 'abstimmen');

      // Submit votes in round 1
      service.submitVotes(
        survey.id,
        [
          { optionId: optionA.id, value: 3 },
          { optionId: optionB.id, value: 5 },
        ],
        participantId
      );

      expect(service.hasVoted(survey.id, participantId)).toBe(true);

      // Simulate a new round by inserting a vote for round 2 from another participant
      // This makes getCurrentVotingRound return 2
      const memberId = await createTestUser('member');
      const surveyService = new SurveyService();
      surveyService.joinSurveyByInviteCode(survey.invite_code, memberId, null, null);
      const memberParticipantId = getParticipantId(survey.id, memberId);

      const db = getDatabase();
      db.prepare(
        `INSERT INTO votes (survey_id, option_id, participant_id, value, voting_round)
         VALUES (?, ?, ?, ?, 2)`
      ).run(survey.id, optionA.id, memberParticipantId, 1);

      // Original participant has not voted in round 2
      expect(service.hasVoted(survey.id, participantId)).toBe(false);
    });
  });

  describe('freitext rejection', () => {
    it('rejects numeric votes on freitext surveys', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId, 'freitext');
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);
      const option = addTestOption(survey.id, participantId, 'O');
      setSurveyStatus(survey.id, 'abstimmen');

      expect(() =>
        service.submitVotes(
          survey.id,
          [{ optionId: option.id, value: 1 }],
          participantId
        )
      ).toThrow(ValidationError);
    });
  });
});
