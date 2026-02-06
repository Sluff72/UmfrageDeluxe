"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL } from "@/lib/constants";
import { SOCKET_EVENTS } from "@/types/socket";
import type {
  PhaseChangedPayload,
  OptionAddedPayload,
  OptionUpdatedPayload,
  OptionRemovedPayload,
  VoteReceivedPayload,
  ObjectionAddedPayload,
  ObjectionStatusChangedPayload,
  ParticipantJoinedPayload,
  ParticipantRoleChangedPayload,
} from "@/types/socket";

export interface SurveySocketCallbacks {
  onPhaseChanged?: (payload: PhaseChangedPayload) => void;
  onOptionAdded?: (payload: OptionAddedPayload) => void;
  onOptionUpdated?: (payload: OptionUpdatedPayload) => void;
  onOptionRemoved?: (payload: OptionRemovedPayload) => void;
  onVoteReceived?: (payload: VoteReceivedPayload) => void;
  onObjectionAdded?: (payload: ObjectionAddedPayload) => void;
  onObjectionStatusChanged?: (payload: ObjectionStatusChangedPayload) => void;
  onParticipantJoined?: (payload: ParticipantJoinedPayload) => void;
  onParticipantRoleChanged?: (payload: ParticipantRoleChangedPayload) => void;
}

/**
 * Connects to the Socket.IO server, joins the survey room, and
 * subscribes to all relevant events. Automatically disconnects
 * on unmount or when surveyId changes.
 *
 * Callbacks are stored in a ref so they can be updated without
 * re-creating the socket connection.
 */
export function useSurveySocket(
  surveyId: string | null,
  callbacks: SurveySocketCallbacks
) {
  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef(callbacks);

  // Always keep the latest callbacks without re-triggering the effect
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  useEffect(() => {
    if (!surveyId) return;

    // Connect to the Socket.IO server (same origin as the API)
    const socket = io(API_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      // Join the survey room
      socket.emit(SOCKET_EVENTS.SURVEY_JOIN, { surveyId });
    });

    // Register event listeners
    socket.on(SOCKET_EVENTS.SURVEY_PHASE_CHANGED, (payload: PhaseChangedPayload) => {
      callbacksRef.current.onPhaseChanged?.(payload);
    });

    socket.on(SOCKET_EVENTS.SURVEY_PARTICIPANT_JOINED, (payload: ParticipantJoinedPayload) => {
      callbacksRef.current.onParticipantJoined?.(payload);
    });

    socket.on(SOCKET_EVENTS.OPTION_ADDED, (payload: OptionAddedPayload) => {
      callbacksRef.current.onOptionAdded?.(payload);
    });

    socket.on(SOCKET_EVENTS.OPTION_UPDATED, (payload: OptionUpdatedPayload) => {
      callbacksRef.current.onOptionUpdated?.(payload);
    });

    socket.on(SOCKET_EVENTS.OPTION_REMOVED, (payload: OptionRemovedPayload) => {
      callbacksRef.current.onOptionRemoved?.(payload);
    });

    socket.on(SOCKET_EVENTS.VOTE_RECEIVED, (payload: VoteReceivedPayload) => {
      callbacksRef.current.onVoteReceived?.(payload);
    });

    socket.on(SOCKET_EVENTS.OBJECTION_ADDED, (payload: ObjectionAddedPayload) => {
      callbacksRef.current.onObjectionAdded?.(payload);
    });

    socket.on(SOCKET_EVENTS.OBJECTION_STATUS_CHANGED, (payload: ObjectionStatusChangedPayload) => {
      callbacksRef.current.onObjectionStatusChanged?.(payload);
    });

    socket.on(SOCKET_EVENTS.PARTICIPANT_ROLE_CHANGED, (payload: ParticipantRoleChangedPayload) => {
      callbacksRef.current.onParticipantRoleChanged?.(payload);
    });

    // Cleanup: leave room and disconnect
    return () => {
      socket.emit(SOCKET_EVENTS.SURVEY_LEAVE, { surveyId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [surveyId]);

  const isConnected = useCallback(() => {
    return socketRef.current?.connected ?? false;
  }, []);

  return { isConnected };
}
