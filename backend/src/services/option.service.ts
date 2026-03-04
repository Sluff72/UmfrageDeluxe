import { getDatabase } from '../config/database';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import { surveyService } from './survey.service';
import type { Option, CreateOptionInput, UpdateOptionInput } from '../types/option.types';
import type { SurveyParticipant } from '../types/user.types';

export class OptionService {
  /**
   * Create a new option for a survey.
   * Any participant can add options during the optionen_sammeln phase.
   */
  createOption(surveyId: string, input: CreateOptionInput, participantId: string): Option {
    const survey = surveyService.getSurveyById(surveyId);

    if (survey.status !== 'optionen_sammeln') {
      throw new ForbiddenError('Optionen können nur in der Phase "Optionen Sammeln" hinzugefügt werden');
    }

    const database = getDatabase();

    const option = database
      .prepare(
        `INSERT INTO options (survey_id, title, description, created_by)
         VALUES (?, ?, ?, ?)
         RETURNING *`
      )
      .get(
        surveyId,
        input.title,
        input.description ?? null,
        participantId
      ) as Option;

    return option;
  }

  /**
   * List all options for a survey.
   */
  listOptionsForSurvey(surveyId: string): Option[] {
    surveyService.getSurveyById(surveyId); // throws if not found

    const database = getDatabase();

    return database
      .prepare('SELECT * FROM options WHERE survey_id = ? ORDER BY created_at ASC')
      .all(surveyId) as Option[];
  }

  /**
   * Get a single option by ID.
   */
  getOptionById(optionId: string): Option {
    const database = getDatabase();

    const option = database
      .prepare('SELECT * FROM options WHERE id = ?')
      .get(optionId) as Option | undefined;

    if (!option) {
      throw new NotFoundError('Option');
    }

    return option;
  }

  /**
   * Update an option. Only the creator or host/co-host can update.
   * Only allowed during optionen_sammeln.
   */
  updateOption(
    optionId: string,
    input: UpdateOptionInput,
    participantId: string,
    userId: string | null
  ): Option {
    const option = this.getOptionById(optionId);
    const survey = surveyService.getSurveyById(option.survey_id);

    if (survey.status !== 'optionen_sammeln') {
      throw new ForbiddenError('Optionen können nur in der Phase "Optionen Sammeln" bearbeitet werden');
    }

    // Check permission: creator or host/co_host
    if (option.created_by !== participantId) {
      this.assertHostOrCoHost(option.survey_id, userId);
    }

    const database = getDatabase();

    const updatedOption = database
      .prepare(
        `UPDATE options SET
           title = COALESCE(?, title),
           description = COALESCE(?, description),
           updated_at = datetime('now')
         WHERE id = ?
         RETURNING *`
      )
      .get(
        input.title ?? null,
        input.description ?? null,
        optionId
      ) as Option;

    return updatedOption;
  }

  /**
   * Delete an option. Only the creator or host/co-host can delete.
   * Only allowed during optionen_sammeln.
   */
  deleteOption(
    optionId: string,
    participantId: string,
    userId: string | null
  ): void {
    const option = this.getOptionById(optionId);
    const survey = surveyService.getSurveyById(option.survey_id);

    if (survey.status !== 'optionen_sammeln') {
      throw new ForbiddenError('Optionen können nur in der Phase "Optionen Sammeln" gelöscht werden');
    }

    // Check permission: creator or host/co_host
    if (option.created_by !== participantId) {
      this.assertHostOrCoHost(option.survey_id, userId);
    }

    const database = getDatabase();
    database.prepare('DELETE FROM options WHERE id = ?').run(optionId);
  }

  /**
   * Resolve the participant ID for the current user in a given survey.
   */
  resolveParticipantId(surveyId: string, userId: string | null, participant: SurveyParticipant | undefined): string {
    if (participant) {
      if (participant.survey_id !== surveyId) {
        throw new ForbiddenError('Du bist kein Teilnehmer dieser Umfrage');
      }
      return participant.id;
    }

    if (!userId) {
      throw new ForbiddenError('Du bist kein Teilnehmer dieser Umfrage');
    }

    const database = getDatabase();
    const found = database
      .prepare('SELECT id FROM survey_participants WHERE survey_id = ? AND user_id = ?')
      .get(surveyId, userId) as { id: string } | undefined;

    if (!found) {
      throw new ForbiddenError('Du bist kein Teilnehmer dieser Umfrage');
    }

    return found.id;
  }

  private assertHostOrCoHost(surveyId: string, userId: string | null): void {
    if (!userId) {
      throw new ForbiddenError('Nur Host oder Co-Host können fremde Optionen bearbeiten');
    }

    const database = getDatabase();
    const participant = database
      .prepare(
        `SELECT * FROM survey_participants
         WHERE survey_id = ? AND user_id = ? AND role IN ('host', 'co_host')`
      )
      .get(surveyId, userId);

    if (!participant) {
      throw new ForbiddenError('Nur Host oder Co-Host können fremde Optionen bearbeiten');
    }
  }
}

export const optionService = new OptionService();
