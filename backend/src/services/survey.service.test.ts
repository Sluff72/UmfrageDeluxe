import { describe, it, expect, beforeEach } from 'vitest';
import argon2 from 'argon2';
import { getDatabase } from '../config/database';
import { SurveyService } from './survey.service';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
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

function setSurveyStatus(surveyId: string, status: string): void {
  const db = getDatabase();
  db.prepare('UPDATE surveys SET status = ? WHERE id = ?').run(status, surveyId);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SurveyService', () => {
  let service: SurveyService;

  beforeEach(() => {
    service = new SurveyService();

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
  // createSurvey
  // =========================================================================

  describe('createSurvey', () => {
    it('should create a survey with correct defaults', async () => {
      const userId = await createTestUser();

      const survey = service.createSurvey(
        { title: 'Test Survey', votingMethod: 'widerstand' },
        userId
      );

      expect(survey).toBeDefined();
      expect(survey.id).toBeTypeOf('string');
      expect(survey.title).toBe('Test Survey');
      expect(survey.description).toBeNull();
      expect(survey.status).toBe('entwurf');
      expect(survey.voting_method).toBe('widerstand');
      expect(survey.w_max).toBeNull();
      expect(survey.max_points_per_option).toBe(5);
      expect(survey.allow_anonymous).toBe(1);
      expect(survey.is_archived).toBe(0);
      expect(survey.created_by).toBe(userId);
      expect(survey.created_at).toBeTypeOf('string');
      expect(survey.updated_at).toBeTypeOf('string');
    });

    it('should generate a non-empty invite code', async () => {
      const userId = await createTestUser();

      const survey = service.createSurvey(
        { title: 'Invite Code Test', votingMethod: 'mehrheit' },
        userId
      );

      expect(survey.invite_code).toBeTypeOf('string');
      expect(survey.invite_code.length).toBeGreaterThan(0);
    });

    it('should generate unique invite codes for different surveys', async () => {
      const userId = await createTestUser();

      const survey1 = service.createSurvey(
        { title: 'Survey 1', votingMethod: 'widerstand' },
        userId
      );
      const survey2 = service.createSurvey(
        { title: 'Survey 2', votingMethod: 'widerstand' },
        userId
      );

      expect(survey1.invite_code).not.toBe(survey2.invite_code);
    });

    it('should add the creator as a host participant', async () => {
      const userId = await createTestUser();

      const survey = service.createSurvey(
        { title: 'Host Test', votingMethod: 'widerstand' },
        userId
      );

      const db = getDatabase();
      const participant = db
        .prepare(
          'SELECT * FROM survey_participants WHERE survey_id = ? AND user_id = ?'
        )
        .get(survey.id, userId) as SurveyParticipant | undefined;

      expect(participant).toBeDefined();
      expect(participant!.role).toBe('host');
      expect(participant!.survey_id).toBe(survey.id);
      expect(participant!.user_id).toBe(userId);
    });

    it('should respect provided optional fields', async () => {
      const userId = await createTestUser();

      const survey = service.createSurvey(
        {
          title: 'Full Options',
          description: 'A detailed description',
          votingMethod: 'widerstand_punkte',
          wMax: 10,
          maxPointsPerOption: 3,
          allowAnonymous: false,
        },
        userId
      );

      expect(survey.description).toBe('A detailed description');
      expect(survey.voting_method).toBe('widerstand_punkte');
      expect(survey.w_max).toBe(10);
      expect(survey.max_points_per_option).toBe(3);
      expect(survey.allow_anonymous).toBe(0);
    });
  });

  // =========================================================================
  // getSurveyById
  // =========================================================================

  describe('getSurveyById', () => {
    it('should return an existing survey', async () => {
      const userId = await createTestUser();
      const created = service.createSurvey(
        { title: 'Findable', votingMethod: 'widerstand' },
        userId
      );

      const found = service.getSurveyById(created.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.title).toBe('Findable');
    });

    it('should throw NotFoundError for a non-existent survey', () => {
      expect(() => service.getSurveyById('nonexistent-id')).toThrow(NotFoundError);
    });
  });

  // =========================================================================
  // getSurveyByInviteCode
  // =========================================================================

  describe('getSurveyByInviteCode', () => {
    it('should return a survey by its invite code', async () => {
      const userId = await createTestUser();
      const created = service.createSurvey(
        { title: 'By Code', votingMethod: 'widerstand' },
        userId
      );

      const found = service.getSurveyByInviteCode(created.invite_code);

      expect(found.id).toBe(created.id);
      expect(found.invite_code).toBe(created.invite_code);
    });

    it('should throw NotFoundError for an invalid invite code', () => {
      expect(() => service.getSurveyByInviteCode('INVALID')).toThrow(NotFoundError);
    });
  });

  // =========================================================================
  // listSurveysForUser
  // =========================================================================

  describe('listSurveysForUser', () => {
    it('should return an empty list when the user has no surveys', async () => {
      const userId = await createTestUser();

      const list = service.listSurveysForUser(userId);

      expect(list).toEqual([]);
    });

    it('should return surveys the user participates in', async () => {
      const userId = await createTestUser();
      service.createSurvey({ title: 'Survey A', votingMethod: 'widerstand' }, userId);
      service.createSurvey({ title: 'Survey B', votingMethod: 'mehrheit' }, userId);

      const list = service.listSurveysForUser(userId);

      expect(list).toHaveLength(2);
      const titles = list.map((s) => s.title);
      expect(titles).toContain('Survey A');
      expect(titles).toContain('Survey B');
    });

    it('should include participant_count on each survey', async () => {
      const hostId = await createTestUser('host');
      const otherId = await createTestUser('other');

      const survey = service.createSurvey(
        { title: 'Counting', votingMethod: 'widerstand' },
        hostId
      );

      // Second user joins
      service.joinSurveyByInviteCode(survey.invite_code, otherId, null, null);

      const list = service.listSurveysForUser(hostId);

      expect(list).toHaveLength(1);
      expect(list[0].participant_count).toBe(2);
    });

    it('should not return surveys belonging to other users', async () => {
      const user1 = await createTestUser('user1');
      const user2 = await createTestUser('user2');

      service.createSurvey({ title: 'User1 Survey', votingMethod: 'widerstand' }, user1);

      const listForUser2 = service.listSurveysForUser(user2);

      expect(listForUser2).toHaveLength(0);
    });
  });

  // =========================================================================
  // updateSurvey
  // =========================================================================

  describe('updateSurvey', () => {
    it('should update survey fields while in entwurf status', async () => {
      const userId = await createTestUser();
      const survey = service.createSurvey(
        { title: 'Original', votingMethod: 'widerstand' },
        userId
      );

      const updated = service.updateSurvey(
        survey.id,
        { title: 'Updated Title', description: 'New desc' },
        userId
      );

      expect(updated.title).toBe('Updated Title');
      expect(updated.description).toBe('New desc');
      expect(updated.id).toBe(survey.id);
    });

    it('should only update provided fields, leaving others unchanged', async () => {
      const userId = await createTestUser();
      const survey = service.createSurvey(
        {
          title: 'Original',
          description: 'Keep me',
          votingMethod: 'widerstand',
        },
        userId
      );

      const updated = service.updateSurvey(
        survey.id,
        { title: 'Changed' },
        userId
      );

      expect(updated.title).toBe('Changed');
      expect(updated.description).toBe('Keep me');
      expect(updated.voting_method).toBe('widerstand');
    });

    it('should reject update from a user who is not host or co_host', async () => {
      const hostId = await createTestUser('host');
      const otherId = await createTestUser('other');

      const survey = service.createSurvey(
        { title: 'Host Only', votingMethod: 'widerstand' },
        hostId
      );

      expect(() =>
        service.updateSurvey(survey.id, { title: 'Hacked' }, otherId)
      ).toThrow(ForbiddenError);
    });

    it('should allow a co_host to update the survey', async () => {
      const hostId = await createTestUser('host');
      const coHostId = await createTestUser('cohost');

      const survey = service.createSurvey(
        { title: 'Shared', votingMethod: 'widerstand' },
        hostId
      );

      // Promote coHostId to co_host
      service.addCoHost(survey.id, coHostId, hostId);

      const updated = service.updateSurvey(
        survey.id,
        { title: 'CoHost Edit' },
        coHostId
      );

      expect(updated.title).toBe('CoHost Edit');
    });

    it('should reject update when survey is not in entwurf status', async () => {
      const userId = await createTestUser();
      const survey = service.createSurvey(
        { title: 'Active', votingMethod: 'widerstand' },
        userId
      );

      setSurveyStatus(survey.id, 'abstimmen');

      expect(() =>
        service.updateSurvey(survey.id, { title: 'Too Late' }, userId)
      ).toThrow(ForbiddenError);
    });

    it('should throw NotFoundError when updating a non-existent survey', async () => {
      const userId = await createTestUser();

      expect(() =>
        service.updateSurvey('nonexistent-id', { title: 'X' }, userId)
      ).toThrow(NotFoundError);
    });
  });

  // =========================================================================
  // deleteSurvey
  // =========================================================================

  describe('deleteSurvey', () => {
    it('should delete a survey when called by the host', async () => {
      const userId = await createTestUser();
      const survey = service.createSurvey(
        { title: 'Delete Me', votingMethod: 'widerstand' },
        userId
      );

      service.deleteSurvey(survey.id, userId);

      expect(() => service.getSurveyById(survey.id)).toThrow(NotFoundError);
    });

    it('should reject deletion from a non-host user', async () => {
      const hostId = await createTestUser('host');
      const otherId = await createTestUser('other');

      const survey = service.createSurvey(
        { title: 'Protected', votingMethod: 'widerstand' },
        hostId
      );

      expect(() => service.deleteSurvey(survey.id, otherId)).toThrow(ForbiddenError);
    });

    it('should reject deletion from a co_host (only host allowed)', async () => {
      const hostId = await createTestUser('host');
      const coHostId = await createTestUser('cohost');

      const survey = service.createSurvey(
        { title: 'Strict Host', votingMethod: 'widerstand' },
        hostId
      );

      service.addCoHost(survey.id, coHostId, hostId);

      expect(() => service.deleteSurvey(survey.id, coHostId)).toThrow(ForbiddenError);
    });

    it('should throw NotFoundError when deleting a non-existent survey', async () => {
      const userId = await createTestUser();

      expect(() => service.deleteSurvey('nonexistent-id', userId)).toThrow(
        NotFoundError
      );
    });
  });

  // =========================================================================
  // archiveSurvey
  // =========================================================================

  describe('archiveSurvey', () => {
    it('should archive a survey that has beendet status', async () => {
      const userId = await createTestUser();
      const survey = service.createSurvey(
        { title: 'Completed', votingMethod: 'widerstand' },
        userId
      );

      setSurveyStatus(survey.id, 'beendet');

      const archived = service.archiveSurvey(survey.id, userId);

      expect(archived.is_archived).toBe(1);
      expect(archived.id).toBe(survey.id);
    });

    it('should reject archiving a survey that is not in beendet status', async () => {
      const userId = await createTestUser();
      const survey = service.createSurvey(
        { title: 'Still Draft', votingMethod: 'widerstand' },
        userId
      );

      // Status is still 'entwurf'
      expect(() => service.archiveSurvey(survey.id, userId)).toThrow(ValidationError);
    });

    it('should reject archiving from a non-host user', async () => {
      const hostId = await createTestUser('host');
      const otherId = await createTestUser('other');

      const survey = service.createSurvey(
        { title: 'Host Archive', votingMethod: 'widerstand' },
        hostId
      );

      setSurveyStatus(survey.id, 'beendet');

      expect(() => service.archiveSurvey(survey.id, otherId)).toThrow(ForbiddenError);
    });

    it('should reject archiving from a co_host (only host allowed)', async () => {
      const hostId = await createTestUser('host');
      const coHostId = await createTestUser('cohost');

      const survey = service.createSurvey(
        { title: 'Strict Archive', votingMethod: 'widerstand' },
        hostId
      );

      service.addCoHost(survey.id, coHostId, hostId);
      setSurveyStatus(survey.id, 'beendet');

      expect(() => service.archiveSurvey(survey.id, coHostId)).toThrow(ForbiddenError);
    });

    it('should throw NotFoundError when archiving a non-existent survey', async () => {
      const userId = await createTestUser();

      expect(() => service.archiveSurvey('nonexistent-id', userId)).toThrow(
        NotFoundError
      );
    });
  });

  // =========================================================================
  // joinSurveyByInviteCode
  // =========================================================================

  describe('joinSurveyByInviteCode', () => {
    it('should allow a registered user to join a survey', async () => {
      const hostId = await createTestUser('host');
      const joinerId = await createTestUser('joiner');

      const survey = service.createSurvey(
        { title: 'Join Me', votingMethod: 'widerstand' },
        hostId
      );

      const result = service.joinSurveyByInviteCode(
        survey.invite_code,
        joinerId,
        null,
        null
      );

      expect(result.survey.id).toBe(survey.id);
      expect(result.participant).toBeDefined();
      expect(result.participant.user_id).toBe(joinerId);
      expect(result.participant.role).toBe('teilnehmer');
      expect(result.participant.anonymous_name).toBeNull();
      expect(result.participant.anonymous_token).toBeNull();
    });

    it('should allow an anonymous user to join a survey', async () => {
      const hostId = await createTestUser('host');

      const survey = service.createSurvey(
        { title: 'Anon Survey', votingMethod: 'widerstand' },
        hostId
      );

      const result = service.joinSurveyByInviteCode(
        survey.invite_code,
        null,
        'Anonymous Fox',
        'anon-token-123'
      );

      expect(result.survey.id).toBe(survey.id);
      expect(result.participant.user_id).toBeNull();
      expect(result.participant.anonymous_name).toBe('Anonymous Fox');
      expect(result.participant.anonymous_token).toBe('anon-token-123');
      expect(result.participant.role).toBe('teilnehmer');
    });

    it('should reject anonymous join when allowAnonymous is disabled', async () => {
      const hostId = await createTestUser('host');

      const survey = service.createSurvey(
        { title: 'Registered Only', votingMethod: 'widerstand', allowAnonymous: false },
        hostId
      );

      expect(() =>
        service.joinSurveyByInviteCode(
          survey.invite_code,
          null,
          'Anonymous Fox',
          'anon-token-123'
        )
      ).toThrow(ForbiddenError);
    });

    it('should return the existing participant if a registered user has already joined', async () => {
      const hostId = await createTestUser('host');
      const joinerId = await createTestUser('joiner');

      const survey = service.createSurvey(
        { title: 'Double Join', votingMethod: 'widerstand' },
        hostId
      );

      const first = service.joinSurveyByInviteCode(
        survey.invite_code,
        joinerId,
        null,
        null
      );
      const second = service.joinSurveyByInviteCode(
        survey.invite_code,
        joinerId,
        null,
        null
      );

      expect(second.participant.id).toBe(first.participant.id);
      expect(second.participant.role).toBe('teilnehmer');
    });

    it('should return the existing host participant when the host joins via invite code', async () => {
      const hostId = await createTestUser('host');

      const survey = service.createSurvey(
        { title: 'Host Rejoin', votingMethod: 'widerstand' },
        hostId
      );

      const result = service.joinSurveyByInviteCode(
        survey.invite_code,
        hostId,
        null,
        null
      );

      expect(result.participant.user_id).toBe(hostId);
      expect(result.participant.role).toBe('host');
    });

    it('should throw NotFoundError for an invalid invite code', async () => {
      const userId = await createTestUser();

      expect(() =>
        service.joinSurveyByInviteCode('BAD_CODE', userId, null, null)
      ).toThrow(NotFoundError);
    });

    it('should throw ForbiddenError when joining an archived survey', async () => {
      const hostId = await createTestUser('host');
      const joinerId = await createTestUser('joiner');

      const survey = service.createSurvey(
        { title: 'Archived', votingMethod: 'widerstand' },
        hostId
      );

      // Move to beendet then archive
      setSurveyStatus(survey.id, 'beendet');
      service.archiveSurvey(survey.id, hostId);

      expect(() =>
        service.joinSurveyByInviteCode(survey.invite_code, joinerId, null, null)
      ).toThrow(ForbiddenError);
    });
  });
});
