import type Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL UNIQUE,
      createdOn       TEXT,
      lastUsedOn      TEXT,
      isSystemProject BOOLEAN NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS songs (
      id                TEXT PRIMARY KEY,
      title             TEXT NOT NULL,
      projectId         TEXT NOT NULL REFERENCES projects(id),
      createdOn         TEXT,
      updatedOn         TEXT,
      lastOpenedOn      TEXT,
      deletedOn         TEXT NULL,
      originalProjectId TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS song_versions (
      id          TEXT PRIMARY KEY,
      songId      TEXT NOT NULL REFERENCES songs(id),
      type        TEXT NOT NULL CHECK(type IN ('saved','working')),
      capo        INTEGER NULL,
      concertKey  TEXT NULL,
      UNIQUE(songId, type)
    );

    CREATE TABLE IF NOT EXISTS content_blocks (
      id        TEXT PRIMARY KEY,
      versionId TEXT NOT NULL REFERENCES song_versions(id),
      type      TEXT NOT NULL CHECK(type IN ('section','lyricLine','chordLine','arrangementMarker')),
      content   TEXT,
      position  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS arrangement_markers (
      id             TEXT PRIMARY KEY,
      versionId      TEXT NOT NULL REFERENCES song_versions(id),
      targetPosition TEXT NOT NULL,
      displayMode    TEXT CHECK(displayMode IN ('inline','standalone')),
      text           TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id       TEXT PRIMARY KEY,
      songId   TEXT NOT NULL REFERENCES songs(id),
      noteType TEXT NOT NULL CHECK(noteType IN ('line','section','song')),
      targetId TEXT NULL,
      body     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id          TEXT PRIMARY KEY,
      songId      TEXT NOT NULL REFERENCES songs(id),
      targetRange TEXT NOT NULL,
      body        TEXT NOT NULL,
      tagId       TEXT NULL REFERENCES tags(id)
    );

    CREATE TABLE IF NOT EXISTS tags (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL UNIQUE,
      color             TEXT NULL,
      createsReviewItem BOOLEAN NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS review_queue (
      id         TEXT PRIMARY KEY,
      songId     TEXT NOT NULL REFERENCES songs(id),
      targetId   TEXT NULL,
      type       TEXT NOT NULL,
      message    TEXT NOT NULL,
      createdOn  TEXT,
      ignoredOn  TEXT NULL,
      resolvedOn TEXT NULL
    );
  `);

  seedSystemProjects(db);
}

function seedSystemProjects(db: Database.Database): void {
  const existing = db.prepare('SELECT id FROM projects WHERE isSystemProject = 1 AND name = ?').get('Unassigned Songs');
  if (!existing) {
    const { v4: uuidv4 } = require('uuid');
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO projects (id, name, createdOn, lastUsedOn, isSystemProject) VALUES (?, ?, ?, ?, 1)'
    ).run(uuidv4(), 'Unassigned Songs', now, now);
  }
}
