export interface User {
  id: string;
  username: string;
  password_hash: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
  failed_login_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
  must_change_password: number;
}

export interface UserPublic {
  id: string;
  username: string;
  display_name: string | null;
  created_at: string;
  is_admin: boolean;
}

/** User row as shown in the user administration (no password hash). */
export interface UserAdministrationEntry {
  id: string;
  username: string;
  display_name: string | null;
  created_at: string;
  last_login_at: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  is_locked: boolean;
  is_admin: boolean;
  must_change_password: boolean;
}

export interface JwtPayload {
  sub: string;
  username: string;
  iat: number;
  exp: number;
}

export type SurveyRole = 'host' | 'co_host' | 'teilnehmer';

export interface SurveyParticipant {
  id: string;
  survey_id: string;
  user_id: string | null;
  anonymous_name: string | null;
  anonymous_token: string | null;
  role: SurveyRole;
  joined_at: string;
}
