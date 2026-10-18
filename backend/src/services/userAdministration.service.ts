import { getDatabase } from '../config/database';
import { env } from '../config/env';
import { NotFoundError } from '../utils/errors';
import { LoginLockoutService, loginLockoutService } from './loginLockout.service';
import type { UserAdministrationEntry } from '../types/user.types';

type UserAdministrationRow = Omit<UserAdministrationEntry, 'is_locked' | 'is_admin'> & {
  is_locked: number;
};

const USER_ADMINISTRATION_COLUMNS = `
  id, username, display_name, created_at, last_login_at,
  failed_login_attempts, locked_until,
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
      is_admin: this.isAdmin(row.username),
    };
  }
}

export const userAdministrationService = new UserAdministrationService(
  env.ADMIN_USERNAMES,
  loginLockoutService
);
