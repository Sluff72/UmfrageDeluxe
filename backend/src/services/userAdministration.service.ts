import { getDatabase } from '../config/database';
import { env } from '../config/env';
import { NotFoundError } from '../utils/errors';
import { generateTemporaryPassword, hashPassword } from '../utils/password';
import { LoginLockoutService, loginLockoutService } from './loginLockout.service';
import type { UserAdministrationEntry } from '../types/user.types';

type UserAdministrationRow = Omit<
  UserAdministrationEntry,
  'is_locked' | 'is_admin' | 'must_change_password'
> & {
  is_locked: number;
  must_change_password: number;
};

const USER_ADMINISTRATION_COLUMNS = `
  id, username, display_name, created_at, last_login_at,
  failed_login_attempts, locked_until, must_change_password,
  (locked_until IS NOT NULL AND locked_until > datetime('now')) AS is_locked
`;

/**
 * User administration for system admins: list registered accounts and
 * lift login lockouts. Admins are configured via ADMIN_USERNAMES.
 */
export class UserAdministrationService {
  private readonly adminUsernames: ReadonlySet<string>;

  constructor(
    adminUsernames: readonly string[],
    private readonly loginLockout: LoginLockoutService
  ) {
    this.adminUsernames = new Set(adminUsernames);
  }

  isAdmin(username: string): boolean {
    return this.adminUsernames.has(username);
  }

  listUsers(): UserAdministrationEntry[] {
    const rows = getDatabase()
      .prepare(
        `SELECT ${USER_ADMINISTRATION_COLUMNS} FROM users
         ORDER BY created_at DESC, username ASC`
      )
      .all() as UserAdministrationRow[];

    return rows.map((row) => this.toEntry(row));
  }

  unlockUser(userId: string): UserAdministrationEntry {
    this.findUserOrThrow(userId);
    this.loginLockout.unlockAccount(userId);
    return this.findUserOrThrow(userId);
  }

  /**
   * Replaces the user's password with a random temporary one and returns it
   * in plain text – this is the only moment it is visible. The user must set
   * a new password at the next login. Also lifts any login lock.
   */
  async resetPassword(
    userId: string
  ): Promise<{ user: UserAdministrationEntry; temporaryPassword: string }> {
    this.findUserOrThrow(userId);

    const temporaryPassword = generateTemporaryPassword();
    const temporaryPasswordHash = await hashPassword(temporaryPassword);

    getDatabase()
      .prepare(
        `UPDATE users
         SET password_hash = ?, must_change_password = 1, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(temporaryPasswordHash, userId);
    this.loginLockout.unlockAccount(userId);

    return { user: this.findUserOrThrow(userId), temporaryPassword };
  }

  private findUserOrThrow(userId: string): UserAdministrationEntry {
    const row = getDatabase()
      .prepare(`SELECT ${USER_ADMINISTRATION_COLUMNS} FROM users WHERE id = ?`)
      .get(userId) as UserAdministrationRow | undefined;

    if (!row) {
      throw new NotFoundError('User');
    }

    return this.toEntry(row);
  }

  private toEntry(row: UserAdministrationRow): UserAdministrationEntry {
    return {
      ...row,
      is_locked: row.is_locked === 1,
      must_change_password: row.must_change_password === 1,
      is_admin: this.isAdmin(row.username),
    };
  }
}

export const userAdministrationService = new UserAdministrationService(
  env.ADMIN_USERNAMES,
  loginLockoutService
);
