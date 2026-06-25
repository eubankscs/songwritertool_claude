/**
 * Verifies the database schema matches the spec exactly.
 * Runs against a temporary in-memory database.
 * Exit code 0 = all checks pass. Exit code 1 = failures.
 */
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

const db = new Database(':memory:');
db.pragma('foreign_keys = ON');

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

let pass = 0;
let fail = 0;

function assert(label, fn) {
  try {
    const result = fn();
    if (result === false) throw new Error('returned false');
    console.log(`  PASS  ${label}`);
    pass++;
  } catch (e) {
    console.error(`  FAIL  ${label}: ${e.message}`);
    fail++;
  }
}

function assertThrows(label, fn) {
  try {
    fn();
    console.error(`  FAIL  ${label}: expected an error but none was thrown`);
    fail++;
  } catch {
    console.log(`  PASS  ${label}`);
    pass++;
  }
}

const now = new Date().toISOString();
const projectId = uuidv4();
db.prepare('INSERT INTO projects VALUES (?,?,?,?,0)').run(projectId, 'Test Project', now, now);
const songId = uuidv4();
db.prepare('INSERT INTO songs VALUES (?,?,?,?,?,?,NULL,NULL)').run(songId, 'Test Song', projectId, now, now, now);
const tagId = uuidv4();
db.prepare('INSERT INTO tags VALUES (?,?,NULL,0)').run(tagId, 'Test Tag');

console.log('\n-- Table existence --');
const tables = ['projects','songs','song_versions','content_blocks','arrangement_markers','notes','annotations','tags','review_queue'];
for (const t of tables) {
  assert(`Table "${t}" exists`, () => {
    const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(t);
    return row !== undefined;
  });
}

console.log('\n-- CHECK constraints --');
assertThrows('song_versions.type rejects invalid value', () => {
  db.prepare('INSERT INTO song_versions VALUES (?,?,?,NULL,NULL)').run(uuidv4(), songId, 'invalid');
});
assert('song_versions.type accepts "saved"', () => {
  const id = uuidv4();
  db.prepare('INSERT INTO song_versions VALUES (?,?,?,NULL,NULL)').run(id, songId, 'saved');
  db.prepare('DELETE FROM song_versions WHERE id=?').run(id);
});
assert('song_versions.type accepts "working"', () => {
  const id = uuidv4();
  db.prepare('INSERT INTO song_versions VALUES (?,?,?,NULL,NULL)').run(id, songId, 'working');
  db.prepare('DELETE FROM song_versions WHERE id=?').run(id);
});

const vId = uuidv4();
db.prepare('INSERT INTO song_versions VALUES (?,?,?,NULL,NULL)').run(vId, songId, 'saved');

assertThrows('content_blocks.type rejects invalid value', () => {
  db.prepare('INSERT INTO content_blocks VALUES (?,?,?,NULL,0)').run(uuidv4(), vId, 'badtype');
});
for (const t of ['section','lyricLine','chordLine','arrangementMarker']) {
  assert(`content_blocks.type accepts "${t}"`, () => {
    const id = uuidv4();
    db.prepare('INSERT INTO content_blocks VALUES (?,?,?,NULL,0)').run(id, vId, t);
    db.prepare('DELETE FROM content_blocks WHERE id=?').run(id);
  });
}

assertThrows('arrangement_markers.displayMode rejects invalid value', () => {
  db.prepare('INSERT INTO arrangement_markers VALUES (?,?,?,?,?)').run(uuidv4(), vId, 'block:0', 'bad', 'Marker');
});
for (const m of ['inline','standalone']) {
  assert(`arrangement_markers.displayMode accepts "${m}"`, () => {
    const id = uuidv4();
    db.prepare('INSERT INTO arrangement_markers VALUES (?,?,?,?,?)').run(id, vId, 'block:0', m, 'Marker');
    db.prepare('DELETE FROM arrangement_markers WHERE id=?').run(id);
  });
}

