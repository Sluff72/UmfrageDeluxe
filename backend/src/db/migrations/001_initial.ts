import type Database from 'better-sqlite3';

export function runInitialMigration(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      username        TEXT NOT NULL UNIQUE,
      password_hash   TEXT NOT NULL,
      display_name    TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS surveys (
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
                          'mehrheit'
                      )),
      w_max           INTEGER,
      max_points_per_option INTEGER DEFAULT 5,
      invite_code     TEXT NOT NULL UNIQUE,
      allow_anonymous BOOLEAN NOT NULL DEFAULT 1,
      is_archived     BOOLEAN NOT NULL DEFAULT 0,
      auto_transition_rules TEXT,
      created_by      TEXT NOT NULL REFERENCES users(id),
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_surveys_invite_code ON surveys(invite_code);
    CREATE INDEX IF NOT EXISTS idx_surveys_created_by ON surveys(created_by);

    CREATE TABLE IF NOT EXISTS survey_participants (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      survey_id       TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      user_id         TEXT REFERENCES users(id),
      anonymous_name  TEXT,
      anonymous_token TEXT,
      role            TEXT NOT NULL DEFAULT 'teilnehmer'
                      CHECK(role IN ('host', 'co_host', 'teilnehmer')),
      joined_at       TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(survey_id, user_id),
      UNIQUE(survey_id, anonymous_token)
    );

    CREATE INDEX IF NOT EXISTS idx_participants_survey ON survey_participants(survey_id);
    CREATE INDEX IF NOT EXISTS idx_participants_user ON survey_participants(user_id);

    CREATE TABLE IF NOT EXISTS options (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      survey_id       TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      title           TEXT NOT NULL,
      description     TEXT,
      created_by      TEXT NOT NULL REFERENCES survey_participants(id),
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_options_survey ON options(survey_id);

    CREATE TABLE IF NOT EXISTS votes (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      survey_id       TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      option_id       TEXT NOT NULL REFERENCES options(id) ON DELETE CASCADE,
      participant_id  TEXT NOT NULL REFERENCES survey_participants(id),
      value           INTEGER NOT NULL,
      voting_round    INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(option_id, participant_id, voting_round)
    );

    CREATE INDEX IF NOT EXISTS idx_votes_survey ON votes(survey_id);
    CREATE INDEX IF NOT EXISTS idx_votes_option ON votes(option_id);
    CREATE INDEX IF NOT EXISTS idx_votes_participant ON votes(participant_id);

    CREATE TABLE IF NOT EXISTS objections (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      survey_id       TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      participant_id  TEXT NOT NULL REFERENCES survey_participants(id),
      option_id       TEXT REFERENCES options(id),
      text            TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending', 'integrated', 'dismissed')),
      host_response   TEXT,
      voting_round    INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_objections_survey ON objections(survey_id);
  `);
}
