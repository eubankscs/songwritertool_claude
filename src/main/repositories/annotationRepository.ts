import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { Annotation } from '../../shared/schema';

export class AnnotationRepository {
  constructor(private db: Database.Database) {}

  getById(id: string): Annotation | undefined {
    return this.db.prepare('SELECT * FROM annotations WHERE id = ?').get(id) as Annotation | undefined;
  }

  getBySong(songId: string): Annotation[] {
    return this.db.prepare('SELECT * FROM annotations WHERE songId = ?').all(songId) as Annotation[];
  }

  getByRange(songId: string, targetRange: string): Annotation | undefined {
    return this.db
      .prepare('SELECT * FROM annotations WHERE songId = ? AND targetRange = ?')
      .get(songId, targetRange) as Annotation | undefined;
  }

  create(songId: string, targetRange: string, body: string, tagId?: string | null): Annotation {
    const id = uuidv4();
    this.db
      .prepare('INSERT INTO annotations (id, songId, targetRange, body, tagId) VALUES (?, ?, ?, ?, ?)')
      .run(id, songId, targetRange, body, tagId ?? null);
    return this.getById(id)!;
  }

  update(id: string, body: string, tagId?: string | null): void {
    this.db
      .prepare('UPDATE annotations SET body = ?, tagId = ? WHERE id = ?')
      .run(body, tagId ?? null, id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM annotations WHERE id = ?').run(id);
  }

  deleteBySong(songId: string): void {
    this.db.prepare('DELETE FROM annotations WHERE songId = ?').run(songId);
  }
}
