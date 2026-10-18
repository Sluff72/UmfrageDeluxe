import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { LoginLockoutService, MAX_FAILED_LOGIN_ATTEMPTS } from './loginLockout.service';
import { UserAdministrationService } from './userAdministration.service';
import { getDatabase } from '../config/database';
import { AccountLockedError, NotFoundError } from '../utils/errors';

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
});
