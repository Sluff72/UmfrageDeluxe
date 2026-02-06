export interface Vote {
  id: string;
  survey_id: string;
  option_id: string;
  participant_id: string;
  value: number;
  voting_round: number;
  created_at: string;
}

export interface VoteInput {
  optionId: string;
  value: number;
}

export interface BatchVoteInput {
  votes: VoteInput[];
}

export interface VoteResult {
  option_id: string;
  option_title: string;
  total_value: number;
  vote_count: number;
  average_value: number;
}
