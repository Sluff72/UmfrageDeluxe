import { getDatabase } from '../config/database';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { surveyService } from './survey.service';
import { stateMachineService } from './stateMachine.service';
import type { Objection, CreateObjectionInput, ReviewObjectionInput } from '../types/objection.types';

export class ObjectionService {
  /**
   * Submit an objection during the einwand_integration phase.
   */
  createObjection(surveyId: string, input: CreateObjectionInput, participantId: string): Objection {
    const survey = surveyService.getSurveyById(surveyId);

    if (survey.status !== 'einwand_integration') {
      throw new ForbiddenError('Einwände können nur in der Phase "Einwand Integration" eingereicht werden');
    }

    const database = getDatabase();

    // Validate that the option belongs to this survey
    const option = database
      .prepare('SELECT id FROM options WHERE id = ? AND survey_id = ?')
      .get(input.optionId, surveyId);

    if (!option) {
      throw new ValidationError('Die angegebene Option existiert nicht in dieser Umfrage');
    }
    const currentRound = stateMachineService.getCurrentVotingRound(surveyId);

    const objection = database
      .prepare(
        `INSERT INTO objections (survey_id, participant_id, option_id, text, voting_round)
         VALUES (?, ?, ?, ?, ?)
         RETURNING *`
      )
      .get(
        surveyId,
        participantId,
        input.optionId,
        input.text,
        currentRound
      ) as Objection;

    return objection;
  }

  /**
   * List all objections for a survey, optionally filtered by voting round.
   */
  listObjections(surveyId: string): Objection[] {
    surveyService.getSurveyById(surveyId); // throws if not found

    const database = getDatabase();

    return database
      .prepare(
        `SELECT * FROM objections
         WHERE survey_id = ?
         ORDER BY created_at ASC`
      )
      .all(surveyId) as Objection[];
  }

  /**
   * Get a single objection by ID.
   */
  getObjectionById(objectionId: string): Objection {
    const database = getDatabase();

    const objection = database
      .prepare('SELECT * FROM objections WHERE id = ?')
      .get(objectionId) as Objection | undefined;

    if (!objection) {
      throw new NotFoundError('Einwand nicht gefunden');
    }

    return objection;
  }

  /**
   * Review an objection (host/co-host only).
   * Sets the status to 'integrated' or 'dismissed' with an optional response.
   */
  reviewObjection(objectionId: string, input: ReviewObjectionInput, surveyId: string, userId: string): Objection {
    const objection = this.getObjectionById(objectionId);

    if (objection.survey_id !== surveyId) {
      throw new ForbiddenError('Einwand gehört nicht zu dieser Umfrage');
    }

    const survey = surveyService.getSurveyById(surveyId);

    if (survey.status !== 'einwand_integration') {
      throw new ForbiddenError('Einwände können nur in der Phase "Einwand Integration" bearbeitet werden');
    }

    // Only host/co-host can review
    this.assertHostOrCoHost(surveyId, userId);

    if (objection.status !== 'pending') {
      throw new ValidationError('Dieser Einwand wurde bereits bearbeitet');
    }

    const database = getDatabase();

    const updated = database
      .prepare(
        `UPDATE objections
         SET status = ?, host_response = ?
         WHERE id = ?
         RETURNING *`
      )
      .get(input.status, input.hostResponse ?? null, objectionId) as Objection;

    return updated;
  }

  private assertHostOrCoHost(surveyId: string, userId: string): void {
    const database = getDatabase();

    const participant = database
      .prepare(
        `SELECT * FROM survey_participants
         WHERE survey_id = ? AND user_id = ? AND role IN ('host', 'co_host')`
      )
      .get(surveyId, userId);

    if (!participant) {
      throw new ForbiddenError('Nur Host oder Co-Host können Einwände bearbeiten');
    }
  }
}

export const objectionService = new ObjectionService();
