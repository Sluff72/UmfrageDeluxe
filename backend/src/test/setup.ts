import { beforeAll, afterAll } from 'vitest';
import { getDatabase, closeDatabase } from '../config/database';
import { runInitialMigration } from '../db/migrations/001_initial';

beforeAll(() => {
  const db = getDatabase();
  runInitialMigration(db);
});

afterAll(() => {
  closeDatabase();
});
