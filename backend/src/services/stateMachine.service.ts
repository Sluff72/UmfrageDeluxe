import { getDatabase } from '../config/database';
import { ForbiddenError, ValidationError } from '../utils/errors';
import { surveyService } from './survey.service';
import type { Survey, SurveyStatus } from '../types/survey.types';

// ---------------------------------------------------------------------------
// Valid Transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<SurveyStatus, SurveyStatus[]> = {
  entwurf: ['optionen_sammeln'],
  optionen_sammeln: ['abstimmen'],
  abstimmen: ['einwand_integration', 'beendet'],
  einwand_integration: ['abstimmen', 'beendet'],
  beendet: [],
};

// ---------------------------------------------------------------------------
// Guard result
// ---------------------------------------------------------------------------

export interface GuardResult {
  allowed: boolean;
  reason?: string;
  warning?: string;
}

export interface VotingProgress {
  votedCount: number;
  participantCount: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class StateMachineService {
  /**
   * Returns which target states are structurally valid from the current status.
   */
  getAvailableTransitions(surveyId: string): SurveyStatus[] {
    const survey = surveyService.getSurveyById(surveyId);
    return VALID_TRANSITIONS[survey.status] ?? [];
  }

  /**
   * Checks whether a specific transition is allowed **right now**, including
   * guard conditions. Returns a GuardResult so the caller can decide whether
   * to proceed or to show a warning / error.
   */
  checkGuard(survey: Survey, targetStatus: SurveyStatus): GuardResult {
    const database = getDatabase();

    // --- entwurf → optionen_sammeln ---
    if (survey.status === 'entwurf' && targetStatus === 'optionen_sammeln') {
      if (!survey.title || !survey.voting_method) {
        return { allowed: false, reason: 'Titel und Abstimmungsmethode müssen konfiguriert sein' };
      }
      return { allowed: true };
    }

    // --- optionen_sammeln → abstimmen ---
    if (survey.status === 'optionen_sammeln' && targetStatus === 'abstimmen') {
      const optionCount = database
        .prepare('SELECT COUNT(*) as count FROM options WHERE survey_id = ?')
        .get(survey.id) as { count: number };

      if (optionCount.count < 2) {
        return { allowed: false, reason: 'Mindestens 2 Optionen sind erforderlich' };
      }
      return { allowed: true };
    }

    // --- abstimmen → einwand_integration ---
    if (survey.status === 'abstimmen' && targetStatus === 'einwand_integration') {
      const { votedCount, participantCount } = this.getVotingProgress(survey.id);

      if (votedCount < participantCount) {
        return {
          allowed: true,
          warning: `Nicht alle Teilnehmer haben abgestimmt (${votedCount}/${participantCount})`,
        };
      }
      return { allowed: true };
    }

    // --- abstimmen → beendet (skip objection phase) ---
    if (survey.status === 'abstimmen' && targetStatus === 'beendet') {
      return { allowed: true };
    }

    // --- einwand_integration → abstimmen (re-vote) ---
    if (survey.status === 'einwand_integration' && targetStatus === 'abstimmen') {
      const integratedCount = database
        .prepare(
          `SELECT COUNT(*) as count FROM objections
           WHERE survey_id = ? AND status = 'integrated'`
        )
        .get(survey.id) as { count: number };

      if (integratedCount.count === 0) {
        return { allowed: false, reason: 'Mindestens ein Einwand muss integriert worden sein, bevor erneut abgestimmt werden kann' };
      }
      return { allowed: true };
    }

    // --- einwand_integration → beendet ---
    if (survey.status === 'einwand_integration' && targetStatus === 'beendet') {
      return { allowed: true };
    }

    // Catch-all for unexpected combinations
    return { allowed: false, reason: 'Ungültiger Phasenübergang' };
  }

  /**
   * Perform the transition. Validates structure + guards, updates the DB,
   * and returns the updated survey. Throws on failure.
   */
  transitionSurvey(surveyId: string, targetStatus: SurveyStatus, userId: string): {
    survey: Survey;
    previousStatus: SurveyStatus;
    warning?: string;
  } {
    const survey = surveyService.getSurveyById(surveyId);

    // Only host or co-host may trigger transitions
    this.assertHostOrCoHost(surveyId, userId);

    // Structural validation
    const validTargets = VALID_TRANSITIONS[survey.status];
    if (!validTargets.includes(targetStatus)) {
      throw new ValidationError(
        `Übergang von "${survey.status}" nach "${targetStatus}" ist nicht erlaubt`
      );
    }

    // Guard conditions
    const guard = this.checkGuard(survey, targetStatus);
    if (!guard.allowed) {
      throw new ValidationError(guard.reason!);
    }

    const previousStatus = survey.status;
    const database = getDatabase();

    // Special handling: Re-vote starts a new round so previous results stay
    // intact as history, and unresolved objections are closed for the new round.
    if (survey.status === 'einwand_integration' && targetStatus === 'abstimmen') {
      database
        .prepare(
          `UPDATE surveys SET current_voting_round = current_voting_round + 1
           WHERE id = ?`
        )
        .run(surveyId);

      database
        .prepare(
          `UPDATE objections SET status = 'dismissed'
           WHERE survey_id = ? AND status = 'pending'`
        )
        .run(surveyId);
    }

    // Auto-calculate W-Max for widerstand_punkte when entering abstimmen
    if (targetStatus === 'abstimmen' && survey.voting_method === 'widerstand_punkte') {
      const optionCount = database
        .prepare('SELECT COUNT(*) as count FROM options WHERE survey_id = ?')
        .get(surveyId) as { count: number };

      const calculatedWMax = optionCount.count * 5;
      database
        .prepare(
          `UPDATE surveys SET w_max = ?, max_points_per_option = 10 WHERE id = ?`
        )
        .run(calculatedWMax, surveyId);
    }

    // Perform the transition
    const updatedSurvey = database
      .prepare(
        `UPDATE surveys SET status = ?, updated_at = datetime('now')
         WHERE id = ?
         RETURNING *`
      )
      .get(targetStatus, surveyId) as Survey;

    return {
      survey: updatedSurvey,
      previousStatus,
      warning: guard.warning,
    };
  }

  /**
   * Returns the current voting round for a survey (1-based). The round is
   * stored on the survey and incremented by the re-vote transition.
   */
  getCurrentVotingRound(surveyId: string): number {
    const survey = surveyService.getSurveyById(surveyId);
    return survey.current_voting_round;
  }

  /**
   * Returns how many participants have voted in the current round.
   * Counts distinct voters, so partial submissions across options count once.
   */
  getVotingProgress(surveyId: string): VotingProgress {
    const database = getDatabase();
    const currentRound = this.getCurrentVotingRound(surveyId);

    const participantCount = database
      .prepare('SELECT COUNT(*) as count FROM survey_participants WHERE survey_id = ?')
      .get(surveyId) as { count: number };

    const voterCount = database
      .prepare(
        `SELECT COUNT(DISTINCT participant_id) as count
         FROM votes
         WHERE survey_id = ? AND voting_round = ?`
      )
      .get(surveyId, currentRound) as { count: number };

    return {
      votedCount: voterCount.count,
      participantCount: participantCount.count,
    };
  }

  /**
   * Returns summary info for the frontend to render the PhaseController.
   * votingProgress is only included during the voting phase.
   */
  getTransitionInfo(surveyId: string): {
    currentStatus: SurveyStatus;
    availableTransitions: Array<{
      targetStatus: SurveyStatus;
      allowed: boolean;
      reason?: string;
      warning?: string;
    }>;
    votingRound: number;
    votingProgress?: VotingProgress;
  } {
    const survey = surveyService.getSurveyById(surveyId);
    const validTargets = VALID_TRANSITIONS[survey.status] ?? [];

    const availableTransitions = validTargets.map((targetStatus) => {
      const guard = this.checkGuard(survey, targetStatus);
      return {
        targetStatus,
        allowed: guard.allowed,
        reason: guard.reason,
        warning: guard.warning,
      };
    });

    return {
      currentStatus: survey.status,
      availableTransitions,
      votingRound: this.getCurrentVotingRound(surveyId),
      ...(survey.status === 'abstimmen'
        ? { votingProgress: this.getVotingProgress(surveyId) }
        : {}),
    };
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
      throw new ForbiddenError('Nur Host oder Co-Host können Phasenübergänge auslösen');
    }
  }
}

export const stateMachineService = new StateMachineService();
