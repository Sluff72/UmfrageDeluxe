import { getDatabase } from '../config/database';
import { generateInviteCode } from '../utils/inviteCode';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import type {
  Survey,
  SurveyWithParticipantCount,
  CreateSurveyInput,
  UpdateSurveyInput,
} from '../types/survey.types';
import type { SurveyParticipant } from '../types/user.types';

const DUPLICATE_TITLE_PREFIX = 'Kopie von ';
const TITLE_MAX_LENGTH = 300;

function buildDuplicateTitle(originalTitle: string): string {
  const withPrefix = `${DUPLICATE_TITLE_PREFIX}${originalTitle}`;
  if (withPrefix.length <= TITLE_MAX_LENGTH) {
    return withPrefix;
  }
  // Preserve the prefix so the copy remains identifiable even when we truncate.
  return withPrefix.slice(0, TITLE_MAX_LENGTH);
}

export class SurveyService {
  createSurvey(input: CreateSurveyInput, userId: string): Survey {
    const database = getDatabase();
    const inviteCode = this.generateUniqueInviteCode();

    const survey = database
      .prepare(
        `INSERT INTO surveys (title, description, voting_method, w_max, max_points_per_option, invite_code, allow_anonymous, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING *`
      )
      .get(
        input.title,
        input.description ?? null,
        input.votingMethod,
        input.wMax ?? null,
        input.maxPointsPerOption ?? 5,
        inviteCode,
        input.allowAnonymous !== false ? 1 : 0,
        userId
      ) as Survey;

    // Automatically add the creator as host participant
    database
      .prepare(
        `INSERT INTO survey_participants (survey_id, user_id, role)
         VALUES (?, ?, 'host')`
      )
      .run(survey.id, userId);

    return survey;
  }

  getSurveyById(surveyId: string): Survey {
    const database = getDatabase();

    const survey = database
      .prepare('SELECT * FROM surveys WHERE id = ?')
      .get(surveyId) as Survey | undefined;

    if (!survey) {
      throw new NotFoundError('Survey');
    }

    return survey;
  }

  getSurveyByInviteCode(inviteCode: string): Survey {
    const database = getDatabase();

    const survey = database
      .prepare('SELECT * FROM surveys WHERE invite_code = ?')
      .get(inviteCode) as Survey | undefined;

    if (!survey) {
      throw new NotFoundError('Survey');
    }

    return survey;
  }

  listSurveysForUser(userId: string): SurveyWithParticipantCount[] {
    const database = getDatabase();

    return database
      .prepare(
        `SELECT s.*,
                (SELECT COUNT(*) FROM survey_participants WHERE survey_id = s.id) as participant_count
         FROM surveys s
         INNER JOIN survey_participants sp ON sp.survey_id = s.id
         WHERE sp.user_id = ?
         ORDER BY s.updated_at DESC`
      )
      .all(userId) as SurveyWithParticipantCount[];
  }

  updateSurvey(surveyId: string, input: UpdateSurveyInput, userId: string): Survey {
    const survey = this.getSurveyById(surveyId);
    this.assertHostOrCoHost(surveyId, userId);

    if (survey.status !== 'entwurf' && survey.status !== 'optionen_sammeln') {
      throw new ForbiddenError(
        'Einstellungen können nur in den Phasen "Entwurf" und "Optionen Sammeln" geändert werden'
      );
    }

    // In `optionen_sammeln`, only voting-related fields are editable.
    // Options already exist and participants may have joined, so changing
    // title/description/anonymity at that point is explicitly disallowed.
    if (survey.status === 'optionen_sammeln') {
      if (
        input.title !== undefined ||
        input.description !== undefined ||
        input.allowAnonymous !== undefined
      ) {
        throw new ForbiddenError(
          'In der Phase "Optionen Sammeln" können nur Abstimmungsmethode, W-Max und Punkte pro Option geändert werden'
        );
      }
    }

    const database = getDatabase();

    const updatedSurvey = database
      .prepare(
        `UPDATE surveys SET
           title = COALESCE(?, title),
           description = COALESCE(?, description),
           voting_method = COALESCE(?, voting_method),
           w_max = COALESCE(?, w_max),
           max_points_per_option = COALESCE(?, max_points_per_option),
           allow_anonymous = COALESCE(?, allow_anonymous),
           updated_at = datetime('now')
         WHERE id = ?
         RETURNING *`
      )
      .get(
        input.title ?? null,
        input.description ?? null,
        input.votingMethod ?? null,
        input.wMax ?? null,
        input.maxPointsPerOption ?? null,
        input.allowAnonymous !== undefined ? (input.allowAnonymous ? 1 : 0) : null,
        surveyId
      ) as Survey;

    return updatedSurvey;
  }

