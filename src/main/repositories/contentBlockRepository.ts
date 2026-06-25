import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { ContentBlock, ContentBlockType } from '../../shared/schema';

export class ContentBlockRepository {
  constructor(private db: Database.Database) {}

  getById(id: string): ContentBlock | undefined {
    return this.db.prepare('SELECT * FROM content_blocks WHERE id = ?').get(id) as ContentBlock | undefined;
  }

  getByVersion(versionId: string): ContentBlock[] {
    return this.db
      .prepare('SELECT * FROM content_blocks WHERE versionId = ? ORDER BY position ASC')
      .all(versionId) as ContentBlock[];
  }

  create(versionId: string, type: ContentBlockType, position: number, content?: string | null): ContentBlock {
    const id = uuidv4();
    this.db
      .prepare('INSERT INTO content_blocks (id, versionId, type, content, position) VALUES (?, ?, ?, ?, ?)')
      .run(id, versionId, type, content ?? null, position);
    return this.getById(id)!;
  }

  update(id: string, content: string | null, position: number): void {
    this.db
      .prepare('UPDATE content_blocks SET content = ?, position = ? WHERE id = ?')
      .run(content, position, id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM content_blocks WHERE id = ?').run(id);
  }

  deleteByVersion(versionId: string): void {
    this.db.prepare('DELETE FROM content_blocks WHERE versionId = ?').run(versionId);
  }

  replaceAll(versionId: string, blocks: Array<{ type: ContentBlockType; content: string | null; position: number }>): void {
    const deleteStmt = this.db.prepare('DELETE FROM content_blocks WHERE versionId = ?');
    const insertStmt = this.db.prepare(
      'INSERT INTO content_blocks (id, versionId, type, content, position) VALUES (?, ?, ?, ?, ?)'
    );
    const tx = this.db.transaction(() => {
      deleteStmt.run(versionId);
      for (const block of blocks) {
        insertStmt.run(uuidv4(), versionId, block.type, block.content, block.position);
      }
    });
    tx();
  }
}
