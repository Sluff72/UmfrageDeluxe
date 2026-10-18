import rateLimit from 'express-rate-limit';

/**
 * IP-based limits are only a coarse safety net: in workshops many
 * participants share one IP (same Wi-Fi / NAT), so these limits are
 * generous. Brute-force protection for a single account is handled
 * per user by LoginLockoutService.
 */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGINS_PER_IP = 50;

const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const MAX_REGISTRATIONS_PER_IP = 50;

const GENERAL_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_IP = 1000;

export const authLoginLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  max: MAX_FAILED_LOGINS_PER_IP,
  // Only failed logins count – successful logins of other users on the
  // same network must never lock anyone out.
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRegisterLimiter = rateLimit({
  windowMs: REGISTER_WINDOW_MS,
  max: MAX_REGISTRATIONS_PER_IP,
  message: { error: 'Too many registration attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalLimiter = rateLimit({
  windowMs: GENERAL_WINDOW_MS,
  max: MAX_REQUESTS_PER_IP,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
