import { describe, it, expect, beforeEach } from 'vitest';
import argon2 from 'argon2';
import { getDatabase } from '../config/database';
import { StateMachineService } from './stateMachine.service';
import { SurveyService } from './survey.service';
import { ForbiddenError, ValidationError } from '../utils/errors';
import type { Survey, SurveyStatus } from '../types/survey.types';
import type { SurveyParticipant } from '../types/user.types';

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

function setSurveyStatus(surveyId: string, status: string): void {
  const db = getDatabase();
  db.prepare('UPDATE surveys SET status = ? WHERE id = ?').run(status, surveyId);
}

function addTestOption(surveyId: string, title: string): string {
  const db = getDatabase();
  // We need a participant (creator) for the option. Use the host.
  const host = db
    .prepare(
      "SELECT id FROM survey_participants WHERE survey_id = ? AND role = 'host'"
    )
    .get(surveyId) as { id: string };

  const option = db
    .prepare(
      `INSERT INTO options (survey_id, title, created_by)
       VALUES (?, ?, ?)
       RETURNING id`
    )
    .get(surveyId, title, host.id) as { id: string };

  return option.id;
}

function addTestVote(
  surveyId: string,
  participantId: string,
  optionId: string,
  round: number = 1
): string {
  const db = getDatabase();
  const vote = db
    .prepare(
      `INSERT INTO votes (survey_id, option_id, participant_id, value, voting_round)
       VALUES (?, ?, ?, 3, ?)
       RETURNING id`
    )
    .get(surveyId, optionId, participantId, round) as { id: string };
  return vote.id;
}

function addTestObjection(
  surveyId: string,
  participantId: string,
  optionId: string | null,
  status: 'pending' | 'integrated' | 'dismissed' = 'pending'
): string {
  const db = getDatabase();
  const objection = db
    .prepare(
      `INSERT INTO objections (survey_id, participant_id, option_id, text, status)
       VALUES (?, ?, ?, 'Test objection', ?)
       RETURNING id`
    )
    .get(surveyId, participantId, optionId, status) as { id: string };
  return objection.id;
}

