import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { Tag } from '../../shared/schema';

export class TagRepository {
  constructor(private db: Database.Database) {}

  getAll(): Tag[] {
    return this.db.prepare('SELECT * FROM tags').all() as Tag[];
  }

  getById(id: string): Tag | undefined {
    return this.db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as Tag | undefined;
  }

  getByName(name: string): Tag | undefined {
    return this.db.prepare('SELECT * FROM tags WHERE name = ?').get(name) as Tag | undefined;
  }

  create(name: string, color?: string | null, createsReviewItem?: boolean): Tag {
    const id = uuidv4();
    this.db
      .prepare('INSERT INTO tags (id, name, color, createsReviewItem) VALUES (?, ?, ?, ?)')
      .run(id, name, color ?? null, createsReviewItem ? 1 : 0);
    return this.getById(id)!;
  }

  update(id: string, name: string, color: string | null, createsReviewItem: boolean): void {
    this.db
      .prepare('UPDATE tags SET name = ?, color = ?, createsReviewItem = ? WHERE id = ?')
      .run(name, color, createsReviewItem ? 1 : 0, id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  }
}
