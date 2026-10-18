import { getDatabase } from '../config/database';

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Per-account login lockout. Locks a single account after too many
 * consecutive failed logins – other accounts are not affected.
 *
 * Timestamps use SQLite's `datetime('now')` format (UTC) so all
 * comparisons can happen in SQL.
 */
export class LoginLockoutService {
  isAccountLocked(userId: string): boolean {
    const lockedRow = getDatabase()
      .prepare(
        `SELECT 1 FROM users
         WHERE id = ? AND locked_until IS NOT NULL AND locked_until > datetime('now')`
      )
      .get(userId);

    return lockedRow !== undefined;
  }

  /** Gives the user a fresh start once a previous lock has run out. */
  clearExpiredLock(userId: string): void {
    getDatabase()
      .prepare(
        `UPDATE users
         SET failed_login_attempts = 0, locked_until = NULL
         WHERE id = ? AND locked_until IS NOT NULL AND locked_until <= datetime('now')`
      )
      .run(userId);
  }

  /** Counts a failed login and returns whether the account is now locked. */
  recordFailedLoginAttempt(userId: string): boolean {
    getDatabase()
      .prepare(
        `UPDATE users
         SET failed_login_attempts = failed_login_attempts + 1,
             locked_until = CASE
               WHEN failed_login_attempts + 1 >= ? THEN datetime('now', ?)
               ELSE locked_until
             END
         WHERE id = ?`
      )
      .run(MAX_FAILED_LOGIN_ATTEMPTS, `+${LOCKOUT_DURATION_MINUTES} minutes`, userId);

    return this.isAccountLocked(userId);
  }

  recordSuccessfulLogin(userId: string): void {
    getDatabase()
      .prepare(
        `UPDATE users
         SET failed_login_attempts = 0, locked_until = NULL, last_login_at = datetime('now')
         WHERE id = ?`
      )
      .run(userId);
  }

  unlockAccount(userId: string): void {
    getDatabase()
      .prepare(
        `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?`
      )
      .run(userId);
  }
}

export const loginLockoutService = new LoginLockoutService();
