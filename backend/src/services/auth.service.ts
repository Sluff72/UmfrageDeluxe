import jwt from 'jsonwebtoken';
import { getDatabase } from '../config/database';
import { env } from '../config/env';
import {
  AccountLockedError,
  ConflictError,
  PasswordChangeRequiredError,
  UnauthorizedError,
} from '../utils/errors';
import { hashPassword, verifyPassword } from '../utils/password';
import { LoginLockoutService, loginLockoutService } from './loginLockout.service';
import {
  UserAdministrationService,
  userAdministrationService,
} from './userAdministration.service';
import type { User, UserPublic, JwtPayload } from '../types/user.types';
import type {
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
} from '../validators/auth.schema';

const JWT_EXPIRATION = '24h';

type UserProfileRow = Omit<UserPublic, 'is_admin'>;

export class AuthService {
  constructor(
    private readonly loginLockout: LoginLockoutService = loginLockoutService,
    private readonly userAdministration: UserAdministrationService = userAdministrationService
  ) {}

  async registerUser(input: RegisterInput): Promise<UserPublic> {
    const database = getDatabase();

    const existingUser = database
      .prepare('SELECT id FROM users WHERE username = ?')
      .get(input.username) as User | undefined;

    if (existingUser) {
      throw new ConflictError('Username is already taken');
    }

    const passwordHash = await hashPassword(input.password);

    const result = database
      .prepare(
        `INSERT INTO users (username, password_hash, display_name)
         VALUES (?, ?, ?)
         RETURNING id, username, display_name, created_at`
      )
      .get(
        input.username,
        passwordHash,
        input.displayName ?? null
      ) as UserProfileRow;

    return this.toUserPublic(result);
  }

  async loginUser(input: LoginInput): Promise<{ user: UserPublic; token: string }> {
    const user = await this.verifyCredentials(input.username, input.password);

    if (user.must_change_password) {
      throw new PasswordChangeRequiredError();
    }

    return this.completeLogin(user);
  }

  /**
   * Sets a new password after verifying the current one. Used when an admin
   * reset the password to a temporary one. Logs the user in on success.
   */
  async changePassword(
    input: ChangePasswordInput
  ): Promise<{ user: UserPublic; token: string }> {
    const user = await this.verifyCredentials(input.username, input.currentPassword);
    const newPasswordHash = await hashPassword(input.newPassword);

    getDatabase()
      .prepare(
        `UPDATE users
         SET password_hash = ?, must_change_password = 0, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(newPasswordHash, user.id);

    return this.completeLogin(user);
  }

  /** Checks username/password and applies the per-account lockout. */
  private async verifyCredentials(username: string, password: string): Promise<User> {
    const user = getDatabase()
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username) as User | undefined;

    if (!user) {
      throw new UnauthorizedError('Invalid username or password');
    }

    this.loginLockout.clearExpiredLock(user.id);
    if (this.loginLockout.isAccountLocked(user.id)) {
      throw new AccountLockedError();
    }

    const isPasswordValid = await verifyPassword(user.password_hash, password);

    if (!isPasswordValid) {
      const isNowLocked = this.loginLockout.recordFailedLoginAttempt(user.id);
      throw isNowLocked
        ? new AccountLockedError()
        : new UnauthorizedError('Invalid username or password');
    }

    return user;
  }

  private completeLogin(user: User): { user: UserPublic; token: string } {
    this.loginLockout.recordSuccessfulLogin(user.id);
    const token = this.generateToken(user);
    return { user: this.toUserPublic(user), token };
  }

  getUserById(userId: string): UserPublic | undefined {
    const database = getDatabase();

    const user = database
      .prepare(
        'SELECT id, username, display_name, created_at FROM users WHERE id = ?'
      )
      .get(userId) as UserProfileRow | undefined;

    return user ? this.toUserPublic(user) : undefined;
  }

  private toUserPublic(user: UserProfileRow): UserPublic {
    return {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      created_at: user.created_at,
      is_admin: this.userAdministration.isAdmin(user.username),
    };
  }

  generateToken(user: Pick<User, 'id' | 'username'>): string {
    const payload = {
      sub: user.id,
      username: user.username,
    };

    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: JWT_EXPIRATION,
    });
  }

  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }
}

export const authService = new AuthService();