function getParticipantId(surveyId: string, userId: string): string {
  const db = getDatabase();
  const participant = db
    .prepare(
      'SELECT id FROM survey_participants WHERE survey_id = ? AND user_id = ?'
    )
    .get(surveyId, userId) as { id: string };
  return participant.id;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('StateMachineService', () => {
  let smService: StateMachineService;
  let surveyService: SurveyService;

  beforeEach(() => {
    smService = new StateMachineService();
    surveyService = new SurveyService();

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
  // getAvailableTransitions
  // =========================================================================

  describe('getAvailableTransitions', () => {
    it("should return ['optionen_sammeln'] for 'entwurf'", async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Draft Survey', votingMethod: 'widerstand' },
        userId
      );

      const transitions = smService.getAvailableTransitions(survey.id);

      expect(transitions).toEqual(['optionen_sammeln']);
    });

    it("should return ['abstimmen'] for 'optionen_sammeln'", async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Collecting Options', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');

      const transitions = smService.getAvailableTransitions(survey.id);

      expect(transitions).toEqual(['abstimmen']);
    });

    it("should return ['einwand_integration', 'beendet'] for 'abstimmen'", async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Voting', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'abstimmen');

      const transitions = smService.getAvailableTransitions(survey.id);

      expect(transitions).toEqual(['einwand_integration', 'beendet']);
    });

    it("should return ['abstimmen', 'beendet'] for 'einwand_integration'", async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Objection Phase', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'einwand_integration');

      const transitions = smService.getAvailableTransitions(survey.id);

      expect(transitions).toEqual(['abstimmen', 'beendet']);
    });

    it("should return [] for 'beendet'", async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Finished', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'beendet');

      const transitions = smService.getAvailableTransitions(survey.id);

      expect(transitions).toEqual([]);
    });
  });

  // =========================================================================
  // checkGuard
  // =========================================================================

  describe('checkGuard', () => {
    it('should allow entwurf -> optionen_sammeln when title and voting_method are configured', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Configured Survey', votingMethod: 'widerstand' },
        userId
      );

      const result = smService.checkGuard(survey, 'optionen_sammeln');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should block entwurf -> optionen_sammeln when title is empty', async () => {
      const userId = await createTestUser();
      const db = getDatabase();

      // Insert a survey with empty title directly to bypass service validation
      const hash = 'INVCODE1';
      const survey = db
        .prepare(
          `INSERT INTO surveys (title, voting_method, invite_code, created_by)
           VALUES ('', 'widerstand', ?, ?)
           RETURNING *`
        )
        .get(hash, userId) as Survey;

      const result = smService.checkGuard(survey, 'optionen_sammeln');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should block optionen_sammeln -> abstimmen when fewer than 2 options exist', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Few Options', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');
      // Add only 1 option
      addTestOption(survey.id, 'Only Option');

      // Re-fetch to get correct status
      const freshSurvey = surveyService.getSurveyById(survey.id);
      const result = smService.checkGuard(freshSurvey, 'abstimmen');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should block optionen_sammeln -> abstimmen when zero options exist', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'No Options', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');

      const freshSurvey = surveyService.getSurveyById(survey.id);
      const result = smService.checkGuard(freshSurvey, 'abstimmen');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should allow optionen_sammeln -> abstimmen when >= 2 options exist', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Enough Options', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');
      addTestOption(survey.id, 'Option A');
      addTestOption(survey.id, 'Option B');

      const freshSurvey = surveyService.getSurveyById(survey.id);
      const result = smService.checkGuard(freshSurvey, 'abstimmen');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should allow abstimmen -> einwand_integration with warning when not all participants voted', async () => {
      const hostId = await createTestUser('host');
      const participantId = await createTestUser('participant');
      const survey = surveyService.createSurvey(
        { title: 'Partial Voting', votingMethod: 'widerstand' },
        hostId
      );

      // Add a second participant
      surveyService.joinSurveyByInviteCode(survey.invite_code, participantId, null, null);

      setSurveyStatus(survey.id, 'abstimmen');
      // Add options and have only the host vote
      const optionId = addTestOption(survey.id, 'Option A');
      const hostParticipantId = getParticipantId(survey.id, hostId);
      addTestVote(survey.id, hostParticipantId, optionId, 1);

      const freshSurvey = surveyService.getSurveyById(survey.id);
      const result = smService.checkGuard(freshSurvey, 'einwand_integration');

      expect(result.allowed).toBe(true);
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('1/2');
    });

    it('should allow abstimmen -> einwand_integration without warning when all participants voted', async () => {
      const hostId = await createTestUser('host');
      const participantId = await createTestUser('participant');
      const survey = surveyService.createSurvey(
        { title: 'Full Voting', votingMethod: 'widerstand' },
        hostId
      );

      surveyService.joinSurveyByInviteCode(survey.invite_code, participantId, null, null);

      setSurveyStatus(survey.id, 'abstimmen');
      const optionId = addTestOption(survey.id, 'Option A');

      const hostParticipantId = getParticipantId(survey.id, hostId);
      const participantPartId = getParticipantId(survey.id, participantId);
      addTestVote(survey.id, hostParticipantId, optionId, 1);
      addTestVote(survey.id, participantPartId, optionId, 1);

      const freshSurvey = surveyService.getSurveyById(survey.id);
      const result = smService.checkGuard(freshSurvey, 'einwand_integration');

      expect(result.allowed).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    it('should always allow abstimmen -> beendet', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Skip Objections', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'abstimmen');

      const freshSurvey = surveyService.getSurveyById(survey.id);
      const result = smService.checkGuard(freshSurvey, 'beendet');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.warning).toBeUndefined();
    });

    it('should block einwand_integration -> abstimmen when no objections have been integrated', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'No Integrated', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'einwand_integration');

      const freshSurvey = surveyService.getSurveyById(survey.id);
      const result = smService.checkGuard(freshSurvey, 'abstimmen');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should block einwand_integration -> abstimmen when objections exist but none are integrated', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Pending Only', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'einwand_integration');

      const optionId = addTestOption(survey.id, 'Option A');
      const hostParticipantId = getParticipantId(survey.id, userId);
      addTestObjection(survey.id, hostParticipantId, optionId, 'pending');

      const freshSurvey = surveyService.getSurveyById(survey.id);
      const result = smService.checkGuard(freshSurvey, 'abstimmen');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should allow einwand_integration -> abstimmen when objections have been integrated', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Integrated Objections', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'einwand_integration');

      const optionId = addTestOption(survey.id, 'Option A');
      const hostParticipantId = getParticipantId(survey.id, userId);
      addTestObjection(survey.id, hostParticipantId, optionId, 'integrated');

      const freshSurvey = surveyService.getSurveyById(survey.id);
      const result = smService.checkGuard(freshSurvey, 'abstimmen');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should always allow einwand_integration -> beendet', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'End from Objections', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'einwand_integration');

      const freshSurvey = surveyService.getSurveyById(survey.id);
      const result = smService.checkGuard(freshSurvey, 'beendet');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.warning).toBeUndefined();
    });

    it('should return not allowed for unexpected transition combinations', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Unexpected', votingMethod: 'widerstand' },
        userId
      );

      // entwurf -> beendet is not a structurally valid transition,
      // but checkGuard handles it with catch-all
      const result = smService.checkGuard(survey, 'beendet');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  // =========================================================================
  // transitionSurvey
  // =========================================================================

  describe('transitionSurvey', () => {
    it('should successfully transition entwurf -> optionen_sammeln', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Transition Test', votingMethod: 'widerstand' },
        userId
      );

      const result = smService.transitionSurvey(survey.id, 'optionen_sammeln', userId);

      expect(result.survey.status).toBe('optionen_sammeln');
      expect(result.previousStatus).toBe('entwurf');
      expect(result.warning).toBeUndefined();
    });

    it('should return previousStatus correctly', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Previous Status', votingMethod: 'widerstand' },
        userId
      );
      // Move to optionen_sammeln first
      smService.transitionSurvey(survey.id, 'optionen_sammeln', userId);
      // Add enough options
      addTestOption(survey.id, 'Option A');
      addTestOption(survey.id, 'Option B');

      const result = smService.transitionSurvey(survey.id, 'abstimmen', userId);

      expect(result.previousStatus).toBe('optionen_sammeln');
      expect(result.survey.status).toBe('abstimmen');
    });

    it('should reject invalid transitions (e.g. entwurf -> abstimmen)', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Invalid Transition', votingMethod: 'widerstand' },
        userId
      );

      expect(() =>
        smService.transitionSurvey(survey.id, 'abstimmen', userId)
      ).toThrow(ValidationError);
    });

    it('should reject invalid transitions (e.g. entwurf -> beendet)', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Skip to End', votingMethod: 'widerstand' },
        userId
      );

      expect(() =>
        smService.transitionSurvey(survey.id, 'beendet', userId)
      ).toThrow(ValidationError);
    });

    it('should reject when guard fails (optionen_sammeln -> abstimmen with 0 options)', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'No Options', votingMethod: 'widerstand' },
        userId
      );
      smService.transitionSurvey(survey.id, 'optionen_sammeln', userId);

      expect(() =>
        smService.transitionSurvey(survey.id, 'abstimmen', userId)
      ).toThrow(ValidationError);
    });

    it('should reject when guard fails (optionen_sammeln -> abstimmen with 1 option)', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'One Option', votingMethod: 'widerstand' },
        userId
      );
      smService.transitionSurvey(survey.id, 'optionen_sammeln', userId);
      addTestOption(survey.id, 'Lonely Option');

      expect(() =>
        smService.transitionSurvey(survey.id, 'abstimmen', userId)
      ).toThrow(ValidationError);
    });

    it('should reject transition from a non-host/co_host user (ForbiddenError)', async () => {
      const hostId = await createTestUser('host');
      const participantId = await createTestUser('participant');
      const survey = surveyService.createSurvey(
        { title: 'Host Only', votingMethod: 'widerstand' },
        hostId
      );

      // Join as regular participant
      surveyService.joinSurveyByInviteCode(survey.invite_code, participantId, null, null);

      expect(() =>
        smService.transitionSurvey(survey.id, 'optionen_sammeln', participantId)
      ).toThrow(ForbiddenError);
    });

    it('should reject transition from a user not in the survey at all', async () => {
      const hostId = await createTestUser('host');
      const outsiderId = await createTestUser('outsider');
      const survey = surveyService.createSurvey(
        { title: 'Outsider Test', votingMethod: 'widerstand' },
        hostId
      );

      expect(() =>
        smService.transitionSurvey(survey.id, 'optionen_sammeln', outsiderId)
      ).toThrow(ForbiddenError);
    });

    it('should allow co_host to transition', async () => {
      const hostId = await createTestUser('host');
      const coHostId = await createTestUser('cohost');
      const survey = surveyService.createSurvey(
        { title: 'CoHost Transition', votingMethod: 'widerstand' },
        hostId
      );

      // Promote to co_host
      surveyService.addCoHost(survey.id, coHostId, hostId);

      const result = smService.transitionSurvey(survey.id, 'optionen_sammeln', coHostId);

      expect(result.survey.status).toBe('optionen_sammeln');
    });

    it('should return warning when applicable (abstimmen -> einwand_integration, not all voted)', async () => {
      const hostId = await createTestUser('host');
      const participantId = await createTestUser('participant');
      const survey = surveyService.createSurvey(
        { title: 'Warning Test', votingMethod: 'widerstand' },
        hostId
      );
      surveyService.joinSurveyByInviteCode(survey.invite_code, participantId, null, null);

      // Move through phases
      smService.transitionSurvey(survey.id, 'optionen_sammeln', hostId);
      addTestOption(survey.id, 'Option A');
      addTestOption(survey.id, 'Option B');
      smService.transitionSurvey(survey.id, 'abstimmen', hostId);

      // Only host votes
      const optionId = addTestOption(survey.id, 'Option C');
      const hostParticipantId = getParticipantId(survey.id, hostId);
      const existingOptionId = getDatabase()
        .prepare('SELECT id FROM options WHERE survey_id = ? LIMIT 1')
        .get(survey.id) as { id: string };
      addTestVote(survey.id, hostParticipantId, existingOptionId.id, 1);

      const result = smService.transitionSurvey(survey.id, 'einwand_integration', hostId);

      expect(result.survey.status).toBe('einwand_integration');
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('1/2');
    });

    it('should handle re-vote cycle: einwand_integration -> abstimmen dismisses pending objections', async () => {
      const hostId = await createTestUser('host');
      const survey = surveyService.createSurvey(
        { title: 'Re-vote Test', votingMethod: 'widerstand' },
        hostId
      );

      // Move through phases to einwand_integration
      smService.transitionSurvey(survey.id, 'optionen_sammeln', hostId);
      addTestOption(survey.id, 'Option A');
      addTestOption(survey.id, 'Option B');
      smService.transitionSurvey(survey.id, 'abstimmen', hostId);
      setSurveyStatus(survey.id, 'einwand_integration');

      const optionId = getDatabase()
        .prepare('SELECT id FROM options WHERE survey_id = ? LIMIT 1')
        .get(survey.id) as { id: string };

      const hostParticipantId = getParticipantId(survey.id, hostId);

      // Add an integrated objection (required for guard) and a pending objection
      addTestObjection(survey.id, hostParticipantId, optionId.id, 'integrated');
      const pendingObjId = addTestObjection(survey.id, hostParticipantId, optionId.id, 'pending');

      // Transition back to abstimmen
      const result = smService.transitionSurvey(survey.id, 'abstimmen', hostId);

      expect(result.survey.status).toBe('abstimmen');
      expect(result.previousStatus).toBe('einwand_integration');

      // Verify that pending objections were dismissed
      const db = getDatabase();
      const objection = db
        .prepare('SELECT status FROM objections WHERE id = ?')
        .get(pendingObjId) as { status: string };

      expect(objection.status).toBe('dismissed');
    });

    it('should persist the status update in the database', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Persist Test', votingMethod: 'widerstand' },
        userId
      );

      smService.transitionSurvey(survey.id, 'optionen_sammeln', userId);

      // Verify via direct DB read
      const db = getDatabase();
      const row = db
        .prepare('SELECT status FROM surveys WHERE id = ?')
        .get(survey.id) as { status: string };

      expect(row.status).toBe('optionen_sammeln');
    });

    it('should update the updated_at timestamp on transition', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Timestamp Test', votingMethod: 'widerstand' },
        userId
      );

      const result = smService.transitionSurvey(survey.id, 'optionen_sammeln', userId);

      // The updated_at should be at least as recent as created_at
      expect(result.survey.updated_at).toBeDefined();
      expect(new Date(result.survey.updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(survey.created_at).getTime()
      );
    });
  });

  // =========================================================================
  // getTransitionInfo
  // =========================================================================

  describe('getTransitionInfo', () => {
    it('should return the correct current status', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Info Test', votingMethod: 'widerstand' },
        userId
      );

      const info = smService.getTransitionInfo(survey.id);

      expect(info.currentStatus).toBe('entwurf');
    });

    it('should return available transitions with guard results', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Guard Info', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');
      // No options exist, so the guard should block abstimmen
      addTestOption(survey.id, 'Option A');

      const info = smService.getTransitionInfo(survey.id);

      expect(info.availableTransitions).toHaveLength(1);
      expect(info.availableTransitions[0].targetStatus).toBe('abstimmen');
      // Only 1 option, guard should block
      expect(info.availableTransitions[0].allowed).toBe(false);
      expect(info.availableTransitions[0].reason).toBeDefined();
    });

    it('should return allowed=true when guards pass', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Guard Pass Info', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');
      addTestOption(survey.id, 'Option A');
      addTestOption(survey.id, 'Option B');

      const info = smService.getTransitionInfo(survey.id);

      expect(info.availableTransitions).toHaveLength(1);
      expect(info.availableTransitions[0].targetStatus).toBe('abstimmen');
      expect(info.availableTransitions[0].allowed).toBe(true);
    });

    it('should return votingRound', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Voting Round Info', votingMethod: 'widerstand' },
        userId
      );

      const info = smService.getTransitionInfo(survey.id);

      expect(info.votingRound).toBe(1);
    });

    it('should return multiple transitions for abstimmen status', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Multi Trans', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'abstimmen');

      const info = smService.getTransitionInfo(survey.id);

      expect(info.currentStatus).toBe('abstimmen');
      expect(info.availableTransitions).toHaveLength(2);
      const targets = info.availableTransitions.map((t) => t.targetStatus);
      expect(targets).toContain('einwand_integration');
      expect(targets).toContain('beendet');
    });

    it('should return empty transitions for beendet status', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Ended Info', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'beendet');

      const info = smService.getTransitionInfo(survey.id);

      expect(info.currentStatus).toBe('beendet');
      expect(info.availableTransitions).toHaveLength(0);
    });
  });

  // =========================================================================
  // getCurrentVotingRound
  // =========================================================================

  describe('getCurrentVotingRound', () => {
    it('should return 1 when no votes exist', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'No Votes', votingMethod: 'widerstand' },
        userId
      );

      const round = smService.getCurrentVotingRound(survey.id);

      expect(round).toBe(1);
    });

    it('should return 1 when votes exist only in round 1', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Round 1', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'abstimmen');

      const optionId = addTestOption(survey.id, 'Option A');
      const hostParticipantId = getParticipantId(survey.id, userId);
      addTestVote(survey.id, hostParticipantId, optionId, 1);

      const round = smService.getCurrentVotingRound(survey.id);

      expect(round).toBe(1);
    });

    it('should return 2 when votes exist in round 2', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Round 2', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'abstimmen');

      const optionId = addTestOption(survey.id, 'Option A');
      const hostParticipantId = getParticipantId(survey.id, userId);
      addTestVote(survey.id, hostParticipantId, optionId, 1);
      // Add a second option for a round 2 vote
      const optionId2 = addTestOption(survey.id, 'Option B');
      addTestVote(survey.id, hostParticipantId, optionId2, 2);

      const round = smService.getCurrentVotingRound(survey.id);

      expect(round).toBe(2);
    });

    it('should return the maximum round when multiple rounds exist', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Multi Round', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'abstimmen');

      const optionId = addTestOption(survey.id, 'Option A');
      const optionId2 = addTestOption(survey.id, 'Option B');
      const optionId3 = addTestOption(survey.id, 'Option C');
      const hostParticipantId = getParticipantId(survey.id, userId);
      addTestVote(survey.id, hostParticipantId, optionId, 1);
      addTestVote(survey.id, hostParticipantId, optionId2, 2);
      addTestVote(survey.id, hostParticipantId, optionId3, 3);

      const round = smService.getCurrentVotingRound(survey.id);

      expect(round).toBe(3);
    });
  });

  // =========================================================================
  // Freitext-specific transitions
  // =========================================================================

  describe('Freitext voting method', () => {
    function addFreitextQuestion(optionId: string, text = 'Q'): string {
      const db = getDatabase();
      const row = db
        .prepare(
          `INSERT INTO freetext_questions (option_id, text, position)
           VALUES (?, ?, 0)
           RETURNING id`
        )
        .get(optionId, text) as { id: string };
      return row.id;
    }

    it("offers 'beendet' (and not 'einwand_integration') from 'abstimmen' for freitext surveys", async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Freitext', votingMethod: 'freitext' },
        userId
      );
      setSurveyStatus(survey.id, 'abstimmen');

      const transitions = smService.getAvailableTransitions(survey.id);

      expect(transitions).toEqual(['beendet']);
      expect(transitions).not.toContain('einwand_integration');
    });

    it('allows optionen_sammeln -> abstimmen with a single option as long as a question exists', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Freitext one option', votingMethod: 'freitext' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const optionId = addTestOption(survey.id, 'Option A');
      addFreitextQuestion(optionId);

      const fresh = surveyService.getSurveyById(survey.id);
      const result = smService.checkGuard(fresh, 'abstimmen');

      expect(result.allowed).toBe(true);
    });

    it('blocks optionen_sammeln -> abstimmen when no question is defined', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Freitext no question', votingMethod: 'freitext' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');
      addTestOption(survey.id, 'Option A');

      const fresh = surveyService.getSurveyById(survey.id);
      const result = smService.checkGuard(fresh, 'abstimmen');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Frage');
    });

    it('rejects abstimmen -> einwand_integration on freitext surveys', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Freitext', votingMethod: 'freitext' },
        userId
      );
      setSurveyStatus(survey.id, 'abstimmen');

      expect(() =>
        smService.transitionSurvey(survey.id, 'einwand_integration', userId)
      ).toThrow(ValidationError);
    });
  });
});
