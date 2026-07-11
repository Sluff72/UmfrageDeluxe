import { getDatabase } from '../config/database';
import { ForbiddenError, ValidationError } from '../utils/errors';
import { surveyService } from './survey.service';
import { stateMachineService } from './stateMachine.service';
import type {
  Vote,
  VoteInput,
  VoteResult,
  VoteResultWithObjections,
  ObjectionWithAuthor,
  ParticipantResult,
  ParticipantVote,
} from '../types/vote.types';
import type { Survey } from '../types/survey.types';
import type { SurveyParticipant } from '../types/user.types';

export class VoteService {
  /**
   * Submit a batch of votes for all options in a survey.
   * Replaces any existing votes for the current voting round.
   */
  submitVotes(
    surveyId: string,
    votes: VoteInput[],
    participantId: string
  ): Vote[] {
    const survey = surveyService.getSurveyById(surveyId);

    if (survey.status !== 'abstimmen') {
      throw new ForbiddenError('Abstimmung ist nur in der Phase "Abstimmen" möglich');
    }

    // Validate votes against survey method
    this.validateVotes(survey, votes);

    const database = getDatabase();
    const currentRound = stateMachineService.getCurrentVotingRound(surveyId);

    // Delete existing votes for this participant in this round
    database
      .prepare(
        'DELETE FROM votes WHERE survey_id = ? AND participant_id = ? AND voting_round = ?'
      )
      .run(surveyId, participantId, currentRound);

    // Insert new votes
    const insertStmt = database.prepare(
      `INSERT INTO votes (survey_id, option_id, participant_id, value, voting_round)
       VALUES (?, ?, ?, ?, ?)
       RETURNING *`
    );

    const insertedVotes: Vote[] = [];

    const insertAll = database.transaction(() => {
      for (const vote of votes) {
        const inserted = insertStmt.get(
          surveyId,
          vote.optionId,
          participantId,
          vote.value,
          currentRound
        ) as Vote;
        insertedVotes.push(inserted);
      }
    });

    insertAll();

    return insertedVotes;
  }

  /**
   * Get the current user's votes for a survey in the current round.
   */
  getMyVotes(surveyId: string, participantId: string): Vote[] {
    surveyService.getSurveyById(surveyId); // throws if not found

    const database = getDatabase();
    const currentRound = stateMachineService.getCurrentVotingRound(surveyId);

    return database
      .prepare(
        `SELECT * FROM votes
         WHERE survey_id = ? AND participant_id = ? AND voting_round = ?
         ORDER BY created_at ASC`
      )
      .all(surveyId, participantId, currentRound) as Vote[];
  }

  /**
   * Get all votes for a survey in the current round (host/co-host only).
   */
  getAllVotes(surveyId: string): Vote[] {
    surveyService.getSurveyById(surveyId); // throws if not found

    const database = getDatabase();
    const currentRound = stateMachineService.getCurrentVotingRound(surveyId);

    return database
      .prepare(
        `SELECT * FROM votes
         WHERE survey_id = ? AND voting_round = ?
         ORDER BY option_id, created_at ASC`
      )
      .all(surveyId, currentRound) as Vote[];
  }

  /**
   * Get aggregated results for a survey in the current round.
   */
  getResults(surveyId: string): VoteResult[] {
    surveyService.getSurveyById(surveyId); // throws if not found

    const database = getDatabase();
    const currentRound = stateMachineService.getCurrentVotingRound(surveyId);

    return database
      .prepare(
        `SELECT
           v.option_id,
           o.title as option_title,
           SUM(v.value) as total_value,
           COUNT(v.id) as vote_count,
           ROUND(AVG(v.value * 1.0), 2) as average_value
         FROM votes v
         INNER JOIN options o ON o.id = v.option_id
         WHERE v.survey_id = ? AND v.voting_round = ?
         GROUP BY v.option_id, o.title
         ORDER BY average_value ASC`
      )
      .all(surveyId, currentRound) as VoteResult[];
  }

  /**
   * Get results enriched with objections and author names per option.
   */
  getResultsWithObjections(surveyId: string): VoteResultWithObjections[] {
    const results = this.getResults(surveyId);
    const database = getDatabase();

    // Get all objections for this survey with author names
    const rawObjections = database
      .prepare(
        `SELECT
           obj.id,
           obj.option_id,
           obj.text,
           obj.status,
           obj.host_response,
           obj.created_at,
           COALESCE(u.display_name, u.username, sp.anonymous_name, 'Anonym') as author_name
         FROM objections obj
         INNER JOIN survey_participants sp ON sp.id = obj.participant_id
         LEFT JOIN users u ON u.id = sp.user_id
         WHERE obj.survey_id = ?
         ORDER BY obj.created_at ASC`
      )
      .all(surveyId) as (ObjectionWithAuthor & { option_id: string })[];

    // Group objections by option_id
    const objectionsByOption = new Map<string, ObjectionWithAuthor[]>();
    for (const obj of rawObjections) {
      const list = objectionsByOption.get(obj.option_id) ?? [];
      list.push({
        id: obj.id,
        text: obj.text,
        status: obj.status,
        host_response: obj.host_response,
        author_name: obj.author_name,
        created_at: obj.created_at,
      });
      objectionsByOption.set(obj.option_id, list);
    }

    return results.map((r) => ({
      ...r,
      objections: objectionsByOption.get(r.option_id) ?? [],
    }));
  }

