export const SOCKET_EVENTS = {
  // Client -> Server
  SURVEY_JOIN: 'survey:join',
  SURVEY_LEAVE: 'survey:leave',

  // Server -> Client
  SURVEY_PHASE_CHANGED: 'survey:phase-changed',
  SURVEY_UPDATED: 'survey:updated',
  SURVEY_PARTICIPANT_JOINED: 'survey:participant-joined',
  SURVEY_PARTICIPANT_LEFT: 'survey:participant-left',

  OPTION_ADDED: 'option:added',
  OPTION_UPDATED: 'option:updated',
  OPTION_REMOVED: 'option:removed',

  VOTE_RECEIVED: 'vote:received',
  VOTE_RESULTS_UPDATED: 'vote:results-updated',

  OBJECTION_ADDED: 'objection:added',
  OBJECTION_STATUS_CHANGED: 'objection:status-changed',
} as const;

export function buildSurveyRoomName(surveyId: string): string {
  return `survey:${surveyId}`;
}
