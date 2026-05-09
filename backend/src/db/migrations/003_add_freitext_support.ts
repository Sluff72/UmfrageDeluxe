import type Database from 'better-sqlite3';

/**
 * Adds support for the `freitext` voting method:
 *  - Extends the `voting_method` CHECK constraint on `surveys` to allow
 *    `'freitext'` (requires a table rebuild — SQLite cannot alter CHECKs).
 *  - Adds a `show_answer_authors` column on `surveys` controlling whether
 *    free-text answers are displayed with their author's name or anonymously.
 *  - Creates two new tables: `freetext_questions` (1..n questions per option)
 *    and `freetext_answers` (one answer per question + participant + round).
 *
 * Idempotent: detects prior runs by checking whether the new tables and
 * column already exist.
 */
export function runFreitextMigration(db: Database.Database): void {
  const newTables = db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type='table' AND name IN ('freetext_questions','freetext_answers')`
    )
    .all() as Array<{ name: string }>;

  const surveyColumns = db
    .prepare(`PRAGMA table_info(surveys)`)
    .all() as Array<{ name: string }>;
  const hasShowAuthors = surveyColumns.some((c) => c.name === 'show_answer_authors');

  if (newTables.length === 2 && hasShowAuthors) {
    return;
  }

  const foreignKeysWasOn =
    (db.pragma('foreign_keys', { simple: true }) as number) === 1;
  if (foreignKeysWasOn) {
    db.pragma('foreign_keys = OFF');
  }

  try {
    const migrate = db.transaction(() => {
      db.exec(`
        CREATE TABLE surveys_new (
          id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          title           TEXT NOT NULL,
          description     TEXT,
          status          TEXT NOT NULL DEFAULT 'entwurf'
                          CHECK(status IN (
                              'entwurf',
                              'optionen_sammeln',
                              'abstimmen',
                              'einwand_integration',
                              'beendet'
                          )),
          voting_method   TEXT NOT NULL DEFAULT 'widerstand'
                          CHECK(voting_method IN (
                              'widerstand_punkte',
                              'widerstand',
                              'mehrheit',
                              'freitext'
                          )),
          w_max           INTEGER,
          max_points_per_option INTEGER DEFAULT 5,
          show_answer_authors BOOLEAN NOT NULL DEFAULT 1,
          invite_code     TEXT NOT NULL UNIQUE,
          allow_anonymous BOOLEAN NOT NULL DEFAULT 1,
          is_archived     BOOLEAN NOT NULL DEFAULT 0,
          auto_transition_rules TEXT,
          created_by      TEXT NOT NULL REFERENCES users(id),
          created_at      TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      if (hasShowAuthors) {
        db.exec(`
          INSERT INTO surveys_new (
            id, title, description, status, voting_method, w_max,
            max_points_per_option, show_answer_authors, invite_code,
            allow_anonymous, is_archived, auto_transition_rules,
            created_by, created_at, updated_at
          )
          SELECT
            id, title, description, status, voting_method, w_max,
            max_points_per_option, show_answer_authors, invite_code,
            allow_anonymous, is_archived, auto_transition_rules,
            created_by, created_at, updated_at
          FROM surveys;
        `);
      } else {
        db.exec(`
          INSERT INTO surveys_new (
            id, title, description, status, voting_method, w_max,
            max_points_per_option, invite_code,
            allow_anonymous, is_archived, auto_transition_rules,
            created_by, created_at, updated_at
          )
          SELECT
            id, title, description, status, voting_method, w_max,
            max_points_per_option, invite_code,
            allow_anonymous, is_archived, auto_transition_rules,
            created_by, created_at, updated_at
          FROM surveys;
        `);
      }

      db.exec(`DROP TABLE surveys;`);
      db.exec(`ALTER TABLE surveys_new RENAME TO surveys;`);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_surveys_invite_code ON surveys(invite_code);
        CREATE INDEX IF NOT EXISTS idx_surveys_created_by ON surveys(created_by);
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS freetext_questions (
          id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          option_id   TEXT NOT NULL REFERENCES options(id) ON DELETE CASCADE,
          text        TEXT NOT NULL,
          position    INTEGER NOT NULL DEFAULT 0,
          created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_freetext_questions_option
          ON freetext_questions(option_id);

        CREATE TABLE IF NOT EXISTS freetext_answers (
          id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          survey_id       TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
          question_id     TEXT NOT NULL REFERENCES freetext_questions(id) ON DELETE CASCADE,
          participant_id  TEXT NOT NULL REFERENCES survey_participants(id),
          text            TEXT NOT NULL,
          voting_round    INTEGER NOT NULL DEFAULT 1,
          created_at      TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(question_id, participant_id, voting_round)
        );

        CREATE INDEX IF NOT EXISTS idx_freetext_answers_survey
          ON freetext_answers(survey_id);
        CREATE INDEX IF NOT EXISTS idx_freetext_answers_question
          ON freetext_answers(question_id);
      `);
    });

    migrate();
  } finally {
    if (foreignKeysWasOn) {
      db.pragma('foreign_keys = ON');
    }
  }
}
