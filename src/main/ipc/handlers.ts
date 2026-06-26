import { ipcMain } from 'electron';
import { getDb } from '../database/db';
import { ProjectRepository } from '../repositories/projectRepository';
import { SongRepository } from '../repositories/songRepository';
import { SongVersionRepository } from '../repositories/songVersionRepository';
import { ContentBlockRepository } from '../repositories/contentBlockRepository';
import { ArrangementMarkerRepository } from '../repositories/arrangementMarkerRepository';
import { NoteRepository } from '../repositories/noteRepository';
import { AnnotationRepository } from '../repositories/annotationRepository';
import { TagRepository } from '../repositories/tagRepository';
import { ReviewQueueRepository } from '../repositories/reviewQueueRepository';
import type { ContentBlock, ContentBlockType, ArrangementMarkerDisplayMode, NoteType } from '../../shared/schema';

function getRepos() {
  const db = getDb();
  return {
    projects: new ProjectRepository(db),
    songs: new SongRepository(db),
  };
}

export function registerIpcHandlers(): void {
  // ── Projects ────────────────────────────────────────────────────────────────────

  ipcMain.handle('projects:getAll', () => {
    const { projects } = getRepos();
    return projects.getAll();
  });

  ipcMain.handle('projects:getUserProjects', () => {
    const { projects } = getRepos();
    return projects.getUserProjects();
  });

  ipcMain.handle('projects:getUnassigned', () => {
    const { projects } = getRepos();
    return projects.getUnassignedProject();
  });

  ipcMain.handle('projects:create', (_event, name: string) => {
    const { projects } = getRepos();
    if (projects.getByName(name)) {
      throw new Error(`A project named "${name}" already exists.`);
    }
    return projects.create(name);
  });

  ipcMain.handle('projects:rename', (_event, id: string, name: string) => {
    const { projects } = getRepos();
    const existing = projects.getByName(name);
    if (existing && existing.id !== id) {
      throw new Error(`A project named "${name}" already exists.`);
    }
    projects.rename(id, name);
  });

  ipcMain.handle('projects:delete', (_event, id: string, moveSongsToUnassigned: boolean) => {
    const { projects, songs } = getRepos();
    const db = getDb();
    const project = projects.getById(id);
    if (!project || project.isSystemProject) return;

    const projectSongs = songs.getByProject(id);
    if (moveSongsToUnassigned) {
      const unassigned = projects.getUnassignedProject();
      db.transaction(() => {
        for (const song of projectSongs) {
          songs.moveToProject(song.id, unassigned.id);
        }
        projects.delete(id);
      })();
    } else {
      db.transaction(() => {
        for (const song of projectSongs) {
          songs.softDelete(song.id);
        }
        projects.delete(id);
      })();
    }
  });

  ipcMain.handle('projects:touchLastUsed', (_event, id: string) => {
    const { projects } = getRepos();
    projects.touchLastUsed(id);
  });

  ipcMain.handle('projects:getSongCount', (_event, id: string) => {
    const { songs } = getRepos();
    return songs.getByProject(id).length;
  });

  // ── Songs ─────────────────────────────────────────────────────────────────────────

  ipcMain.handle('songs:getRecentlyOpened', (_event, limit: number) => {
    const { songs, projects } = getRepos();
    const recentSongs = songs.getRecentlyOpened(limit ?? 5);
    return recentSongs.map(song => ({
      ...song,
      containerName: projects.getById(song.projectId)?.name ?? 'Unassigned Songs',
    }));
  });

  ipcMain.handle('songs:getByProject', (_event, projectId: string) => {
    const { songs } = getRepos();
    return songs.getByProject(projectId);
  });

  ipcMain.handle('songs:getDeleted', () => {
    const { songs } = getRepos();
    return songs.getDeleted();
  });

  ipcMain.handle('songs:create', (_event, title: string, projectId: string) => {
    const { songs } = getRepos();
    if (songs.titleExistsInProject(title, projectId)) {
      throw new Error(`A song named "${title}" already exists in this project.`);
    }
    return songs.create(title, projectId);
  });

  ipcMain.handle('songs:rename', (_event, id: string, title: string) => {
    const { songs } = getRepos();
    const song = songs.getById(id);
    if (!song) throw new Error('Song not found.');
    if (songs.titleExistsInProject(title, song.projectId, id)) {
      throw new Error(`A song named "${title}" already exists in this project.`);
    }
    songs.rename(id, title);
  });

  ipcMain.handle('songs:getNextUntitledName', () => {
    const { songs } = getRepos();
    const allActive = songs.getAllActive();
    const untitledPattern = /^Untitled Song(?: (\d+))?$/;
    const usedNumbers = new Set<number>();
    for (const s of allActive) {
      const m = s.title.match(untitledPattern);
      if (m) {
        usedNumbers.add(m[1] ? parseInt(m[1], 10) : 1);
      }
    }
    if (!usedNumbers.has(1)) return 'Untitled Song';
    let n = 2;
    while (usedNumbers.has(n)) n++;
    return `Untitled Song ${n}`;
  });

  ipcMain.handle('songs:softDelete', (_event, id: string) => {
    const { songs } = getRepos();
    songs.softDelete(id);
  });

  ipcMain.handle('songs:touchLastOpened', (_event, id: string) => {
    const { songs } = getRepos();
    songs.touchLastOpened(id);
  });

  ipcMain.handle('songs:getById', (_event, id: string) => {
    const { songs } = getRepos();
    return songs.getById(id);
  });

  // ── Song Versions ────────────────────────────────────────────────────────────────

  ipcMain.handle('songVersions:getBySong', (_event, songId: string) => {
    const versions = new SongVersionRepository(getDb());
    return versions.getBySongId(songId);
  });

  ipcMain.handle('songVersions:upsertWorking', (_event, songId: string) => {
    const versions = new SongVersionRepository(getDb());
    return versions.upsert(songId, 'working');
  });

  ipcMain.handle('songVersions:upsertSaved', (_event, songId: string) => {
    const versions = new SongVersionRepository(getDb());
    return versions.upsert(songId, 'saved');
  });

  ipcMain.handle('songVersions:deleteWorking', (_event, songId: string) => {
    const db = getDb();
    const versions = new SongVersionRepository(db);
    const working = versions.getByType(songId, 'working');
    if (!working) return;
    const cbRepo = new ContentBlockRepository(db);
    const amRepo = new ArrangementMarkerRepository(db);
    db.transaction(() => {
      amRepo.deleteByVersion(working.id);
      cbRepo.deleteByVersion(working.id);
      versions.delete(working.id);
    })();
  });

  // ── Content Blocks ───────────────────────────────────────────────────────────────

  ipcMain.handle('contentBlocks:getByVersion', (_event, versionId: string) => {
    const blocks = new ContentBlockRepository(getDb());
    return blocks.getByVersion(versionId);
  });

  ipcMain.handle('contentBlocks:replaceAll', (
    _event,
    versionId: string,
    newBlocks: Array<{ type: ContentBlockType; content: string | null; position: number }>
  ) => {
    const blocks = new ContentBlockRepository(getDb());
    blocks.replaceAll(versionId, newBlocks);
  });

  // ── Arrangement Markers ─────────────────────────────────────────────────────────────

  ipcMain.handle('arrangementMarkers:getByVersion', (_event, versionId: string) => {
    const repo = new ArrangementMarkerRepository(getDb());
    return repo.getByVersion(versionId);
  });

  ipcMain.handle('arrangementMarkers:replaceAll', (
    _event,
    versionId: string,
    markers: Array<{ targetPosition: string; displayMode: ArrangementMarkerDisplayMode; text: string }>
  ) => {
    const db = getDb();
    const repo = new ArrangementMarkerRepository(db);
    db.transaction(() => {
      repo.deleteByVersion(versionId);
      for (const m of markers) {
        repo.create(versionId, m.targetPosition, m.displayMode, m.text);
      }
    })();
  });

  // ── Sync persist (for beforeunload) ────────────────────────────────────────────

  ipcMain.on('songs:persistWorkingSync', (event, data: {
    versionId: string | null;
    songId: string;
    blocks: Array<{ type: ContentBlockType; content: string | null; position: number }>;
    inlineMarkers: Array<{ lyricLinePosition: number; charOffset: number; text: string }>;
    standaloneMarkers: Array<{ afterBlockPosition: number; text: string }>;
  }) => {
    try {
      const db = getDb();
      const versions = new SongVersionRepository(db);
      const cbRepo = new ContentBlockRepository(db);
      const amRepo = new ArrangementMarkerRepository(db);

      let vid = data.versionId;
      if (!vid) {
        const v = versions.upsert(data.songId, 'working');
        vid = v.id;
      }

      db.transaction(() => { cbRepo.replaceAll(vid!, data.blocks); })();

      const newBlocks: ContentBlock[] = cbRepo.getByVersion(vid!);
      const posToId = new Map(newBlocks.map((b: ContentBlock) => [b.position, b.id]));

      db.transaction(() => {
        amRepo.deleteByVersion(vid!);
        for (const m of data.inlineMarkers) {
          const blockId = posToId.get(m.lyricLinePosition);
          if (blockId) amRepo.create(vid!, `${blockId}:${m.charOffset}`, 'inline', m.text);
        }
        for (const m of data.standaloneMarkers) {
          amRepo.create(vid!, String(m.afterBlockPosition), 'standalone', m.text);
        }
      })();

      event.returnValue = { success: true, versionId: vid };
    } catch {
      event.returnValue = { success: false };
    }
  });

  // ── Song Version Meta ─────────────────────────────────────────────────────
  ipcMain.handle('songVersions:updateMeta', (_event, versionId: string, capo: number | null, concertKey: string | null) => {
    getDb().prepare('UPDATE song_versions SET capo = ?, concertKey = ? WHERE id = ?').run(capo, concertKey, versionId);
  });

  // ── Notes ──────────────────────────────────────────────────────────────────
  ipcMain.handle('notes:getBySong', (_event, songId: string) => {
    return new NoteRepository(getDb()).getBySong(songId);
  });
  ipcMain.handle('notes:create', (_event, songId: string, noteType: NoteType, body: string, targetId: string | null) => {
    return new NoteRepository(getDb()).create(songId, noteType, body, targetId);
  });
  ipcMain.handle('notes:update', (_event, id: string, body: string) => {
    new NoteRepository(getDb()).update(id, body);
  });
  ipcMain.handle('notes:delete', (_event, id: string) => {
    new NoteRepository(getDb()).delete(id);
  });

  // ── Annotations ───────────────────────────────────────────────────────────
  ipcMain.handle('annotations:getBySong', (_event, songId: string) => {
    return new AnnotationRepository(getDb()).getBySong(songId);
  });
  ipcMain.handle('annotations:getByRange', (_event, songId: string, targetRange: string) => {
    return new AnnotationRepository(getDb()).getByRange(songId, targetRange);
  });
  ipcMain.handle('annotations:create', (_event, songId: string, targetRange: string, body: string, tagId: string | null) => {
    return new AnnotationRepository(getDb()).create(songId, targetRange, body, tagId);
  });
  ipcMain.handle('annotations:update', (_event, id: string, body: string, tagId: string | null) => {
    new AnnotationRepository(getDb()).update(id, body, tagId);
  });
  ipcMain.handle('annotations:delete', (_event, id: string) => {
    new AnnotationRepository(getDb()).delete(id);
  });

  // ── Tags ───────────────────────────────────────────────────────────────────
  ipcMain.handle('tags:getAll', () => {
    return new TagRepository(getDb()).getAll();
  });
  ipcMain.handle('tags:create', (_event, name: string, color: string | null, createsReviewItem: boolean) => {
    return new TagRepository(getDb()).create(name, color, createsReviewItem);
  });
  ipcMain.handle('tags:update', (_event, id: string, name: string, color: string | null, createsReviewItem: boolean) => {
    new TagRepository(getDb()).update(id, name, color, createsReviewItem);
  });
  ipcMain.handle('tags:delete', (_event, id: string) => {
    new TagRepository(getDb()).delete(id);
  });

  // ── Review Queue ──────────────────────────────────────────────────────────
  ipcMain.handle('reviewQueue:getBySong', (_event, songId: string) => {
    return new ReviewQueueRepository(getDb()).getBySong(songId);
  });
  ipcMain.handle('reviewQueue:create', (_event, songId: string, type: string, message: string, targetId: string | null) => {
    return new ReviewQueueRepository(getDb()).create(songId, type, message, targetId);
  });
  ipcMain.handle('reviewQueue:resolve', (_event, id: string) => {
    new ReviewQueueRepository(getDb()).resolve(id);
  });
  ipcMain.handle('reviewQueue:ignore', (_event, id: string) => {
    new ReviewQueueRepository(getDb()).ignore(id);
  });
}
