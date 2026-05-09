export type SurveyStatus =
  | "entwurf"
  | "optionen_sammeln"
  | "abstimmen"
  | "einwand_integration"
  | "beendet";

export type VotingMethod =
  | "widerstand_punkte"
  | "widerstand"
  | "mehrheit"
  | "freitext";

export type SurveyRole = "host" | "co_host" | "teilnehmer";

export interface Survey {
  id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  voting_method: VotingMethod;
  w_max: number | null;
  max_points_per_option: number | null;
  show_answer_authors: number;
  invite_code: string;
  allow_anonymous: number;
  is_archived: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SurveyWithParticipantCount extends Survey {
  participant_count: number;
}

export interface SurveyParticipant {
  id: string;
  survey_id: string;
  user_id: string | null;
  anonymous_name: string | null;
  display_name: string;
  role: SurveyRole;
  joined_at: string;
}

export interface CreateSurveyInput {
  title: string;
  description?: string;
  votingMethod: VotingMethod;
  wMax?: number;
  maxPointsPerOption?: number;
  allowAnonymous?: boolean;
}

export interface SurveyOption {
  id: string;
  survey_id: string;
  title: string;
  description: string | null;
  created_by: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TransitionOption {
  targetStatus: SurveyStatus;
  allowed: boolean;
  reason?: string;
  warning?: string;
}

export interface TransitionInfo {
  currentStatus: SurveyStatus;
  availableTransitions: TransitionOption[];
  votingRound: number;
}

export type ObjectionStatus = "pending" | "integrated" | "dismissed";

export interface Objection {
  id: string;
  survey_id: string;
  participant_id: string;
  option_id: string;
  text: string;
  status: ObjectionStatus;
  host_response: string | null;
  voting_round: number;
  created_at: string;
}

export const SURVEY_STATUS_LABELS: Record<SurveyStatus, string> = {
  entwurf: "Entwurf",
  optionen_sammeln: "Optionen Sammeln",
  abstimmen: "Abstimmen",
  einwand_integration: "Einwand Integration",
  beendet: "Beendet",
};

export const VOTING_METHOD_LABELS: Record<VotingMethod, string> = {
  widerstand_punkte: "Widerstandsabfrage mit Punkteregel",
  widerstand: "Widerstandsabfrage",
  mehrheit: "Mehrheitsentscheid",
  freitext: "Freitext-Befragung",
};

export const SURVEY_STATUS_COLORS: Record<SurveyStatus, string> = {
  entwurf: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  optionen_sammeln: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  abstimmen: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  einwand_integration: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  beendet: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};
