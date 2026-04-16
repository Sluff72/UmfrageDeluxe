/**
 * Socket.IO event names – mirrored from backend/src/socket/events.ts.
 * Keep in sync with the backend.
 */
export const SOCKET_EVENTS = {
  // Client → Server
  SURVEY_JOIN: "survey:join",
  SURVEY_LEAVE: "survey:leave",

  // Server → Client
  SURVEY_PHASE_CHANGED: "survey:phase-changed",
  SURVEY_UPDATED: "survey:updated",
  SURVEY_PARTICIPANT_JOINED: "survey:participant-joined",
  SURVEY_PARTICIPANT_LEFT: "survey:participant-left",

  OPTION_ADDED: "option:added",
  OPTION_UPDATED: "option:updated",
  OPTION_REMOVED: "option:removed",
  OPTION_REORDERED: "option:reordered",

  VOTE_RECEIVED: "vote:received",
  VOTE_RESULTS_UPDATED: "vote:results-updated",

  OBJECTION_ADDED: "objection:added",
  OBJECTION_STATUS_CHANGED: "objection:status-changed",

  PARTICIPANT_ROLE_CHANGED: "survey:participant-role-changed",
} as const;

/* ── Payload types for Server → Client events ─────────────────── */

import type { Survey, SurveyStatus, SurveyRole, SurveyOption } from "./survey";

export interface PhaseChangedPayload {
  surveyId: string;
  previousStatus: SurveyStatus;
  newStatus: SurveyStatus;
}

export interface SurveyUpdatedPayload {
  survey: Survey;
}

export interface ParticipantJoinedPayload {
  surveyId: string;
  participantId: string;
}

export interface OptionAddedPayload {
  surveyId: string;
  option: SurveyOption;
}

export interface OptionUpdatedPayload {
  surveyId: string;
  option: SurveyOption;
}

export interface OptionRemovedPayload {
  surveyId: string;
  optionId: string;
}

export interface OptionReorderedPayload {
  surveyId: string;
  options: SurveyOption[];
}

export interface VoteReceivedPayload {
  surveyId: string;
  participantId: string;
}

export interface ObjectionAddedPayload {
  surveyId: string;
  objectionId: string;
}

export interface ObjectionStatusChangedPayload {
  surveyId: string;
  objectionId: string;
  status: string;
}

export interface ParticipantRoleChangedPayload {
  surveyId: string;
  participantId: string;
  newRole: SurveyRole;
}
