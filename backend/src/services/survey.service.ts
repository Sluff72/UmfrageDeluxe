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

    if (survey.status !== 'entwurf') {
      throw new ForbiddenError('Survey can only be edited in draft status');
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

  getParticipantsForSurvey(surveyId: string): SurveyParticipant[] {
    const database = getDatabase();

    return database
      .prepare('SELECT * FROM survey_participants WHERE survey_id = ?')
      .all(surveyId) as SurveyParticipant[];
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
