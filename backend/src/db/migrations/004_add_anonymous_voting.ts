import type Database from 'better-sqlite3';

/**
 * Adds an `anonymous_voting` column to the `surveys` table. It controls
 * whether votes are anonymous (aggregated results only) or attributable,
 * in which case results can also be viewed per participant name.
 *
 * Not to be confused with `allow_anonymous`, which controls whether
 * participants may join without an account.
 *
 * Existing surveys default to 1 (anonymous) – the behavior before this
 * column existed.
 *
 * Idempotent: safe to run on a fresh DB or on one that already has the
 * column applied.
 */
export function runAnonymousVotingMigration(db: Database.Database): void {
  const columns = db.prepare(`PRAGMA table_info(surveys)`).all() as Array<{ name: string }>;
  const hasColumn = columns.some((col) => col.name === 'anonymous_voting');
  if (hasColumn) return;

  db.exec(`ALTER TABLE surveys ADD COLUMN anonymous_voting INTEGER NOT NULL DEFAULT 1;`);
}
