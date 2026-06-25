import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { Note, NoteType } from '../../shared/schema';

export class NoteRepository {
  constructor(private db: Database.Database) {}

  getById(id: string): Note | undefined {
    return this.db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note | undefined;
  }

  getBySong(songId: string): Note[] {
    return this.db.prepare('SELECT * FROM notes WHERE songId = ?').all(songId) as Note[];
  }

  create(songId: string, noteType: NoteType, body: string, targetId?: string | null): Note {
    const id = uuidv4();
    this.db
      .prepare('INSERT INTO notes (id, songId, noteType, targetId, body) VALUES (?, ?, ?, ?, ?)')
      .run(id, songId, noteType, targetId ?? null, body);
    return this.getById(id)!;
  }

  update(id: string, body: string): void {
    this.db.prepare('UPDATE notes SET body = ? WHERE id = ?').run(body, id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  }

  deleteBySong(songId: string): void {
    this.db.prepare('DELETE FROM notes WHERE songId = ?').run(songId);
  }
}
