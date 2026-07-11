import type Database from 'better-sqlite3';

/**
 * Adds a `current_voting_round` column to the `surveys` table. The active
 * round was previously derived from MAX(voting_round) in `votes`, which
 * never increments on a re-vote: new submissions kept landing in (and
 * overwriting) the old round. Storing the round on the survey lets the
 * state machine increment it when a re-vote starts, so previous rounds
 * stay intact as history.
 *
 * Existing surveys are backfilled from their votes so the column matches
 * the previously derived value.
 *
 * Idempotent: safe to run on a fresh DB or on one that already has the
 * column applied.
 */
export function runCurrentVotingRoundMigration(db: Database.Database): void {
  const columns = db.prepare(`PRAGMA table_info(surveys)`).all() as Array<{ name: string }>;
  const hasColumn = columns.some((col) => col.name === 'current_voting_round');
  if (hasColumn) return;

  db.exec(`ALTER TABLE surveys ADD COLUMN current_voting_round INTEGER NOT NULL DEFAULT 1;`);

  db.exec(`
    UPDATE surveys
    SET current_voting_round = COALESCE(
      (SELECT MAX(voting_round) FROM votes WHERE votes.survey_id = surveys.id),
      1
    );
  `);
}
