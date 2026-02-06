import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { env } from './config/env';
import { corsOptions } from './config/cors';
import { getDatabase, closeDatabase } from './config/database';
import { runInitialMigration } from './db/migrations/001_initial';
import { setupSocketServer } from './socket/index';
import { healthRouter } from './routes/health.routes';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());

// Database initialization
const database = getDatabase();
runInitialMigration(database);
console.log('Database initialized and migrations applied.');

// Routes
app.use('/api', healthRouter);

// Socket.IO
const io = setupSocketServer(httpServer);
console.log('Socket.IO server initialized.');

// Start server
httpServer.listen(env.PORT, () => {
  console.log(`UmfrageDeluxe Backend running on port ${env.PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});

// Graceful shutdown
function handleShutdown() {
  console.log('Shutting down gracefully...');
  closeDatabase();
  httpServer.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);
