import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { ReviewQueueItem } from '../../shared/schema';

export class ReviewQueueRepository {
  constructor(private db: Database.Database) {}

  getById(id: string): ReviewQueueItem | undefined {
    return this.db.prepare('SELECT * FROM review_queue WHERE id = ?').get(id) as ReviewQueueItem | undefined;
  }

  getBySong(songId: string): ReviewQueueItem[] {
    return this.db
      .prepare('SELECT * FROM review_queue WHERE songId = ? AND ignoredOn IS NULL AND resolvedOn IS NULL ORDER BY createdOn ASC')
      .all(songId) as ReviewQueueItem[];
  }

  create(songId: string, type: string, message: string, targetId?: string | null): ReviewQueueItem {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db
      .prepare('INSERT INTO review_queue (id, songId, targetId, type, message, createdOn) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, songId, targetId ?? null, type, message, now);
    return this.getById(id)!;
  }

  resolve(id: string): void {
    this.db
      .prepare('UPDATE review_queue SET resolvedOn = ? WHERE id = ?')
      .run(new Date().toISOString(), id);
  }

  ignore(id: string): void {
    this.db
      .prepare('UPDATE review_queue SET ignoredOn = ? WHERE id = ?')
      .run(new Date().toISOString(), id);
  }

  deleteBySong(songId: string): void {
    this.db.prepare('DELETE FROM review_queue WHERE songId = ?').run(songId);
  }
}
