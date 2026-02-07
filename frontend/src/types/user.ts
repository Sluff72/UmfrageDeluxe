export interface UserPublic {
  id: string;
  username: string;
  display_name: string | null;
  created_at: string;
}

export interface AuthResponse {
  user: UserPublic;
}

export interface RegisterInput {
  username: string;
  password: string;
  displayName?: string;
}

export interface LoginInput {
  username: string;
  password: string;
}
