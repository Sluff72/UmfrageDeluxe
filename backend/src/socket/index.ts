import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { env } from '../config/env';
import { getDatabase } from '../config/database';
import { authService } from '../services/auth.service';
import { SOCKET_EVENTS, buildSurveyRoomName } from './events';

let io: SocketServer | null = null;

function getStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function parseCookies(rawCookieHeader: string | undefined): Record<string, string> {
  if (!rawCookieHeader) {
    return {};
  }

  const cookies: Record<string, string> = {};

  for (const pair of rawCookieHeader.split(';')) {
    const index = pair.indexOf('=');
    if (index === -1) {
      continue;
    }

    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();

    if (!key) {
      continue;
    }

    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }

  return cookies;
}

function extractJwtToken(socket: Socket): string | null {
  const authToken = getStringValue(socket.handshake.auth?.token);
  if (authToken) {
    return authToken;
  }

  const authorizationHeader = getStringValue(socket.handshake.headers.authorization);
  if (authorizationHeader?.startsWith('Bearer ')) {
    return authorizationHeader.slice(7);
  }

  const cookies = parseCookies(getStringValue(socket.handshake.headers.cookie) ?? undefined);
  return cookies.token ?? null;
}

function extractAnonymousParticipantToken(socket: Socket): string | null {
  return getStringValue(socket.handshake.auth?.participantToken);
}

function isAuthorizedForSurvey(socket: Socket, surveyId: string): boolean {
  const database = getDatabase();

  const jwtToken = extractJwtToken(socket);
  if (jwtToken) {
    try {
      const payload = authService.verifyToken(jwtToken);

      const participant = database
        .prepare('SELECT id FROM survey_participants WHERE survey_id = ? AND user_id = ?')
        .get(surveyId, payload.sub) as { id: string } | undefined;

      if (participant) {
        return true;
      }
    } catch {
      // Invalid JWT: continue with anonymous participant token check.
    }
  }

  const participantToken = extractAnonymousParticipantToken(socket);
  if (participantToken) {
    const participant = database
      .prepare(
        'SELECT id FROM survey_participants WHERE survey_id = ? AND anonymous_token = ?'
      )
      .get(surveyId, participantToken) as { id: string } | undefined;

    if (participant) {
      return true;
    }
  }

  return false;
}

export function setupSocketServer(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on(SOCKET_EVENTS.SURVEY_JOIN, ({ surveyId }: { surveyId: string }) => {
      if (!getStringValue(surveyId)) {
        return;
      }

      if (!isAuthorizedForSurvey(socket, surveyId)) {
        console.warn(`Socket ${socket.id} denied room join for survey ${surveyId}`);
        socket.emit('survey:join-denied', { surveyId });
        return;
      }

      const roomName = buildSurveyRoomName(surveyId);
      socket.join(roomName);
      console.log(`Socket ${socket.id} joined room ${roomName}`);
    });

    socket.on(SOCKET_EVENTS.SURVEY_LEAVE, ({ surveyId }: { surveyId: string }) => {
      const roomName = buildSurveyRoomName(surveyId);
      socket.leave(roomName);
      console.log(`Socket ${socket.id} left room ${roomName}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getSocketServer(): SocketServer {
  if (!io) {
    throw new Error('Socket.IO server not initialized. Call setupSocketServer first.');
  }
  return io;
}
