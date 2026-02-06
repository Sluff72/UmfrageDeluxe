import crypto from 'crypto';

const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
// Excluded: 0, O, l, 1, I to avoid visual ambiguity

export function generateInviteCode(): string {
  const bytes = crypto.randomBytes(INVITE_CODE_LENGTH);
  let code = '';

  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_CHARSET[bytes[i] % INVITE_CODE_CHARSET.length];
  }

  return code;
}
