export type SurveyStatus =
  | 'entwurf'
  | 'optionen_sammeln'
  | 'abstimmen'
  | 'einwand_integration'
  | 'beendet';

export type VotingMethod =
  | 'widerstand_punkte'
  | 'widerstand'
  | 'mehrheit'
  | 'freitext';

export interface Survey {
  id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  voting_method: VotingMethod;
  w_max: number | null;
  max_points_per_option: number | null;
  show_answer_authors: number; // SQLite boolean — only meaningful for 'freitext'
  invite_code: string;
  allow_anonymous: number; // SQLite boolean
  is_archived: number;     // SQLite boolean
  auto_transition_rules: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SurveyWithParticipantCount extends Survey {
  participant_count: number;
}

export interface CreateSurveyInput {
  title: string;
  description?: string;
  votingMethod: VotingMethod;
  wMax?: number;
  maxPointsPerOption?: number;
  allowAnonymous?: boolean;
  showAnswerAuthors?: boolean;
}

export interface UpdateSurveyInput {
  title?: string;
  description?: string;
  votingMethod?: VotingMethod;
  wMax?: number;
  maxPointsPerOption?: number;
  allowAnonymous?: boolean;
  showAnswerAuthors?: boolean;
}