assertThrows('notes.noteType rejects invalid value', () => {
  db.prepare('INSERT INTO notes VALUES (?,?,?,NULL,?)').run(uuidv4(), songId, 'badtype', 'body');
});
for (const nt of ['line','section','song']) {
  assert(`notes.noteType accepts "${nt}"`, () => {
    const id = uuidv4();
    db.prepare('INSERT INTO notes VALUES (?,?,?,NULL,?)').run(id, songId, nt, 'body');
    db.prepare('DELETE FROM notes WHERE id=?').run(id);
  });
}

console.log('\n-- UNIQUE constraints --');
assert('projects.name is UNIQUE', () => {
  const p2 = uuidv4();
  try {
    db.prepare('INSERT INTO projects VALUES (?,?,?,?,0)').run(p2, 'Test Project', now, now);
    return false;
  } catch { return true; }
});
assert('song_versions UNIQUE(songId, type)', () => {
  try {
    db.prepare('INSERT INTO song_versions VALUES (?,?,?,NULL,NULL)').run(uuidv4(), songId, 'saved');
    return false;
  } catch { return true; }
});

console.log('\n-- Foreign key constraints --');
assertThrows('songs.projectId must reference projects', () => {
  db.prepare('INSERT INTO songs VALUES (?,?,?,?,?,?,NULL,NULL)').run(uuidv4(), 'Orphan', 'nonexistent', now, now, now);
});
assertThrows('song_versions.songId must reference songs', () => {
  db.prepare('INSERT INTO song_versions VALUES (?,?,?,NULL,NULL)').run(uuidv4(), 'nonexistent', 'saved');
});
assertThrows('content_blocks.versionId must reference song_versions', () => {
  db.prepare('INSERT INTO content_blocks VALUES (?,?,?,NULL,0)').run(uuidv4(), 'nonexistent', 'lyricLine');
});
assertThrows('annotations.tagId must reference tags', () => {
  db.prepare('INSERT INTO annotations VALUES (?,?,?,?,?)').run(uuidv4(), songId, 'range:0', 'body', 'nonexistent');
});

console.log('\n-- Column defaults --');
assert('tags.createsReviewItem defaults to 0', () => {
  const id = uuidv4();
  db.prepare('INSERT INTO tags (id, name) VALUES (?,?)').run(id, 'DefaultTag');
  const row = db.prepare('SELECT createsReviewItem FROM tags WHERE id=?').get(id);
  return row.createsReviewItem === 0;
});
assert('projects.isSystemProject defaults to 0', () => {
  const id = uuidv4();
  db.prepare('INSERT INTO projects (id, name, createdOn, lastUsedOn) VALUES (?,?,?,?)').run(id, 'DefProj', now, now);
  const row = db.prepare('SELECT isSystemProject FROM projects WHERE id=?').get(id);
  return row.isSystemProject === 0;
});

console.log('\n-- Nullable columns --');
assert('annotations.tagId is nullable', () => {
  const id = uuidv4();
  db.prepare('INSERT INTO annotations VALUES (?,?,?,?,NULL)').run(id, songId, 'range:1', 'body');
  db.prepare('DELETE FROM annotations WHERE id=?').run(id);
  return true;
});
assert('notes.targetId is nullable (song-level notes)', () => {
  const id = uuidv4();
  db.prepare('INSERT INTO notes VALUES (?,?,?,NULL,?)').run(id, songId, 'song', 'note body');
  db.prepare('DELETE FROM notes WHERE id=?').run(id);
  return true;
});
assert('songs.deletedOn is nullable', () => {
  const id = uuidv4();
  db.prepare('INSERT INTO songs VALUES (?,?,?,?,?,?,NULL,NULL)').run(id, 'NullableTest', projectId, now, now, now);
  db.prepare('DELETE FROM songs WHERE id=?').run(id);
  return true;
});

console.log('\n-- Idempotency --');
assert('Re-running CREATE TABLE IF NOT EXISTS causes no error', () => {
  db.exec(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, createdOn TEXT,
    lastUsedOn TEXT, isSystemProject BOOLEAN NOT NULL DEFAULT 0
  );`);
  return true;
});

console.log(`\nResults: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  process.exit(1);
} else {
  console.log('All schema checks passed.');
  process.exit(0);
}
