export interface Option {
  id: string;
  survey_id: string;
  title: string;
  description: string | null;
  created_by: string; // participant_id
  position: number;
  created_at: string;
  updated_at: string;
}

export type MoveDirection = 'up' | 'down';

export interface CreateOptionInput {
  title: string;
  description?: string;
}

export interface UpdateOptionInput {
  title?: string;
  description?: string;
}

export interface ImportOptionInput {
  title: string;
  description?: string;
}
