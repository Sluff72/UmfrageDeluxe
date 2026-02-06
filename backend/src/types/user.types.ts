export interface User {
  id: string;
  username: string;
  password_hash: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPublic {
  id: string;
  username: string;
  display_name: string | null;
  created_at: string;
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
