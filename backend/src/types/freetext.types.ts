export interface FreetextQuestion {
  id: string;
  option_id: string;
  text: string;
  position: number;
  created_at: string;
}

export interface FreetextQuestionWithOption extends FreetextQuestion {
  option_title: string;
}

export interface FreetextAnswer {
  id: string;
  survey_id: string;
  question_id: string;
  participant_id: string;
  text: string;
  voting_round: number;
  created_at: string;
}

export interface FreetextAnswerInput {
  questionId: string;
  text: string;
}

export interface FreetextAnswerEntry {
  id: string;
  text: string;
  author_name: string | null; // null when show_answer_authors=0
  created_at: string;
}

export interface FreetextQuestionResults {
  question_id: string;
  question_text: string;
  question_position: number;
  answers: FreetextAnswerEntry[];
}

export interface FreetextOptionResults {
  option_id: string;
  option_title: string;
  option_description: string | null;
  questions: FreetextQuestionResults[];
}
