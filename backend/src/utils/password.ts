import argon2 from 'argon2';
import { randomInt } from 'crypto';

/** Unambiguous characters only (no 0/O, 1/l/I) – easy to read aloud or copy. */
const TEMPORARY_PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TEMPORARY_PASSWORD_LENGTH = 12;

export function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword, { type: argon2.argon2id });
}

export function verifyPassword(passwordHash: string, plainPassword: string): Promise<boolean> {
  return argon2.verify(passwordHash, plainPassword);
}

export function generateTemporaryPassword(): string {
  let temporaryPassword = '';
  for (let index = 0; index < TEMPORARY_PASSWORD_LENGTH; index++) {
    temporaryPassword += TEMPORARY_PASSWORD_ALPHABET[randomInt(TEMPORARY_PASSWORD_ALPHABET.length)];
  }
  return temporaryPassword;
}
