import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { env } from './env';

let database: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (database) {
    return database;
  }

  const databaseDirectory = path.dirname(env.DATABASE_PATH);
  if (!fs.existsSync(databaseDirectory)) {
    fs.mkdirSync(databaseDirectory, { recursive: true });
  }

  database = new Database(env.DATABASE_PATH);

  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');

  return database;
}

export function closeDatabase(): void {
  if (database) {
    database.close();
    database = null;
  }
}
