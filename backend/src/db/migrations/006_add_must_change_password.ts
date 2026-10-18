import type Database from 'better-sqlite3';

/**
 * Adds `must_change_password` to the `users` table. It is set when an
 * admin resets a password to a temporary one; the user then has to choose
 * a new password before the next login succeeds.
 *
 * Idempotent: safe to run on a fresh DB or on one that already has the
 * column applied.
 */
export function runMustChangePasswordMigration(db: Database.Database): void {
  const columns = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>;
  const hasColumn = columns.some((col) => col.name === 'must_change_password');
  if (hasColumn) return;

  db.exec(`ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;`);
}
