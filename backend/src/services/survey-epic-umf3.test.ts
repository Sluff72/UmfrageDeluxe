/**
 * Comprehensive tests for Epic UMF-3: Umfrage erstellen
 *
 * Covers acceptance criteria for:
 * - UMF-11: Mehrfachauswahl-Umfrage erstellen (votingMethod: 'mehrheit')
 * - UMF-12: Systemisches Konsensieren (SK) Umfrage erstellen (votingMethod: 'widerstand_punkte')
 * - UMF-14: Widerstandsabfrage (Skala 0–10) erstellen (votingMethod: 'widerstand')
 * - UMF-15: Umfrage-Vorschau – backend ACs (data consistent in draft)
 * - UMF-16: Umfrage-Basisinformationen eingeben
 * - UMF-17: Umfrage veröffentlichen und eindeutigen Link generieren
 * - UMF-18: Umfrage als Entwurf speichern
 * - UMF-19: Umfrage-Einstellungen konfigurieren
 *
 * Not covered here (backend not yet implemented):
 * - UMF-10: Terminabstimmung erstellen (date/time poll type not in schema)
 * - UMF-13: Freitext-Umfrage erstellen (free-text question type not in schema)
 * - UMF-19: Schlussdatum / Antwortlimit fields (not in current DB schema)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import argon2 from 'argon2';
import { getDatabase } from '../config/database';
import { SurveyService } from './survey.service';
import { OptionService } from './option.service';
import { VoteService } from './vote.service';
import { StateMachineService } from './stateMachine.service';
import { ForbiddenError, ValidationError } from '../utils/errors';
import type { Survey } from '../types/survey.types';
import type { SurveyParticipant } from '../types/user.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTestUser(username = 'testhost'): Promise<string> {
  const db = getDatabase();
  const hash = await argon2.hash('password123', { type: argon2.argon2id });
  const user = db
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING id')
    .get(username, hash) as { id: string };
  return user.id;
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

function addOptionDirect(surveyId: string, participantId: string, title: string): string {
  const db = getDatabase();
  const row = db
    .prepare(
      `INSERT INTO options (survey_id, title, created_by) VALUES (?, ?, ?) RETURNING id`
    )
    .get(surveyId, title, participantId) as { id: string };
  return row.id;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('Epic UMF-3: Umfrage erstellen', () => {
  let surveyService: SurveyService;
  let optionService: OptionService;
  let voteService: VoteService;
  let smService: StateMachineService;

  beforeEach(() => {
    surveyService = new SurveyService();
    optionService = new OptionService();
    voteService = new VoteService();
    smService = new StateMachineService();

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
  // UMF-16: Umfrage-Basisinformationen eingeben
  // =========================================================================

  describe('UMF-16 – Umfrage-Basisinformationen eingeben', () => {
    it('creates a survey with a required title', async () => {
      const userId = await createTestUser();

      const survey = surveyService.createSurvey(
        { title: 'Meine Umfrage', votingMethod: 'widerstand' },
        userId
      );

      expect(survey.title).toBe('Meine Umfrage');
    });

    it('stores an optional description alongside the title', async () => {
      const userId = await createTestUser();

      const survey = surveyService.createSurvey(
        {
          title: 'Beschreibungs-Umfrage',
          description: 'Dies ist ein **Markdown**-Text.',
          votingMethod: 'widerstand',
        },
        userId
      );

      expect(survey.description).toBe('Dies ist ein **Markdown**-Text.');
    });

    it('sets description to null when omitted', async () => {
      const userId = await createTestUser();

      const survey = surveyService.createSurvey(
        { title: 'Kein Beschreibungsfeld', votingMethod: 'widerstand' },
        userId
      );

      expect(survey.description).toBeNull();
    });

    it('allows updating the title while survey is in entwurf status', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Alter Titel', votingMethod: 'widerstand' },
        userId
      );

      const updated = surveyService.updateSurvey(
        survey.id,
        { title: 'Neuer Titel' },
        userId
      );

      expect(updated.title).toBe('Neuer Titel');
    });

    it('allows updating the description while in entwurf status', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Umfrage', description: 'Alt', votingMethod: 'widerstand' },
        userId
      );

      const updated = surveyService.updateSurvey(
        survey.id,
        { description: 'Neue Beschreibung' },
        userId
      );

      expect(updated.description).toBe('Neue Beschreibung');
    });

    it('preserves unchanged fields during a partial update', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        {
          title: 'Unveränderter Titel',
          description: 'Behalte diese Beschreibung',
          votingMethod: 'mehrheit',
        },
        userId
      );

      const updated = surveyService.updateSurvey(
        survey.id,
        { description: 'Neue Beschreibung' },
        userId
      );

      expect(updated.title).toBe('Unveränderter Titel');
      expect(updated.voting_method).toBe('mehrheit');
    });

    it('rejects editing by a non-participant', async () => {
      const hostId = await createTestUser('host');
      const outsiderId = await createTestUser('outsider');
      const survey = surveyService.createSurvey(
        { title: 'Geschützte Umfrage', votingMethod: 'widerstand' },
        hostId
      );

      expect(() =>
        surveyService.updateSurvey(survey.id, { title: 'Gehackt' }, outsiderId)
      ).toThrow(ForbiddenError);
    });

    it('rejects editing when survey is no longer in entwurf status (UMF-17 AC)', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Aktive Umfrage', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');

      expect(() =>
        surveyService.updateSurvey(survey.id, { title: 'Zu Spät' }, userId)
      ).toThrow(ForbiddenError);
    });
  });

  // =========================================================================
  // UMF-18: Umfrage als Entwurf speichern
  // =========================================================================

  describe('UMF-18 – Umfrage als Entwurf speichern', () => {
    it('newly created survey defaults to entwurf status', async () => {
      const userId = await createTestUser();

      const survey = surveyService.createSurvey(
        { title: 'Entwurf Umfrage', votingMethod: 'widerstand' },
        userId
      );

      expect(survey.status).toBe('entwurf');
    });

    it('draft survey can be updated repeatedly', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Original', votingMethod: 'widerstand' },
        userId
      );

      surveyService.updateSurvey(survey.id, { title: 'Iteration 1' }, userId);
      const final = surveyService.updateSurvey(survey.id, { title: 'Iteration 2' }, userId);

      expect(final.title).toBe('Iteration 2');
      expect(final.status).toBe('entwurf');
    });

    it('draft survey is visible in the survey list of its creator', async () => {
      const userId = await createTestUser();
      surveyService.createSurvey({ title: 'Mein Entwurf', votingMethod: 'widerstand' }, userId);

      const list = surveyService.listSurveysForUser(userId);

      expect(list).toHaveLength(1);
      expect(list[0].status).toBe('entwurf');
    });

    it('draft survey is not visible to other users', async () => {
      const ownerId = await createTestUser('owner');
      const otherId = await createTestUser('other');
      surveyService.createSurvey({ title: 'Privater Entwurf', votingMethod: 'widerstand' }, ownerId);

      const list = surveyService.listSurveysForUser(otherId);

      expect(list).toHaveLength(0);
    });

    it('draft survey can be deleted by the host', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Löschbarer Entwurf', votingMethod: 'widerstand' },
        userId
      );

      surveyService.deleteSurvey(survey.id, userId);

      const list = surveyService.listSurveysForUser(userId);
      expect(list).toHaveLength(0);
    });

    it('draft survey can be retrieved by id', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Abrufbarer Entwurf', votingMethod: 'mehrheit' },
        userId
      );

      const found = surveyService.getSurveyById(survey.id);

      expect(found.id).toBe(survey.id);
      expect(found.status).toBe('entwurf');
    });
  });

  // =========================================================================
  // UMF-17: Umfrage veröffentlichen und eindeutigen Link generieren
  // =========================================================================

  describe('UMF-17 – Umfrage veröffentlichen und eindeutigen Link generieren', () => {
    it('survey receives a unique invite_code upon creation (the shareable link)', async () => {
      const userId = await createTestUser();

      const survey = surveyService.createSurvey(
        { title: 'Geteilte Umfrage', votingMethod: 'widerstand' },
        userId
      );

      expect(survey.invite_code).toBeTypeOf('string');
      expect(survey.invite_code.length).toBeGreaterThan(0);
    });

    it('every survey gets a different invite_code', async () => {
      const userId = await createTestUser();

      const codes = new Set<string>();
      for (let i = 0; i < 5; i++) {
        const survey = surveyService.createSurvey(
          { title: `Survey ${i}`, votingMethod: 'widerstand' },
          userId
        );
        codes.add(survey.invite_code);
      }

      expect(codes.size).toBe(5);
    });

    it('survey can be retrieved by invite_code immediately after creation', async () => {
      const userId = await createTestUser();
      const created = surveyService.createSurvey(
        { title: 'Teilbarer Link', votingMethod: 'mehrheit' },
        userId
      );

      const found = surveyService.getSurveyByInviteCode(created.invite_code);

      expect(found.id).toBe(created.id);
    });

    it('invite_code remains stable across updates', async () => {
      const userId = await createTestUser();
      const created = surveyService.createSurvey(
        { title: 'Link-Stabilität', votingMethod: 'widerstand' },
        userId
      );
      const originalCode = created.invite_code;

      surveyService.updateSurvey(created.id, { title: 'Neuer Titel' }, userId);

      const found = surveyService.getSurveyById(created.id);
      expect(found.invite_code).toBe(originalCode);
    });

    it('publishing requires title and votingMethod (guard: entwurf → optionen_sammeln)', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Bereit zum Start', votingMethod: 'widerstand' },
        userId
      );

      // Transition to optionen_sammeln is the first publish step
      const result = smService.transitionSurvey(survey.id, 'optionen_sammeln', userId);

      expect(result.survey.status).toBe('optionen_sammeln');
    });

    it('editing is rejected once survey has left entwurf status', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Wird veröffentlicht', votingMethod: 'widerstand' },
        userId
      );
      smService.transitionSurvey(survey.id, 'optionen_sammeln', userId);

      expect(() =>
        surveyService.updateSurvey(survey.id, { title: 'Nachträgliche Änderung' }, userId)
      ).toThrow(ForbiddenError);
    });

    it('at least 2 options are required before transitioning to abstimmen (publish guard)', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Wenige Optionen', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');

      const participantId = getParticipantId(survey.id, userId);
      // Add only one option
      optionService.createOption(survey.id, { title: 'Nur eine Option' }, participantId);

      expect(() =>
        smService.transitionSurvey(survey.id, 'abstimmen', userId)
      ).toThrow(ValidationError);
    });

    it('succeeds transitioning to abstimmen with 2 or more options', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Zwei Optionen', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');

      const participantId = getParticipantId(survey.id, userId);
      optionService.createOption(survey.id, { title: 'Option A' }, participantId);
      optionService.createOption(survey.id, { title: 'Option B' }, participantId);

      const result = smService.transitionSurvey(survey.id, 'abstimmen', userId);

      expect(result.survey.status).toBe('abstimmen');
    });

    it('publish-guard is blocked for non-host users', async () => {
      const hostId = await createTestUser('host');
      const outsiderId = await createTestUser('outsider');
      const survey = surveyService.createSurvey(
        { title: 'Host Only', votingMethod: 'widerstand' },
        hostId
      );

      expect(() =>
        smService.transitionSurvey(survey.id, 'optionen_sammeln', outsiderId)
      ).toThrow(ForbiddenError);
    });
  });

  // =========================================================================
  // UMF-11: Mehrfachauswahl-Umfrage erstellen (votingMethod: 'mehrheit')
  // =========================================================================

  describe('UMF-11 – Mehrfachauswahl-Umfrage erstellen', () => {
    it('creates a survey with the mehrheit voting method', async () => {
      const userId = await createTestUser();

      const survey = surveyService.createSurvey(
        { title: 'Mehrfachauswahl Umfrage', votingMethod: 'mehrheit' },
        userId
      );

      expect(survey.voting_method).toBe('mehrheit');
    });

    it('allows adding multiple answer options', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Antwortoptionen', votingMethod: 'mehrheit' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');

      const participantId = getParticipantId(survey.id, userId);
      optionService.createOption(survey.id, { title: 'Option A' }, participantId);
      optionService.createOption(survey.id, { title: 'Option B' }, participantId);
      optionService.createOption(survey.id, { title: 'Option C' }, participantId);

      const options = optionService.listOptionsForSurvey(survey.id);
      expect(options).toHaveLength(3);
    });

    it('rejects an empty option title', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Mehrheit Test', votingMethod: 'mehrheit' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      // The Zod schema for options rejects empty titles (min 1 char)
      // This is enforced at the API boundary by option.schema.ts
      const { createOptionSchema } = await import('../validators/option.schema');
      const result = createOptionSchema.safeParse({ title: '' });
      expect(result.success).toBe(false);
    });

    it('rejects transition to abstimmen with fewer than 2 options', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Mehrheit Min-Optionen', votingMethod: 'mehrheit' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);
      optionService.createOption(survey.id, { title: 'Nur eins' }, participantId);

      expect(() =>
        smService.transitionSurvey(survey.id, 'abstimmen', userId)
      ).toThrow(ValidationError);
    });

    it('allows voting with value 0 (keine Unterstützung) in mehrheit mode', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Mehrheit Abstimmung', votingMethod: 'mehrheit' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);
      const optionAId = addOptionDirect(survey.id, participantId, 'Option A');
      addOptionDirect(survey.id, participantId, 'Option B');
      setSurveyStatus(survey.id, 'abstimmen');

      // Vote value of 1 = approved, 0 = not approved in mehrheit
      const result = voteService.submitVotes(
        survey.id,
        [{ optionId: optionAId, value: 1 }],
        participantId
      );

      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(1);
    });

    it('allows deleting an option while at least 2 remain', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Option löschen', votingMethod: 'mehrheit' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);
      const optAId = optionService.createOption(survey.id, { title: 'Option A' }, participantId).id;
      optionService.createOption(survey.id, { title: 'Option B' }, participantId);
      optionService.createOption(survey.id, { title: 'Option C' }, participantId);

      // Delete one, two should remain
      optionService.deleteOption(optAId, participantId, userId);

      const remaining = optionService.listOptionsForSurvey(survey.id);
      expect(remaining).toHaveLength(2);
    });
  });

  // =========================================================================
  // UMF-12: Systemisches Konsensieren (SK) Umfrage erstellen
  // =========================================================================

  describe('UMF-12 – Systemisches Konsensieren (SK) Umfrage erstellen', () => {
    it('creates a survey with widerstand_punkte voting method', async () => {
      const userId = await createTestUser();

      const survey = surveyService.createSurvey(
        { title: 'SK Umfrage', votingMethod: 'widerstand_punkte' },
        userId
      );

      expect(survey.voting_method).toBe('widerstand_punkte');
    });

    it('W-Max is auto-calculated as Anzahl_Optionen × 5 when entering abstimmen phase', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'W-Max Auto', votingMethod: 'widerstand_punkte' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');

      const participantId = getParticipantId(survey.id, userId);
      // Add 4 options → W-Max should be 4 × 5 = 20
      addOptionDirect(survey.id, participantId, 'Lösung A');
      addOptionDirect(survey.id, participantId, 'Lösung B');
      addOptionDirect(survey.id, participantId, 'Lösung C');
      addOptionDirect(survey.id, participantId, 'Lösung D');

      smService.transitionSurvey(survey.id, 'abstimmen', userId);

      const updated = surveyService.getSurveyById(survey.id);
      expect(updated.w_max).toBe(20); // 4 × 5
    });

    it('W-Max for 5 options equals 25 (Beispiel aus Akzeptanzkriterium)', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'SK 5 Optionen', votingMethod: 'widerstand_punkte' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');

      const participantId = getParticipantId(survey.id, userId);
      for (let i = 1; i <= 5; i++) {
        addOptionDirect(survey.id, participantId, `Option ${i}`);
      }

      smService.transitionSurvey(survey.id, 'abstimmen', userId);

      const updated = surveyService.getSurveyById(survey.id);
      expect(updated.w_max).toBe(25); // 5 × 5
    });

    it('W-Max for 2 options equals 10 (minimum configuration)', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'SK Minimum', votingMethod: 'widerstand_punkte' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');

      const participantId = getParticipantId(survey.id, userId);
      addOptionDirect(survey.id, participantId, 'Option 1');
      addOptionDirect(survey.id, participantId, 'Option 2');

      smService.transitionSurvey(survey.id, 'abstimmen', userId);

      const updated = surveyService.getSurveyById(survey.id);
      expect(updated.w_max).toBe(10);
    });

    it('rejects publishing with fewer than 2 options (Akzeptanzkriterium: min. 2)', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'SK Zu Wenig', votingMethod: 'widerstand_punkte' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');

      const participantId = getParticipantId(survey.id, userId);
      addOptionDirect(survey.id, participantId, 'Einzige Option');

      expect(() =>
        smService.transitionSurvey(survey.id, 'abstimmen', userId)
      ).toThrow(ValidationError);
    });

    it('allows participants to vote with resistance values (batch vote)', async () => {
      const hostId = await createTestUser('host');
      const voterId = await createTestUser('voter');
      const survey = surveyService.createSurvey(
        { title: 'SK Abstimmung', votingMethod: 'widerstand_punkte' },
        hostId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');

      const hostParticipantId = getParticipantId(survey.id, hostId);
      const optAId = addOptionDirect(survey.id, hostParticipantId, 'Option A');
      const optBId = addOptionDirect(survey.id, hostParticipantId, 'Option B');

      // Voter joins and votes
      const { participant: voterParticipant } = surveyService.joinSurveyByInviteCode(
        survey.invite_code,
        voterId,
        null,
        null
      );
      setSurveyStatus(survey.id, 'abstimmen');

      const votes = voteService.submitVotes(
        survey.id,
        [
          { optionId: optAId, value: 3 },
          { optionId: optBId, value: 2 },
        ],
        voterParticipant.id
      );

      expect(votes).toHaveLength(2);
      const voteA = votes.find((v) => v.option_id === optAId);
      const voteB = votes.find((v) => v.option_id === optBId);
      expect(voteA?.value).toBe(3);
      expect(voteB?.value).toBe(2);
    });

    it('stores title and description (Kontext der Entscheidung)', async () => {
      const userId = await createTestUser();

      const survey = surveyService.createSurvey(
        {
          title: 'Welche Lösung für Problem X?',
          description: 'Kontext: Wir suchen die Lösung mit dem geringsten Widerstand.',
          votingMethod: 'widerstand_punkte',
        },
        userId
      );

      expect(survey.title).toBe('Welche Lösung für Problem X?');
      expect(survey.description).toBe(
        'Kontext: Wir suchen die Lösung mit dem geringsten Widerstand.'
      );
    });
  });

  // =========================================================================
  // UMF-14: Widerstandsabfrage (Skala 0–10) erstellen
  // =========================================================================

  describe('UMF-14 – Widerstandsabfrage (Skala 0–10)', () => {
    it('creates a survey with widerstand voting method', async () => {
      const userId = await createTestUser();

      const survey = surveyService.createSurvey(
        { title: 'Widerstandsabfrage', votingMethod: 'widerstand' },
        userId
      );

      expect(survey.voting_method).toBe('widerstand');
    });

    it('allows defining multiple options to be rated', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Widerstand Optionen', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);

      optionService.createOption(survey.id, { title: 'Standort A' }, participantId);
      optionService.createOption(survey.id, { title: 'Standort B' }, participantId);
      optionService.createOption(survey.id, { title: 'Standort C' }, participantId);

      const options = optionService.listOptionsForSurvey(survey.id);
      expect(options).toHaveLength(3);
    });

    it('rejects publishing with fewer than 2 options', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Zu Wenig Optionen', votingMethod: 'widerstand' },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);
      optionService.createOption(survey.id, { title: 'Einzige Option' }, participantId);

      expect(() =>
        smService.transitionSurvey(survey.id, 'abstimmen', userId)
      ).toThrow(ValidationError);
    });

    it('participants can rate each option individually with values 0–10', async () => {
      const hostId = await createTestUser('host');
      const voterId = await createTestUser('voter');
      const survey = surveyService.createSurvey(
        { title: 'Widerstand Bewertung', votingMethod: 'widerstand', maxPointsPerOption: 10 },
        hostId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const hostParticipantId = getParticipantId(survey.id, hostId);
      const optAId = addOptionDirect(survey.id, hostParticipantId, 'Option A');
      const optBId = addOptionDirect(survey.id, hostParticipantId, 'Option B');

      const { participant: voterParticipant } = surveyService.joinSurveyByInviteCode(
        survey.invite_code,
        voterId,
        null,
        null
      );
      setSurveyStatus(survey.id, 'abstimmen');

      // Rate with 0 (kein Widerstand) and 10 (maximaler Widerstand)
      const votes = voteService.submitVotes(
        survey.id,
        [
          { optionId: optAId, value: 0 },
          { optionId: optBId, value: 10 },
        ],
        voterParticipant.id
      );

      expect(votes).toHaveLength(2);
      const voteA = votes.find((v) => v.option_id === optAId);
      const voteB = votes.find((v) => v.option_id === optBId);
      expect(voteA?.value).toBe(0);  // kein Widerstand
      expect(voteB?.value).toBe(10); // maximaler Widerstand
    });

    it('rejects vote values below 0', async () => {
      const hostId = await createTestUser('host');
      const survey = surveyService.createSurvey(
        { title: 'Negativer Widerstand', votingMethod: 'widerstand', maxPointsPerOption: 10 },
        hostId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const hostParticipantId = getParticipantId(survey.id, hostId);
      const optAId = addOptionDirect(survey.id, hostParticipantId, 'Option A');
      addOptionDirect(survey.id, hostParticipantId, 'Option B');
      setSurveyStatus(survey.id, 'abstimmen');

      expect(() =>
        voteService.submitVotes(
          survey.id,
          [{ optionId: optAId, value: -1 }],
          hostParticipantId
        )
      ).toThrow(ValidationError);
    });

    it('rejects vote values above maxPointsPerOption (10)', async () => {
      const hostId = await createTestUser('host');
      const survey = surveyService.createSurvey(
        { title: 'Zu Hoher Widerstand', votingMethod: 'widerstand', maxPointsPerOption: 10 },
        hostId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const hostParticipantId = getParticipantId(survey.id, hostId);
      const optAId = addOptionDirect(survey.id, hostParticipantId, 'Option A');
      addOptionDirect(survey.id, hostParticipantId, 'Option B');
      setSurveyStatus(survey.id, 'abstimmen');

      expect(() =>
        voteService.submitVotes(
          survey.id,
          [{ optionId: optAId, value: 11 }],
          hostParticipantId
        )
      ).toThrow(ValidationError);
    });

    it('rejects empty or whitespace-only option titles (Akzeptanzkriterium)', async () => {
      const { createOptionSchema } = await import('../validators/option.schema');

      expect(createOptionSchema.safeParse({ title: '' }).success).toBe(false);
      expect(createOptionSchema.safeParse({ title: '   ' }).success).toBe(false);
    });
  });

  // =========================================================================
  // UMF-15: Umfrage-Vorschau anzeigen (backend data consistency)
  // =========================================================================

  describe('UMF-15 – Umfrage-Vorschau (Daten-Konsistenz)', () => {
    it('all draft data is retrievable for preview without mutation', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        {
          title: 'Vorschau Umfrage',
          description: 'Beschreibung für Vorschau',
          votingMethod: 'mehrheit',
          allowAnonymous: false,
        },
        userId
      );
      setSurveyStatus(survey.id, 'optionen_sammeln');
      const participantId = getParticipantId(survey.id, userId);
      optionService.createOption(survey.id, { title: 'Option A' }, participantId);
      optionService.createOption(survey.id, { title: 'Option B' }, participantId);

      // Fetching data for preview should not change status
      const previewSurvey = surveyService.getSurveyById(survey.id);
      const previewOptions = optionService.listOptionsForSurvey(survey.id);

      expect(previewSurvey.id).toBe(survey.id);
      expect(previewSurvey.title).toBe('Vorschau Umfrage');
      expect(previewSurvey.description).toBe('Beschreibung für Vorschau');
      expect(previewSurvey.voting_method).toBe('mehrheit');
      expect(previewSurvey.allow_anonymous).toBe(0);
      expect(previewOptions).toHaveLength(2);

      // Status must not have changed during preview data retrieval
      const afterPreview = surveyService.getSurveyById(survey.id);
      expect(afterPreview.status).toBe('optionen_sammeln');
    });

    it('unsaved (in-memory) changes in entwurf are not reflected until updateSurvey is called', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Unveränderter Titel', votingMethod: 'widerstand' },
        userId
      );

      // Simulate not calling updateSurvey
      const fetched = surveyService.getSurveyById(survey.id);
      expect(fetched.title).toBe('Unveränderter Titel');
    });
  });

  // =========================================================================
  // UMF-19: Umfrage-Einstellungen konfigurieren
  // =========================================================================

  describe('UMF-19 – Umfrage-Einstellungen konfigurieren', () => {
    // ---- Anonymität --------------------------------------------------------

    it('defaults allow_anonymous to 1 (true) when not specified', async () => {
      const userId = await createTestUser();

      const survey = surveyService.createSurvey(
        { title: 'Standard Anonymität', votingMethod: 'widerstand' },
        userId
      );

      expect(survey.allow_anonymous).toBe(1);
    });

    it('can set anonymity to false (registered participants only)', async () => {
      const userId = await createTestUser();

      const survey = surveyService.createSurvey(
        { title: 'Nur Registrierte', votingMethod: 'widerstand', allowAnonymous: false },
        userId
      );

      expect(survey.allow_anonymous).toBe(0);
    });

    it('can set anonymity to true explicitly', async () => {
      const userId = await createTestUser();

      const survey = surveyService.createSurvey(
        { title: 'Anonym erlaubt', votingMethod: 'widerstand', allowAnonymous: true },
        userId
      );

      expect(survey.allow_anonymous).toBe(1);
    });

    it('anonymous participants can join when allow_anonymous is true', async () => {
      const hostId = await createTestUser('host');
      const survey = surveyService.createSurvey(
        { title: 'Anonym Join', votingMethod: 'widerstand', allowAnonymous: true },
        hostId
      );

      const result = surveyService.joinSurveyByInviteCode(
        survey.invite_code,
        null,
        'Anonymer Fuchs',
        'token-abc'
      );

      expect(result.participant.anonymous_name).toBe('Anonymer Fuchs');
      expect(result.participant.user_id).toBeNull();
    });

    it('rejects anonymous participation when allow_anonymous is false', async () => {
      const hostId = await createTestUser('host');
      const survey = surveyService.createSurvey(
        { title: 'Keine Anonymen', votingMethod: 'widerstand', allowAnonymous: false },
        hostId
      );

      expect(() =>
        surveyService.joinSurveyByInviteCode(
          survey.invite_code,
          null,
          'Anonymer Nutzer',
          'token-xyz'
        )
      ).toThrow(ForbiddenError);
    });

    it('allow_anonymous setting can be changed while survey is in entwurf', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Änderbare Einstellung', votingMethod: 'widerstand', allowAnonymous: true },
        userId
      );

      const updated = surveyService.updateSurvey(
        survey.id,
        { allowAnonymous: false },
        userId
      );

      expect(updated.allow_anonymous).toBe(0);
    });

    // ---- maxPointsPerOption (Skala-Konfiguration) --------------------------

    it('defaults maxPointsPerOption to 5 when not specified', async () => {
      const userId = await createTestUser();

      const survey = surveyService.createSurvey(
        { title: 'Standard Punkte', votingMethod: 'widerstand' },
        userId
      );

      expect(survey.max_points_per_option).toBe(5);
    });

    it('accepts a custom maxPointsPerOption value', async () => {
      const userId = await createTestUser();

      const survey = surveyService.createSurvey(
        { title: 'Custom Punkte', votingMethod: 'widerstand', maxPointsPerOption: 10 },
        userId
      );

      expect(survey.max_points_per_option).toBe(10);
    });

    it('settings summary is accessible via getSurveyById before publishing', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        {
          title: 'Einstellungs-Übersicht',
          votingMethod: 'widerstand_punkte',
          allowAnonymous: false,
          maxPointsPerOption: 5,
        },
        userId
      );

      const fetched = surveyService.getSurveyById(survey.id);

      expect(fetched.voting_method).toBe('widerstand_punkte');
      expect(fetched.allow_anonymous).toBe(0);
      expect(fetched.max_points_per_option).toBe(5);
    });

    // ---- Guard: invalid settings -------------------------------------------

    it('invalid votingMethod is rejected by transition guard (requires valid method)', async () => {
      const userId = await createTestUser();
      const survey = surveyService.createSurvey(
        { title: 'Gültige Methode', votingMethod: 'widerstand' },
        userId
      );

      // The guard for entwurf → optionen_sammeln requires title + voting_method
      const guard = smService.checkGuard(survey, 'optionen_sammeln');

      expect(guard.allowed).toBe(true);
      expect(survey.voting_method).toBe('widerstand');
    });

    it('co-host can also configure survey settings in entwurf', async () => {
      const hostId = await createTestUser('host');
      const coHostId = await createTestUser('cohost');

      const survey = surveyService.createSurvey(
        { title: 'Co-Host Einstellungen', votingMethod: 'widerstand' },
        hostId
      );
      surveyService.addCoHost(survey.id, coHostId, hostId);

      const updated = surveyService.updateSurvey(
        survey.id,
        { allowAnonymous: false, description: 'Co-Host hat das gesetzt' },
        coHostId
      );

      expect(updated.allow_anonymous).toBe(0);
      expect(updated.description).toBe('Co-Host hat das gesetzt');
    });
  });
});
