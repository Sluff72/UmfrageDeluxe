import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { env } from '../config/env';
import { SOCKET_EVENTS, buildSurveyRoomName } from './events';

let io: SocketServer | null = null;

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
