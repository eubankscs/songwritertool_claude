import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { ArrangementMarker, ArrangementMarkerDisplayMode } from '../../shared/schema';

export class ArrangementMarkerRepository {
  constructor(private db: Database.Database) {}

  getById(id: string): ArrangementMarker | undefined {
    return this.db.prepare('SELECT * FROM arrangement_markers WHERE id = ?').get(id) as ArrangementMarker | undefined;
  }

  getByVersion(versionId: string): ArrangementMarker[] {
    return this.db
      .prepare('SELECT * FROM arrangement_markers WHERE versionId = ?')
      .all(versionId) as ArrangementMarker[];
  }

  create(versionId: string, targetPosition: string, displayMode: ArrangementMarkerDisplayMode, text: string): ArrangementMarker {
    const id = uuidv4();
    this.db
      .prepare('INSERT INTO arrangement_markers (id, versionId, targetPosition, displayMode, text) VALUES (?, ?, ?, ?, ?)')
      .run(id, versionId, targetPosition, displayMode, text);
    return this.getById(id)!;
  }

  update(id: string, targetPosition: string, displayMode: ArrangementMarkerDisplayMode, text: string): void {
    this.db
      .prepare('UPDATE arrangement_markers SET targetPosition = ?, displayMode = ?, text = ? WHERE id = ?')
      .run(targetPosition, displayMode, text, id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM arrangement_markers WHERE id = ?').run(id);
  }

  deleteByVersion(versionId: string): void {
    this.db.prepare('DELETE FROM arrangement_markers WHERE versionId = ?').run(versionId);
  }
}
