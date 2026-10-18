import { beforeAll, afterAll } from 'vitest';
import { getDatabase, closeDatabase } from '../config/database';
import { runInitialMigration } from '../db/migrations/001_initial';
import { runPositionMigration } from '../db/migrations/002_add_position_to_options';
import { runCurrentVotingRoundMigration } from '../db/migrations/003_add_current_voting_round';
import { runAnonymousVotingMigration } from '../db/migrations/004_add_anonymous_voting';
import { runLoginLockoutMigration } from '../db/migrations/005_add_login_lockout';

beforeAll(() => {
  const db = getDatabase();
  runInitialMigration(db);
  runPositionMigration(db);
  runCurrentVotingRoundMigration(db);
  runAnonymousVotingMigration(db);
  runLoginLockoutMigration(db);
});

afterAll(() => {
  closeDatabase();
});
