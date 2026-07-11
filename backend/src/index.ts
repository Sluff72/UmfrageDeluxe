import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { env } from './config/env';
import { corsOptions } from './config/cors';
import { getDatabase, closeDatabase } from './config/database';
import { runInitialMigration } from './db/migrations/001_initial';
import { runPositionMigration } from './db/migrations/002_add_position_to_options';
import { runCurrentVotingRoundMigration } from './db/migrations/003_add_current_voting_round';
import { runAnonymousVotingMigration } from './db/migrations/004_add_anonymous_voting';
import { setupSocketServer } from './socket/index';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './routes/auth.routes';
import { surveyRouter } from './routes/survey.routes';
import { optionRouter } from './routes/option.routes';
import { voteRouter } from './routes/vote.routes';
import { objectionRouter } from './routes/objection.routes';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';

const app = express();
const httpServer = createServer(app);

// Trust first proxy (Caddy) so rate limiter sees real client IP
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(generalLimiter);

// Database initialization
const database = getDatabase();
runInitialMigration(database);
runPositionMigration(database);
runCurrentVotingRoundMigration(database);
runAnonymousVotingMigration(database);
console.log('Database initialized and migrations applied.');

// Routes
app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', surveyRouter);
app.use('/api', optionRouter);
app.use('/api', voteRouter);
app.use('/api', objectionRouter);

// Error handler (must be last)
app.use(errorHandler);

// Socket.IO
setupSocketServer(httpServer);
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
