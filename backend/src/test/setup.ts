import { beforeAll, afterAll } from 'vitest';
import { getDatabase, closeDatabase } from '../config/database';
import { runInitialMigration } from '../db/migrations/001_initial';
import { runPositionMigration } from '../db/migrations/002_add_position_to_options';
import { runFreitextMigration } from '../db/migrations/003_add_freitext_support';

beforeAll(() => {
  const db = getDatabase();
  runInitialMigration(db);
  runPositionMigration(db);
  runFreitextMigration(db);
});

afterAll(() => {
  closeDatabase();
});
