import type Database from 'better-sqlite3';

/**
 * Adds per-account login lockout columns to the `users` table.
 *
 * - `failed_login_attempts`: consecutive failed logins since the last success
 * - `locked_until`: UTC timestamp (SQLite `datetime` format) until which the
 *   account is locked; NULL when not locked
 * - `last_login_at`: UTC timestamp of the last successful login
 *
 * Idempotent: each column is only added if it does not exist yet.
 */
export function runLoginLockoutMigration(db: Database.Database): void {
  const columns = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>;
  const existingColumnNames = new Set(columns.map((col) => col.name));

  if (!existingColumnNames.has('failed_login_attempts')) {
    db.exec(`ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0;`);
  }
  if (!existingColumnNames.has('locked_until')) {
    db.exec(`ALTER TABLE users ADD COLUMN locked_until TEXT;`);
  }
  if (!existingColumnNames.has('last_login_at')) {
    db.exec(`ALTER TABLE users ADD COLUMN last_login_at TEXT;`);
  }
}
