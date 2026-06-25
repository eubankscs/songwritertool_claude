import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { Project } from '../../shared/schema';

export class ProjectRepository {
  constructor(private db: Database.Database) {}

  getAll(): Project[] {
    return this.db.prepare('SELECT * FROM projects').all() as Project[];
  }

  getById(id: string): Project | undefined {
    return this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
  }

  getByName(name: string): Project | undefined {
    return this.db.prepare('SELECT * FROM projects WHERE name = ?').get(name) as Project | undefined;
  }

  getUserProjects(): Project[] {
    return this.db
      .prepare('SELECT * FROM projects WHERE isSystemProject = 0 ORDER BY lastUsedOn DESC')
      .all() as Project[];
  }

  getUnassignedProject(): Project {
    return this.db
      .prepare("SELECT * FROM projects WHERE isSystemProject = 1 AND name = 'Unassigned Songs'")
      .get() as Project;
  }

  create(name: string): Project {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db
      .prepare('INSERT INTO projects (id, name, createdOn, lastUsedOn, isSystemProject) VALUES (?, ?, ?, ?, 0)')
      .run(id, name, now, now);
    return this.getById(id)!;
  }

  rename(id: string, name: string): void {
    this.db.prepare('UPDATE projects SET name = ? WHERE id = ? AND isSystemProject = 0').run(name, id);
  }

  touchLastUsed(id: string): void {
    this.db
      .prepare('UPDATE projects SET lastUsedOn = ? WHERE id = ?')
      .run(new Date().toISOString(), id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM projects WHERE id = ? AND isSystemProject = 0').run(id);
  }
}
