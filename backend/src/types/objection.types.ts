export type ObjectionStatus = 'pending' | 'integrated' | 'dismissed';

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

export interface CreateObjectionInput {
  text: string;
  optionId: string;
}

export interface ReviewObjectionInput {
  status: 'integrated' | 'dismissed';
  hostResponse?: string;
}
