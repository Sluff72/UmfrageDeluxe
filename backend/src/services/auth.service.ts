import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../config/database';
import { env } from '../config/env';
import { AccountLockedError, ConflictError, UnauthorizedError } from '../utils/errors';
import { LoginLockoutService, loginLockoutService } from './loginLockout.service';
import {
  UserAdministrationService,
  userAdministrationService,
} from './userAdministration.service';
import type { User, UserPublic, JwtPayload } from '../types/user.types';
import type { RegisterInput, LoginInput } from '../validators/auth.schema';

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

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });

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
    const database = getDatabase();

    const user = database
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(input.username) as User | undefined;

    if (!user) {
      throw new UnauthorizedError('Invalid username or password');
    }

    this.loginLockout.clearExpiredLock(user.id);
    if (this.loginLockout.isAccountLocked(user.id)) {
      throw new AccountLockedError();
    }

    const isPasswordValid = await argon2.verify(user.password_hash, input.password);

    if (!isPasswordValid) {
      const isNowLocked = this.loginLockout.recordFailedLoginAttempt(user.id);
      throw isNowLocked
        ? new AccountLockedError()
        : new UnauthorizedError('Invalid username or password');
    }

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
