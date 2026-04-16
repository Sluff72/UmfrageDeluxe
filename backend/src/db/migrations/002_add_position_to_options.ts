import type Database from 'better-sqlite3';

/**
 * Adds a `position` column to the `options` table so options can be
 * explicitly ordered (moved up/down by host/co-host). Existing options
 * are backfilled with positions based on their `created_at` order, per
 * survey, to preserve the current display order.
 *
 * Idempotent: safe to run on a fresh DB or on one that already has the
 * column applied.
 */
export function runPositionMigration(db: Database.Database): void {
  const columns = db.prepare(`PRAGMA table_info(options)`).all() as Array<{ name: string }>;
  const hasPosition = columns.some((col) => col.name === 'position');
  if (hasPosition) return;

  db.exec(`ALTER TABLE options ADD COLUMN position INTEGER NOT NULL DEFAULT 0;`);

  // Backfill: order existing options within each survey by created_at, then id
  const surveys = db
    .prepare('SELECT DISTINCT survey_id FROM options')
    .all() as Array<{ survey_id: string }>;

  const updateStmt = db.prepare('UPDATE options SET position = ? WHERE id = ?');

  const backfill = db.transaction(() => {
    for (const { survey_id } of surveys) {
      const options = db
        .prepare(
          'SELECT id FROM options WHERE survey_id = ? ORDER BY created_at ASC, id ASC'
        )
        .all(survey_id) as Array<{ id: string }>;
      options.forEach((option, index) => {
        updateStmt.run(index, option.id);
      });
    }
  });

  backfill();

  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_options_survey_position ON options(survey_id, position);`
  );
}