  /**
   * Get per-participant results (who voted what) for the current round.
   * Only available for surveys with non-anonymous voting.
   */
  getResultsByParticipant(surveyId: string): ParticipantResult[] {
    const survey = surveyService.getSurveyById(surveyId);

    if (survey.anonymous_voting) {
      throw new ForbiddenError(
        'Diese Umfrage ist anonym – Ergebnisse sind nur aggregiert verfügbar'
      );
    }

    const database = getDatabase();
    const currentRound = stateMachineService.getCurrentVotingRound(surveyId);

    const rows = database
      .prepare(
        `SELECT
           sp.id as participant_id,
           COALESCE(u.display_name, u.username, sp.anonymous_name, 'Anonym') as participant_name,
           v.option_id,
           o.title as option_title,
           v.value
         FROM votes v
         INNER JOIN survey_participants sp ON sp.id = v.participant_id
         INNER JOIN options o ON o.id = v.option_id
         LEFT JOIN users u ON u.id = sp.user_id
         WHERE v.survey_id = ? AND v.voting_round = ?
         ORDER BY participant_name ASC, o.position ASC`
      )
      .all(surveyId, currentRound) as Array<
      ParticipantVote & { participant_id: string; participant_name: string }
    >;

    const byParticipant = new Map<string, ParticipantResult>();
    for (const row of rows) {
      let entry = byParticipant.get(row.participant_id);
      if (!entry) {
        entry = {
          participant_id: row.participant_id,
          participant_name: row.participant_name,
          votes: [],
        };
        byParticipant.set(row.participant_id, entry);
      }
      entry.votes.push({
        option_id: row.option_id,
        option_title: row.option_title,
        value: row.value,
      });
    }

    return Array.from(byParticipant.values());
  }

  /**
   * Check if a participant has already voted in the current round.
   */
  hasVoted(surveyId: string, participantId: string): boolean {
    const database = getDatabase();
    const currentRound = stateMachineService.getCurrentVotingRound(surveyId);

    const result = database
      .prepare(
        `SELECT COUNT(*) as count FROM votes
         WHERE survey_id = ? AND participant_id = ? AND voting_round = ?`
      )
      .get(surveyId, participantId, currentRound) as { count: number };

    return result.count > 0;
  }

  /**
   * Validate votes based on the survey's voting method.
   */
  private validateVotes(survey: Survey, votes: VoteInput[]): void {
    const database = getDatabase();

    // Verify all option IDs belong to this survey
    const surveyOptions = database
      .prepare('SELECT id FROM options WHERE survey_id = ?')
      .all(survey.id) as { id: string }[];

    const validOptionIds = new Set(surveyOptions.map((o) => o.id));

    for (const vote of votes) {
      if (!validOptionIds.has(vote.optionId)) {
        throw new ValidationError(`Option "${vote.optionId}" gehört nicht zu dieser Umfrage`);
      }
    }

    // Check for duplicate option IDs in the submission
    const submittedOptionIds = new Set(votes.map((v) => v.optionId));
    if (submittedOptionIds.size !== votes.length) {
      throw new ValidationError('Doppelte Optionen in der Abstimmung');
    }

    // Method-specific validation
    switch (survey.voting_method) {
      case 'widerstand_punkte':
        this.validateWiderstandPunkte(survey, votes);
        break;
      case 'widerstand':
        this.validateWiderstand(votes);
        break;
      case 'mehrheit':
        this.validateMehrheit(votes);
        break;
    }
  }

  /**
   * Widerstandsabfrage mit Punkteregel:
   * - Values 0-10
   * - Each value <= max_points_per_option
   * - Sum of all values <= w_max (if set)
   */
  private validateWiderstandPunkte(survey: Survey, votes: VoteInput[]): void {
    const maxPerOption = survey.max_points_per_option ?? 10;

    for (const vote of votes) {
      if (vote.value < 0 || vote.value > 10) {
        throw new ValidationError('Widerstandswerte müssen zwischen 0 und 10 liegen');
      }
      if (vote.value > maxPerOption) {
        throw new ValidationError(
          `Maximal ${maxPerOption} Punkte pro Option erlaubt`
        );
      }
    }

    if (survey.w_max !== null) {
      const totalPoints = votes.reduce((sum, v) => sum + v.value, 0);
      if (totalPoints > survey.w_max) {
        throw new ValidationError(
          `Punktebudget überschritten: ${totalPoints}/${survey.w_max} (W-Max)`
        );
      }
    }
  }

  /**
   * Widerstandsabfrage (ohne Punkteregel):
   * - Values 0-10
   * - No per-option or total limits
   */
  private validateWiderstand(votes: VoteInput[]): void {
    for (const vote of votes) {
      if (vote.value < 0 || vote.value > 10) {
        throw new ValidationError('Widerstandswerte müssen zwischen 0 und 10 liegen');
      }
    }
  }

  /**
   * Mehrheitsentscheid:
   * - Values must be 0 or 1
   */
  private validateMehrheit(votes: VoteInput[]): void {
    for (const vote of votes) {
      if (vote.value !== 0 && vote.value !== 1) {
        throw new ValidationError('Bei Mehrheitsentscheid sind nur Zustimmung (1) oder Ablehnung (0) erlaubt');
      }
    }
  }
}

export const voteService = new VoteService();
