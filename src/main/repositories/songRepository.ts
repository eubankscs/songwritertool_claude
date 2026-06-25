import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { Song } from '../../shared/schema';

export class SongRepository {
  constructor(private db: Database.Database) {}

  getById(id: string): Song | undefined {
    return this.db.prepare('SELECT * FROM songs WHERE id = ?').get(id) as Song | undefined;
  }

  getByProject(projectId: string): Song[] {
    return this.db
      .prepare('SELECT * FROM songs WHERE projectId = ? AND deletedOn IS NULL')
      .all(projectId) as Song[];
  }

  getRecentlyOpened(limit: number = 5): Song[] {
    return this.db
      .prepare('SELECT * FROM songs WHERE deletedOn IS NULL ORDER BY lastOpenedOn DESC LIMIT ?')
      .all(limit) as Song[];
  }

  getDeleted(): Song[] {
    return this.db
      .prepare('SELECT * FROM songs WHERE deletedOn IS NOT NULL ORDER BY deletedOn DESC')
      .all() as Song[];
  }

  getAllActive(): Song[] {
    return this.db.prepare('SELECT * FROM songs WHERE deletedOn IS NULL').all() as Song[];
  }

  create(title: string, projectId: string): Song {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db
      .prepare('INSERT INTO songs (id, title, projectId, createdOn, updatedOn, lastOpenedOn, deletedOn, originalProjectId) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)')
      .run(id, title, projectId, now, now, now);
    return this.getById(id)!;
  }

  rename(id: string, title: string): void {
    this.db
      .prepare('UPDATE songs SET title = ?, updatedOn = ? WHERE id = ?')
      .run(title, new Date().toISOString(), id);
  }

  touchLastOpened(id: string): void {
    this.db
      .prepare('UPDATE songs SET lastOpenedOn = ? WHERE id = ?')
      .run(new Date().toISOString(), id);
  }

  softDelete(id: string): void {
    const song = this.getById(id);
    if (!song) return;
    this.db
      .prepare('UPDATE songs SET deletedOn = ?, originalProjectId = ? WHERE id = ?')
      .run(new Date().toISOString(), song.projectId, id);
  }

  restore(id: string, projectId: string): void {
    this.db
      .prepare('UPDATE songs SET deletedOn = NULL, projectId = ?, originalProjectId = NULL, lastOpenedOn = ? WHERE id = ?')
      .run(projectId, new Date().toISOString(), id);
  }

  permanentlyDelete(id: string): void {
    this.db.prepare('DELETE FROM songs WHERE id = ?').run(id);
  }

  moveToProject(id: string, projectId: string): void {
    this.db
      .prepare('UPDATE songs SET projectId = ?, updatedOn = ? WHERE id = ?')
      .run(projectId, new Date().toISOString(), id);
  }

  titleExistsInProject(title: string, projectId: string, excludeId?: string): boolean {
    if (excludeId) {
      const row = this.db
        .prepare('SELECT id FROM songs WHERE title = ? AND projectId = ? AND deletedOn IS NULL AND id != ?')
        .get(title, projectId, excludeId);
      return row !== undefined;
    }
    const row = this.db
      .prepare('SELECT id FROM songs WHERE title = ? AND projectId = ? AND deletedOn IS NULL')
      .get(title, projectId);
    return row !== undefined;
  }
}
