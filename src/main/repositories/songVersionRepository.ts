import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { SongVersion, VersionType } from '../../shared/schema';

export class SongVersionRepository {
  constructor(private db: Database.Database) {}

  getById(id: string): SongVersion | undefined {
    return this.db.prepare('SELECT * FROM song_versions WHERE id = ?').get(id) as SongVersion | undefined;
  }

  getBySongId(songId: string): SongVersion[] {
    return this.db.prepare('SELECT * FROM song_versions WHERE songId = ?').all(songId) as SongVersion[];
  }

  getByType(songId: string, type: VersionType): SongVersion | undefined {
    return this.db
      .prepare('SELECT * FROM song_versions WHERE songId = ? AND type = ?')
      .get(songId, type) as SongVersion | undefined;
  }

  create(songId: string, type: VersionType, capo?: number | null, concertKey?: string | null): SongVersion {
    const id = uuidv4();
    this.db
      .prepare('INSERT INTO song_versions (id, songId, type, capo, concertKey) VALUES (?, ?, ?, ?, ?)')
      .run(id, songId, type, capo ?? null, concertKey ?? null);
    return this.getById(id)!;
  }

  upsert(songId: string, type: VersionType, capo?: number | null, concertKey?: string | null): SongVersion {
    const existing = this.getByType(songId, type);
    if (existing) {
      this.db
        .prepare('UPDATE song_versions SET capo = ?, concertKey = ? WHERE id = ?')
        .run(capo ?? null, concertKey ?? null, existing.id);
      return this.getById(existing.id)!;
    }
    return this.create(songId, type, capo, concertKey);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM song_versions WHERE id = ?').run(id);
  }

  deleteByType(songId: string, type: VersionType): void {
    this.db.prepare('DELETE FROM song_versions WHERE songId = ? AND type = ?').run(songId, type);
  }
}