  deleteSurvey(surveyId: string, userId: string): void {
    this.getSurveyById(surveyId); // throws if not found
    this.assertHost(surveyId, userId);

    const database = getDatabase();
    database.prepare('DELETE FROM surveys WHERE id = ?').run(surveyId);
  }

  /**
   * Duplicate a survey. Only the host or a co-host of the original survey
   * can perform this action. The copy:
   *   - starts directly in the `optionen_sammeln` phase
   *   - is owned by the duplicating user (they become the new host)
   *   - inherits the voting method, budget, description and anonymity setting
   *   - copies all options (title, description, position) attributed to the new host
   *
   * Votes, objections and participants of the original are NOT copied.
   */
  duplicateSurvey(surveyId: string, userId: string): Survey {
    const original = this.getSurveyById(surveyId);
    this.assertHostOrCoHost(surveyId, userId);

    const database = getDatabase();
    const newInviteCode = this.generateUniqueInviteCode();
    const newTitle = buildDuplicateTitle(original.title);

    const duplicateTransaction = database.transaction(() => {
      const newSurvey = database
        .prepare(
          `INSERT INTO surveys (
              title, description, status, voting_method,
              w_max, max_points_per_option,
              invite_code, allow_anonymous, created_by
            )
            VALUES (?, ?, 'optionen_sammeln', ?, ?, ?, ?, ?, ?)
            RETURNING *`
        )
        .get(
          newTitle,
          original.description,
          original.voting_method,
          original.w_max,
          original.max_points_per_option,
          newInviteCode,
          original.allow_anonymous,
          userId
        ) as Survey;

      const newHostParticipant = database
        .prepare(
          `INSERT INTO survey_participants (survey_id, user_id, role)
           VALUES (?, ?, 'host')
           RETURNING id`
        )
        .get(newSurvey.id, userId) as { id: string };

      database
        .prepare(
          `INSERT INTO options (survey_id, title, description, created_by, position)
           SELECT ?, title, description, ?, position
             FROM options
            WHERE survey_id = ?`
        )
        .run(newSurvey.id, newHostParticipant.id, surveyId);

      return newSurvey;
    });

    return duplicateTransaction();
  }

  archiveSurvey(surveyId: string, userId: string): Survey {
    const survey = this.getSurveyById(surveyId);
    this.assertHost(surveyId, userId);

    if (survey.status !== 'beendet') {
      throw new ValidationError('Only completed surveys can be archived');
    }

    const database = getDatabase();

    return database
      .prepare(
        `UPDATE surveys SET is_archived = 1, updated_at = datetime('now')
         WHERE id = ?
         RETURNING *`
      )
      .get(surveyId) as Survey;
  }

  getParticipantsForSurvey(surveyId: string): (SurveyParticipant & { display_name: string })[] {
    const database = getDatabase();

    return database
      .prepare(
        `SELECT sp.*,
                COALESCE(u.display_name, u.username, sp.anonymous_name, 'Anonym') as display_name
         FROM survey_participants sp
         LEFT JOIN users u ON u.id = sp.user_id
         WHERE sp.survey_id = ?
         ORDER BY
           CASE sp.role WHEN 'host' THEN 0 WHEN 'co_host' THEN 1 ELSE 2 END,
           sp.joined_at ASC`
      )
      .all(surveyId) as (SurveyParticipant & { display_name: string })[];
  }

