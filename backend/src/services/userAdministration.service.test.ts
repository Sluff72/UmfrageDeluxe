import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { LoginLockoutService, MAX_FAILED_LOGIN_ATTEMPTS } from './loginLockout.service';
import { UserAdministrationService } from './userAdministration.service';
import { getDatabase } from '../config/database';
import {
  AccountLockedError,
  NotFoundError,
  PasswordChangeRequiredError,
  UnauthorizedError,
} from '../utils/errors';
import { changePasswordSchema } from '../validators/auth.schema';

describe('UserAdministrationService', () => {
  const adminUsername = 'admin';
  const password = 'correctpassword123';
  let loginLockout: LoginLockoutService;
  let userAdministration: UserAdministrationService;
  let authService: AuthService;

  beforeEach(() => {
    getDatabase().exec('DELETE FROM users');
    loginLockout = new LoginLockoutService();
    userAdministration = new UserAdministrationService([adminUsername], loginLockout);
    authService = new AuthService(loginLockout, userAdministration);
  });

  async function lockAccount(username: string) {
    for (let attempt = 0; attempt < MAX_FAILED_LOGIN_ATTEMPTS; attempt++) {
      await authService.loginUser({ username, password: 'wrongpassword' }).catch(() => {});
    }
  }

  describe('isAdmin', () => {
    it('should recognize configured admin usernames only', () => {
      expect(userAdministration.isAdmin(adminUsername)).toBe(true);
      expect(userAdministration.isAdmin('someone')).toBe(false);
    });

    it('should mark admins in the public user data', async () => {
      const admin = await authService.registerUser({ username: adminUsername, password });
      const regular = await authService.registerUser({ username: 'regular', password });

      expect(admin.is_admin).toBe(true);
      expect(regular.is_admin).toBe(false);
    });
  });

  describe('listUsers', () => {
    it('should list all registered users without password hashes', async () => {
      await authService.registerUser({ username: 'alice', password });
      await authService.registerUser({ username: adminUsername, password });

      const users = userAdministration.listUsers();

      expect(users.map((user) => user.username).sort()).toEqual(['admin', 'alice']);
      expect(users.find((user) => user.username === adminUsername)!.is_admin).toBe(true);
      expect((users[0] as any).password_hash).toBeUndefined();
    });

    it('should report locked accounts', async () => {
      await authService.registerUser({ username: 'alice', password });
      await authService.registerUser({ username: 'bob', password });
      await lockAccount('alice');

      const users = userAdministration.listUsers();
      const alice = users.find((user) => user.username === 'alice')!;
      const bob = users.find((user) => user.username === 'bob')!;

      expect(alice.is_locked).toBe(true);
      expect(alice.failed_login_attempts).toBe(MAX_FAILED_LOGIN_ATTEMPTS);
      expect(alice.locked_until).not.toBeNull();
      expect(bob.is_locked).toBe(false);
    });

    it('should record the last successful login', async () => {
      await authService.registerUser({ username: 'alice', password });
      expect(userAdministration.listUsers()[0].last_login_at).toBeNull();

      await authService.loginUser({ username: 'alice', password });

      expect(userAdministration.listUsers()[0].last_login_at).not.toBeNull();
    });
  });

  describe('unlockUser', () => {
    it('should lift the lock so the user can log in again', async () => {
      const alice = await authService.registerUser({ username: 'alice', password });
      await lockAccount('alice');
      await expect(authService.loginUser({ username: 'alice', password })).rejects.toThrow(
        AccountLockedError
      );

      const unlocked = userAdministration.unlockUser(alice.id);

      expect(unlocked.is_locked).toBe(false);
      expect(unlocked.failed_login_attempts).toBe(0);
      const result = await authService.loginUser({ username: 'alice', password });
      expect(result.user.username).toBe('alice');
    });

    it('should throw NotFoundError for an unknown user', () => {
      expect(() => userAdministration.unlockUser('nonexistent-id')).toThrow(NotFoundError);
    });
  });

  describe('resetPassword', () => {
    const newPassword = 'my-new-password-42';

    it('should return a temporary password and invalidate the old one', async () => {
      const alice = await authService.registerUser({ username: 'alice', password });

      const { temporaryPassword, user } = await userAdministration.resetPassword(alice.id);

      expect(temporaryPassword).toMatch(/^[A-Za-z0-9]{12}$/);
      expect(user.must_change_password).toBe(true);
      await expect(authService.loginUser({ username: 'alice', password })).rejects.toThrow(
        UnauthorizedError
      );
    });

    it('should require a new password before login succeeds', async () => {
      const alice = await authService.registerUser({ username: 'alice', password });
      const { temporaryPassword } = await userAdministration.resetPassword(alice.id);

      await expect(
        authService.loginUser({ username: 'alice', password: temporaryPassword })
      ).rejects.toThrow(PasswordChangeRequiredError);

      const changed = await authService.changePassword({
        username: 'alice',
        currentPassword: temporaryPassword,
        newPassword,
      });
      expect(changed.token).toBeDefined();

      const result = await authService.loginUser({ username: 'alice', password: newPassword });
      expect(result.user.username).toBe('alice');
      await expect(
        authService.loginUser({ username: 'alice', password: temporaryPassword })
      ).rejects.toThrow(UnauthorizedError);
      expect(userAdministration.listUsers()[0].must_change_password).toBe(false);
    });

    it('should lift an existing login lock', async () => {
      const alice = await authService.registerUser({ username: 'alice', password });
      await lockAccount('alice');

      const { user } = await userAdministration.resetPassword(alice.id);

      expect(user.is_locked).toBe(false);
    });

    it('should reject a password change with a wrong current password', async () => {
      const alice = await authService.registerUser({ username: 'alice', password });
      await userAdministration.resetPassword(alice.id);

      await expect(
        authService.changePassword({
          username: 'alice',
          currentPassword: 'not-the-temporary-one',
          newPassword,
        })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw NotFoundError for an unknown user', async () => {
      await expect(userAdministration.resetPassword('nonexistent-id')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('changePasswordSchema', () => {
    it('should reject a new password equal to the current one', () => {
      const result = changePasswordSchema.safeParse({
        username: 'alice',
        currentPassword: 'same-password-1',
        newPassword: 'same-password-1',
      });
      expect(result.success).toBe(false);
    });
  });
});
