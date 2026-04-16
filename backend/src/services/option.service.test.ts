import { describe, it, expect, beforeEach } from 'vitest';
import argon2 from 'argon2';
import { getDatabase } from '../config/database';
import { OptionService } from './option.service';
import { SurveyService } from './survey.service';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import type { Survey } from '../types/survey.types';
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

function createTestSurvey(userId: string): Survey {
  const surveyService = new SurveyService();
  return surveyService.createSurvey(
    { title: 'Test Survey', votingMethod: 'widerstand' },
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

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('OptionService', () => {
  let service: OptionService;
  let surveyService: SurveyService;

  beforeEach(() => {
    service = new OptionService();
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
  // createOption
  // =========================================================================

  describe('createOption', () => {
    it('should create an option successfully during optionen_sammeln', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const option = service.createOption(
        survey.id,
        { title: 'Option A' },
        participantId
      );

      expect(option).toBeDefined();
      expect(option.id).toBeTypeOf('string');
      expect(option.survey_id).toBe(survey.id);
      expect(option.title).toBe('Option A');
      expect(option.created_at).toBeTypeOf('string');
      expect(option.updated_at).toBeTypeOf('string');
    });

    it('should store title and description correctly', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const option = service.createOption(
        survey.id,
        { title: 'Option B', description: 'A detailed description' },
        participantId
      );

      expect(option.title).toBe('Option B');
      expect(option.description).toBe('A detailed description');
    });

    it('should set description to null when not provided', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const option = service.createOption(
        survey.id,
        { title: 'No Desc' },
        participantId
      );

      expect(option.description).toBeNull();
    });

    it('should set created_by to the participant id', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const option = service.createOption(
        survey.id,
        { title: 'Authored Option' },
        participantId
      );

      expect(option.created_by).toBe(participantId);
    });

    it('should reject when survey is in entwurf status', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      // survey defaults to 'entwurf'
      const participantId = getParticipantId(survey.id, userId);

      expect(() =>
        service.createOption(survey.id, { title: 'Too Early' }, participantId)
      ).toThrow(ForbiddenError);
    });

    it('should reject when survey is in abstimmen status', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'abstimmen');
      const participantId = getParticipantId(survey.id, userId);

      expect(() =>
        service.createOption(survey.id, { title: 'Too Late' }, participantId)
      ).toThrow(ForbiddenError);
    });

    it('should reject when survey is in einwand_integration status', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'einwand_integration');
      const participantId = getParticipantId(survey.id, userId);

      expect(() =>
        service.createOption(survey.id, { title: 'Wrong Phase' }, participantId)
      ).toThrow(ForbiddenError);
    });

    it('should reject when survey is in beendet status', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'beendet');
      const participantId = getParticipantId(survey.id, userId);

      expect(() =>
        service.createOption(survey.id, { title: 'Finished' }, participantId)
      ).toThrow(ForbiddenError);
    });
  });

  // =========================================================================
  // listOptionsForSurvey
  // =========================================================================

  describe('listOptionsForSurvey', () => {
    it('should return an empty array when no options exist', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);

      const options = service.listOptionsForSurvey(survey.id);

      expect(options).toEqual([]);
    });

    it('should return all options for a survey ordered by created_at ASC', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      service.createOption(survey.id, { title: 'First' }, participantId);
      service.createOption(survey.id, { title: 'Second' }, participantId);
      service.createOption(survey.id, { title: 'Third' }, participantId);

      const options = service.listOptionsForSurvey(survey.id);

      expect(options).toHaveLength(3);
      expect(options[0].title).toBe('First');
      expect(options[1].title).toBe('Second');
      expect(options[2].title).toBe('Third');
    });

    it('should throw NotFoundError for a non-existent survey', () => {
      expect(() => service.listOptionsForSurvey('nonexistent-id')).toThrow(
        NotFoundError
      );
    });

    it('should not return options from a different survey', async () => {
      const userId = await createTestUser();
      const survey1 = createTestSurvey(userId);
      const survey2 = surveyService.createSurvey(
        { title: 'Other Survey', votingMethod: 'widerstand' },
        userId
      );

      setSurveyStatus(survey1.id, 'optionen_sammeln');
      setSurveyStatus(survey2.id, 'optionen_sammeln');

      const participant1Id = getParticipantId(survey1.id, userId);
      const participant2Id = getParticipantId(survey2.id, userId);

      service.createOption(survey1.id, { title: 'Survey1 Option' }, participant1Id);
      service.createOption(survey2.id, { title: 'Survey2 Option' }, participant2Id);

      const options1 = service.listOptionsForSurvey(survey1.id);
      const options2 = service.listOptionsForSurvey(survey2.id);

      expect(options1).toHaveLength(1);
      expect(options1[0].title).toBe('Survey1 Option');
      expect(options2).toHaveLength(1);
      expect(options2[0].title).toBe('Survey2 Option');
    });
  });

  // =========================================================================
  // getOptionById
  // =========================================================================

  describe('getOptionById', () => {
    it('should return an option when found', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const created = service.createOption(
        survey.id,
        { title: 'Findable', description: 'desc' },
        participantId
      );

      const found = service.getOptionById(created.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.title).toBe('Findable');
      expect(found.description).toBe('desc');
      expect(found.survey_id).toBe(survey.id);
      expect(found.created_by).toBe(participantId);
    });

    it('should throw NotFoundError for a non-existent option', () => {
      expect(() => service.getOptionById('nonexistent-id')).toThrow(NotFoundError);
    });
  });

  // =========================================================================
  // updateOption
  // =========================================================================

  describe('updateOption', () => {
    it('should allow the creator to update their own option', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const option = service.createOption(
        survey.id,
        { title: 'Original', description: 'Original desc' },
        participantId
      );

      const updated = service.updateOption(
        option.id,
        { title: 'Updated Title', description: 'Updated desc' },
        participantId,
        userId
      );

      expect(updated.title).toBe('Updated Title');
      expect(updated.description).toBe('Updated desc');
      expect(updated.id).toBe(option.id);
    });

    it('should allow the host to update any option', async () => {
      const hostId = await createTestUser('host');
      const memberId = await createTestUser('member');
      const survey = createTestSurvey(hostId);

      // Member joins the survey
      surveyService.joinSurveyByInviteCode(survey.invite_code, memberId, null, null);

      setSurveyStatus(survey.id, 'optionen_sammeln');
      const memberParticipantId = getParticipantId(survey.id, memberId);

      const option = service.createOption(
        survey.id,
        { title: 'Member Option' },
        memberParticipantId
      );

      // Host updates the member's option
      const hostParticipantId = getParticipantId(survey.id, hostId);
      const updated = service.updateOption(
        option.id,
        { title: 'Host Edited' },
        hostParticipantId,
        hostId
      );

      expect(updated.title).toBe('Host Edited');
    });

    it('should allow a co-host to update any option', async () => {
      const hostId = await createTestUser('host');
      const coHostId = await createTestUser('cohost');
      const memberId = await createTestUser('member');
      const survey = createTestSurvey(hostId);

      // Co-host and member join
      surveyService.addCoHost(survey.id, coHostId, hostId);
      surveyService.joinSurveyByInviteCode(survey.invite_code, memberId, null, null);

      setSurveyStatus(survey.id, 'optionen_sammeln');
      const memberParticipantId = getParticipantId(survey.id, memberId);
      const coHostParticipantId = getParticipantId(survey.id, coHostId);

      const option = service.createOption(
        survey.id,
        { title: 'Member Option' },
        memberParticipantId
      );

      // Co-host updates the member's option
      const updated = service.updateOption(
        option.id,
        { title: 'CoHost Edited' },
        coHostParticipantId,
        coHostId
      );

      expect(updated.title).toBe('CoHost Edited');
    });

    it('should throw ForbiddenError when non-creator non-host tries to update', async () => {
      const hostId = await createTestUser('host');
      const creatorId = await createTestUser('creator');
      const otherId = await createTestUser('other');
      const survey = createTestSurvey(hostId);

      surveyService.joinSurveyByInviteCode(survey.invite_code, creatorId, null, null);
      surveyService.joinSurveyByInviteCode(survey.invite_code, otherId, null, null);

      setSurveyStatus(survey.id, 'optionen_sammeln');
      const creatorParticipantId = getParticipantId(survey.id, creatorId);
      const otherParticipantId = getParticipantId(survey.id, otherId);

      const option = service.createOption(
        survey.id,
        { title: 'Creator Option' },
        creatorParticipantId
      );

      expect(() =>
        service.updateOption(
          option.id,
          { title: 'Unauthorized Edit' },
          otherParticipantId,
          otherId
        )
      ).toThrow(ForbiddenError);
    });

    it('should reject update when survey is not in optionen_sammeln', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const option = service.createOption(
        survey.id,
        { title: 'Created in Time' },
        participantId
      );

      // Advance status past optionen_sammeln
      setSurveyStatus(survey.id, 'abstimmen');

      expect(() =>
        service.updateOption(
          option.id,
          { title: 'Too Late' },
          participantId,
          userId
        )
      ).toThrow(ForbiddenError);
    });

    it('should only update provided fields (partial update)', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const option = service.createOption(
        survey.id,
        { title: 'Keep Title', description: 'Keep Desc' },
        participantId
      );

      // Only update description
      const updated = service.updateOption(
        option.id,
        { description: 'New Desc' },
        participantId,
        userId
      );

      expect(updated.title).toBe('Keep Title');
      expect(updated.description).toBe('New Desc');
    });

    it('should only update title when only title is provided', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const option = service.createOption(
        survey.id,
        { title: 'Original Title', description: 'Original Desc' },
        participantId
      );

      const updated = service.updateOption(
        option.id,
        { title: 'New Title' },
        participantId,
        userId
      );

      expect(updated.title).toBe('New Title');
      expect(updated.description).toBe('Original Desc');
    });

    it('should throw NotFoundError when updating a non-existent option', async () => {
      const userId = await createTestUser();

      expect(() =>
        service.updateOption(
          'nonexistent-id',
          { title: 'Ghost' },
          'fake-participant',
          userId
        )
      ).toThrow(NotFoundError);
    });
  });

  // =========================================================================
  // deleteOption
  // =========================================================================

  describe('deleteOption', () => {
    it('should allow the creator to delete their own option', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const option = service.createOption(
        survey.id,
        { title: 'Delete Me' },
        participantId
      );

      service.deleteOption(option.id, participantId, userId);

      expect(() => service.getOptionById(option.id)).toThrow(NotFoundError);
    });

    it('should allow the host to delete any option', async () => {
      const hostId = await createTestUser('host');
      const memberId = await createTestUser('member');
      const survey = createTestSurvey(hostId);

      surveyService.joinSurveyByInviteCode(survey.invite_code, memberId, null, null);

      setSurveyStatus(survey.id, 'optionen_sammeln');
      const memberParticipantId = getParticipantId(survey.id, memberId);
      const hostParticipantId = getParticipantId(survey.id, hostId);

      const option = service.createOption(
        survey.id,
        { title: 'Member Option' },
        memberParticipantId
      );

      // Host deletes the member's option
      service.deleteOption(option.id, hostParticipantId, hostId);

      expect(() => service.getOptionById(option.id)).toThrow(NotFoundError);
    });

    it('should allow a co-host to delete any option', async () => {
      const hostId = await createTestUser('host');
      const coHostId = await createTestUser('cohost');
      const memberId = await createTestUser('member');
      const survey = createTestSurvey(hostId);

      surveyService.addCoHost(survey.id, coHostId, hostId);
      surveyService.joinSurveyByInviteCode(survey.invite_code, memberId, null, null);

      setSurveyStatus(survey.id, 'optionen_sammeln');
      const memberParticipantId = getParticipantId(survey.id, memberId);
      const coHostParticipantId = getParticipantId(survey.id, coHostId);

      const option = service.createOption(
        survey.id,
        { title: 'Member Option' },
        memberParticipantId
      );

      // Co-host deletes the member's option
      service.deleteOption(option.id, coHostParticipantId, coHostId);

      expect(() => service.getOptionById(option.id)).toThrow(NotFoundError);
    });

    it('should throw ForbiddenError when non-creator non-host tries to delete', async () => {
      const hostId = await createTestUser('host');
      const creatorId = await createTestUser('creator');
      const otherId = await createTestUser('other');
      const survey = createTestSurvey(hostId);

      surveyService.joinSurveyByInviteCode(survey.invite_code, creatorId, null, null);
      surveyService.joinSurveyByInviteCode(survey.invite_code, otherId, null, null);

      setSurveyStatus(survey.id, 'optionen_sammeln');
      const creatorParticipantId = getParticipantId(survey.id, creatorId);
      const otherParticipantId = getParticipantId(survey.id, otherId);

      const option = service.createOption(
        survey.id,
        { title: 'Creator Option' },
        creatorParticipantId
      );

      expect(() =>
        service.deleteOption(option.id, otherParticipantId, otherId)
      ).toThrow(ForbiddenError);
    });

    it('should reject deletion when survey is not in optionen_sammeln', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const option = service.createOption(
        survey.id,
        { title: 'Created in Time' },
        participantId
      );

      // Advance status
      setSurveyStatus(survey.id, 'abstimmen');

      expect(() =>
        service.deleteOption(option.id, participantId, userId)
      ).toThrow(ForbiddenError);
    });

    it('should throw NotFoundError when deleting a non-existent option', async () => {
      const userId = await createTestUser();

      expect(() =>
        service.deleteOption('nonexistent-id', 'fake-participant', userId)
      ).toThrow(NotFoundError);
    });
  });

  // =========================================================================
  // resolveParticipantId
  // =========================================================================

  describe('resolveParticipantId', () => {
    it('should return the participant id when an anonymous participant is passed', async () => {
      const hostId = await createTestUser('host');
      const survey = createTestSurvey(hostId);

      // Add an anonymous participant
      const result = surveyService.joinSurveyByInviteCode(
        survey.invite_code,
        null,
        'Anonymous Fox',
        'anon-token-abc'
      );

      const resolved = service.resolveParticipantId(
        survey.id,
        null,
        result.participant
      );

      expect(resolved).toBe(result.participant.id);
    });

    it('should reject participant context from a different survey', async () => {
      const hostId = await createTestUser('host');
      const surveyA = createTestSurvey(hostId);
      const surveyB = createTestSurvey(hostId);

      const result = surveyService.joinSurveyByInviteCode(
        surveyA.invite_code,
        null,
        'Anonymous Fox',
        'anon-token-abc'
      );

      expect(() =>
        service.resolveParticipantId(
          surveyB.id,
          null,
          result.participant
        )
      ).toThrow(ForbiddenError);
    });

    it('should resolve participant id from userId when no participant is passed', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      const expectedParticipantId = getParticipantId(survey.id, userId);

      const resolved = service.resolveParticipantId(survey.id, userId, undefined);

      expect(resolved).toBe(expectedParticipantId);
    });

    it('should throw ForbiddenError when user is not a participant in the survey', async () => {
      const hostId = await createTestUser('host');
      const outsiderId = await createTestUser('outsider');
      const survey = createTestSurvey(hostId);

      expect(() =>
        service.resolveParticipantId(survey.id, outsiderId, undefined)
      ).toThrow(ForbiddenError);
    });

    it('should throw ForbiddenError when userId is null and no participant is provided', async () => {
      const hostId = await createTestUser('host');
      const survey = createTestSurvey(hostId);

      expect(() =>
        service.resolveParticipantId(survey.id, null, undefined)
      ).toThrow(ForbiddenError);
    });

    it('should prefer participant.id over userId lookup when both are available', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);

      // Join as anonymous to get a separate participant record
      const anonResult = surveyService.joinSurveyByInviteCode(
        survey.invite_code,
        null,
        'Anon User',
        'anon-token-xyz'
      );

      // Pass both an anonymous participant and a userId -- participant should win
      const resolved = service.resolveParticipantId(
        survey.id,
        userId,
        anonResult.participant
      );

      expect(resolved).toBe(anonResult.participant.id);
    });
  });

  // =========================================================================
  // moveOption (sort)
  // =========================================================================

  describe('moveOption', () => {
    it('should assign incrementing positions on create', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const a = service.createOption(survey.id, { title: 'A' }, participantId);
      const b = service.createOption(survey.id, { title: 'B' }, participantId);
      const c = service.createOption(survey.id, { title: 'C' }, participantId);

      expect(a.position).toBe(0);
      expect(b.position).toBe(1);
      expect(c.position).toBe(2);
    });

    it('should return options ordered by position ASC', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      service.createOption(survey.id, { title: 'A' }, participantId);
      const b = service.createOption(survey.id, { title: 'B' }, participantId);
      service.createOption(survey.id, { title: 'C' }, participantId);

      service.moveOption(b.id, 'up', userId);

      const ordered = service.listOptionsForSurvey(survey.id);
      expect(ordered.map((o) => o.title)).toEqual(['B', 'A', 'C']);
    });

    it('should swap positions when moving up', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      service.createOption(survey.id, { title: 'A' }, participantId);
      const b = service.createOption(survey.id, { title: 'B' }, participantId);

      service.moveOption(b.id, 'up', userId);

      const updated = service.listOptionsForSurvey(survey.id);
      expect(updated[0].title).toBe('B');
      expect(updated[1].title).toBe('A');
    });

    it('should swap positions when moving down', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const a = service.createOption(survey.id, { title: 'A' }, participantId);
      service.createOption(survey.id, { title: 'B' }, participantId);

      service.moveOption(a.id, 'down', userId);

      const updated = service.listOptionsForSurvey(survey.id);
      expect(updated[0].title).toBe('B');
      expect(updated[1].title).toBe('A');
    });

    it('should reject moving the topmost option up', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      const a = service.createOption(survey.id, { title: 'A' }, participantId);
      service.createOption(survey.id, { title: 'B' }, participantId);

      expect(() => service.moveOption(a.id, 'up', userId)).toThrow(
        'Option ist bereits ganz oben'
      );
    });

    it('should reject moving the bottommost option down', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      service.createOption(survey.id, { title: 'A' }, participantId);
      const b = service.createOption(survey.id, { title: 'B' }, participantId);

      expect(() => service.moveOption(b.id, 'down', userId)).toThrow(
        'Option ist bereits ganz unten'
      );
    });

    it('should allow a co-host to reorder options', async () => {
      const hostId = await createTestUser('host');
      const coHostId = await createTestUser('cohost');
      const survey = createTestSurvey(hostId);
      setSurveyStatus(survey.id, 'optionen_sammeln');

      surveyService.addCoHost(survey.id, coHostId, hostId);
      const hostParticipantId = getParticipantId(survey.id, hostId);

      service.createOption(survey.id, { title: 'A' }, hostParticipantId);
      const b = service.createOption(survey.id, { title: 'B' }, hostParticipantId);

      service.moveOption(b.id, 'up', coHostId);

      const updated = service.listOptionsForSurvey(survey.id);
      expect(updated[0].title).toBe('B');
    });

    it('should forbid regular participants from reordering options', async () => {
      const hostId = await createTestUser('host');
      const memberId = await createTestUser('member');
      const survey = createTestSurvey(hostId);
      setSurveyStatus(survey.id, 'optionen_sammeln');

      // Add member as regular participant
      surveyService.joinSurveyByInviteCode(
        survey.invite_code,
        memberId,
        null,
        null
      );

      const hostParticipantId = getParticipantId(survey.id, hostId);
      service.createOption(survey.id, { title: 'A' }, hostParticipantId);
      const b = service.createOption(survey.id, { title: 'B' }, hostParticipantId);

      expect(() => service.moveOption(b.id, 'up', memberId)).toThrow(
        ForbiddenError
      );
    });

    it('should reject reordering outside optionen_sammeln phase', async () => {
      const userId = await createTestUser();
      const survey = createTestSurvey(userId);
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      service.createOption(survey.id, { title: 'A' }, participantId);
      const b = service.createOption(survey.id, { title: 'B' }, participantId);

      setSurveyStatus(survey.id, 'abstimmen');

      expect(() => service.moveOption(b.id, 'up', userId)).toThrow(
        ForbiddenError
      );
    });

    it('should throw NotFoundError for unknown optionId', async () => {
      const userId = await createTestUser();
      expect(() => service.moveOption('nonexistent-id', 'up', userId)).toThrow(
        NotFoundError
      );
    });
  });
});
