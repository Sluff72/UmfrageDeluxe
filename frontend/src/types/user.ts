export interface UserPublic {
  id: string;
  username: string;
  display_name: string | null;
  created_at: string;
  is_admin: boolean;
}

/** User as listed in the admin user administration. */
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

export interface ChangePasswordInput {
  username: string;
  currentPassword: string;
  newPassword: string;
}