  addCoHost(surveyId: string, targetUserId: string, actorUserId: string): SurveyParticipant {
    this.assertHost(surveyId, actorUserId);

    const database = getDatabase();

    // Check if user is already a participant
    const existing = database
      .prepare('SELECT * FROM survey_participants WHERE survey_id = ? AND user_id = ?')
      .get(surveyId, targetUserId) as SurveyParticipant | undefined;

    if (existing) {
      // Promote to co_host
      return database
        .prepare(
          `UPDATE survey_participants SET role = 'co_host' WHERE id = ? RETURNING *`
        )
        .get(existing.id) as SurveyParticipant;
    }

    return database
      .prepare(
        `INSERT INTO survey_participants (survey_id, user_id, role)
         VALUES (?, ?, 'co_host')
         RETURNING *`
      )
      .get(surveyId, targetUserId) as SurveyParticipant;
  }

  joinSurveyByInviteCode(
    inviteCode: string,
    userId: string | null,
    anonymousName: string | null,
    anonymousToken: string | null
  ): { survey: Survey; participant: SurveyParticipant } {
    const survey = this.getSurveyByInviteCode(inviteCode);

    if (survey.is_archived) {
      throw new ForbiddenError('This survey is archived');
    }

    if (!userId && !survey.allow_anonymous) {
      throw new ForbiddenError('Anonymous participation is disabled for this survey');
    }

    const database = getDatabase();

    // Check if registered user is already a participant
    if (userId) {
      const existing = database
        .prepare('SELECT * FROM survey_participants WHERE survey_id = ? AND user_id = ?')
        .get(survey.id, userId) as SurveyParticipant | undefined;

      if (existing) {
        return { survey, participant: existing };
      }
    }

    // Create new participant
    const participant = database
      .prepare(
        `INSERT INTO survey_participants (survey_id, user_id, anonymous_name, anonymous_token, role)
         VALUES (?, ?, ?, ?, 'teilnehmer')
         RETURNING *`
      )
      .get(
        survey.id,
        userId,
        anonymousName,
        anonymousToken
      ) as SurveyParticipant;

    return { survey, participant };
  }

  /**
   * Update a participant's role. Only the host can do this.
   * Cannot change the host's own role.
   */
  updateParticipantRole(
    surveyId: string,
    participantId: string,
    newRole: 'co_host' | 'teilnehmer',
    actorUserId: string
  ): SurveyParticipant {
    this.assertHost(surveyId, actorUserId);

    const database = getDatabase();

    const participant = database
      .prepare('SELECT * FROM survey_participants WHERE id = ? AND survey_id = ?')
      .get(participantId, surveyId) as SurveyParticipant | undefined;

    if (!participant) {
      throw new NotFoundError('Teilnehmer nicht gefunden');
    }

    if (participant.role === 'host') {
      throw new ForbiddenError('Die Rolle des Hosts kann nicht geändert werden');
    }

    // Only registered users can become co-hosts (anonymous users lack JWT for requireAuth endpoints)
    if (newRole === 'co_host' && !participant.user_id) {
      throw new ValidationError('Nur registrierte Teilnehmer können zum Co-Host befördert werden');
    }

    if (participant.role === newRole) {
      return participant;
    }

    return database
      .prepare('UPDATE survey_participants SET role = ? WHERE id = ? RETURNING *')
      .get(newRole, participantId) as SurveyParticipant;
  }

  private assertHost(surveyId: string, userId: string): void {
    const database = getDatabase();

    const participant = database
      .prepare(
        `SELECT * FROM survey_participants WHERE survey_id = ? AND user_id = ? AND role = 'host'`
      )
      .get(surveyId, userId) as SurveyParticipant | undefined;

    if (!participant) {
      throw new ForbiddenError('Only the host can perform this action');
    }
  }

  private assertHostOrCoHost(surveyId: string, userId: string): void {
    const database = getDatabase();

    const participant = database
      .prepare(
        `SELECT * FROM survey_participants WHERE survey_id = ? AND user_id = ? AND role IN ('host', 'co_host')`
      )
      .get(surveyId, userId) as SurveyParticipant | undefined;

    if (!participant) {
      throw new ForbiddenError('Only the host or co-host can perform this action');
    }
  }

  private generateUniqueInviteCode(): string {
    const database = getDatabase();
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = generateInviteCode();
      const existing = database
        .prepare('SELECT id FROM surveys WHERE invite_code = ?')
        .get(code);

      if (!existing) {
        return code;
      }

      attempts++;
    } while (attempts < maxAttempts);

    throw new Error('Failed to generate unique invite code after maximum attempts');
  }
}

export const surveyService = new SurveyService();
