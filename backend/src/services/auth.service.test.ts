import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { getDatabase } from '../config/database';
import { ConflictError, UnauthorizedError } from '../utils/errors';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    // Clear users table before each test
    const db = getDatabase();
    db.exec('DELETE FROM users');
  });

  describe('registerUser', () => {
    it('should register a new user and return public user data', async () => {
      const result = await authService.registerUser({
        username: 'testuser',
        password: 'securepassword123',
        displayName: 'Test User',
      });

      expect(result.id).toBeDefined();
      expect(result.username).toBe('testuser');
      expect(result.display_name).toBe('Test User');
      expect(result.created_at).toBeDefined();
      // Password hash should not be exposed
      expect((result as any).password_hash).toBeUndefined();
    });

    it('should register a user without display name', async () => {
      const result = await authService.registerUser({
        username: 'testuser',
        password: 'securepassword123',
      });

      expect(result.username).toBe('testuser');
      expect(result.display_name).toBeNull();
    });

    it('should throw ConflictError when username is taken', async () => {
      await authService.registerUser({
        username: 'existinguser',
        password: 'password123456',
      });

      await expect(
        authService.registerUser({
          username: 'existinguser',
          password: 'differentpassword',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('should hash the password with argon2id', async () => {
      await authService.registerUser({
        username: 'testuser',
        password: 'securepassword123',
      });

      const db = getDatabase();
      const user = db
        .prepare('SELECT password_hash FROM users WHERE username = ?')
        .get('testuser') as { password_hash: string };

      expect(user.password_hash).toContain('$argon2id$');
      expect(user.password_hash).not.toBe('securepassword123');
    });
  });

  describe('loginUser', () => {
    beforeEach(async () => {
      await authService.registerUser({
        username: 'logintest',
        password: 'mypassword123',
        displayName: 'Login Test',
      });
    });

    it('should return user and token on valid credentials', async () => {
      const result = await authService.loginUser({
        username: 'logintest',
        password: 'mypassword123',
      });

      expect(result.user.username).toBe('logintest');
      expect(result.user.display_name).toBe('Login Test');
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
    });

    it('should throw UnauthorizedError on wrong password', async () => {
      await expect(
        authService.loginUser({
          username: 'logintest',
          password: 'wrongpassword',
        })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError on non-existent username', async () => {
      await expect(
        authService.loginUser({
          username: 'nonexistent',
          password: 'mypassword123',
        })
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('token verification', () => {
    it('should generate and verify a valid token', async () => {
      await authService.registerUser({
        username: 'tokenuser',
        password: 'tokenpassword123',
      });

      const { token } = await authService.loginUser({
        username: 'tokenuser',
        password: 'tokenpassword123',
      });

      const payload = authService.verifyToken(token);

      expect(payload.username).toBe('tokenuser');
      expect(payload.sub).toBeDefined();
      expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
    });

    it('should throw UnauthorizedError on invalid token', () => {
      expect(() => authService.verifyToken('invalid-token')).toThrow(
        UnauthorizedError
      );
    });
  });

  describe('getUserById', () => {
    it('should return the user by ID', async () => {
      const registered = await authService.registerUser({
        username: 'findme',
        password: 'password123456',
      });

      const found = authService.getUserById(registered.id);

      expect(found).toBeDefined();
      expect(found!.username).toBe('findme');
    });

    it('should return undefined for non-existent ID', () => {
      const found = authService.getUserById('nonexistent-id');
      expect(found).toBeUndefined();
    });
  });
});
