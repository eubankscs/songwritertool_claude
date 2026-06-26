import type { Project, Song, SongVersion, ContentBlock, ContentBlockType, ArrangementMarker, Note, NoteType, Annotation, Tag, ReviewQueueItem } from './schema';

export interface RecentSong extends Song {
  containerName: string;
}

export interface PersistWorkingSyncPayload {
  versionId: string | null;
  songId: string;
  blocks: Array<{ type: ContentBlockType; content: string | null; position: number }>;
  inlineMarkers: Array<{ lyricLinePosition: number; charOffset: number; text: string }>;
  standaloneMarkers: Array<{ afterBlockPosition: number; text: string }>;
}

export interface SongwriterAPI {
  projects: {
    getAll(): Promise<Project[]>;
    getUserProjects(): Promise<Project[]>;
    getUnassigned(): Promise<Project>;
    create(name: string): Promise<Project>;
    rename(id: string, name: string): Promise<void>;
    delete(id: string, moveSongsToUnassigned: boolean): Promise<void>;
    touchLastUsed(id: string): Promise<void>;
    getSongCount(id: string): Promise<number>;
  };
  songs: {
    getRecentlyOpened(limit?: number): Promise<RecentSong[]>;
    getByProject(projectId: string): Promise<Song[]>;
    getDeleted(): Promise<Song[]>;
    getAllActive(): Promise<RecentSong[]>;
    create(title: string, projectId: string): Promise<Song>;
    rename(id: string, title: string): Promise<void>;
    getNextUntitledName(): Promise<string>;
    softDelete(id: string): Promise<void>;
    touchLastOpened(id: string): Promise<void>;
    getById(id: string): Promise<Song | undefined>;
    persistWorkingSync(payload: PersistWorkingSyncPayload): { success: boolean; versionId?: string };
    purgeOldDeleted(): Promise<void>;
    permanentlyDelete(songId: string): Promise<void>;
    restore(songId: string, targetProjectId: string): Promise<void>;
    restorePermanent(songId: string, targetProjectId: string): Promise<void>;
    restoreAsVariant(originalSongId: string, newTitle: string, targetProjectId: string): Promise<void>;
    checkTitleInProject(title: string, projectId: string, excludeId?: string): Promise<boolean>;
    moveToProject(songId: string, targetProjectId: string): Promise<void>;
    createVariant(originalSongId: string, newTitle: string, targetProjectId: string): Promise<void>;
    saveAsVariant(originalSongId: string, newTitle: string, targetProjectId: string): Promise<Song | undefined>;
  };
  songVersions: {
    getBySong(songId: string): Promise<SongVersion[]>;
    upsertWorking(songId: string): Promise<SongVersion>;
    upsertSaved(songId: string): Promise<SongVersion>;
    deleteWorking(songId: string): Promise<void>;
    updateMeta(versionId: string, capo: number | null, concertKey: string | null): Promise<void>;
  };
  contentBlocks: {
    getByVersion(versionId: string): Promise<ContentBlock[]>;
    replaceAll(
      versionId: string,
      blocks: Array<{ type: ContentBlockType; content: string | null; position: number }>
    ): Promise<void>;
  };
  arrangementMarkers: {
    getByVersion(versionId: string): Promise<ArrangementMarker[]>;
    replaceAll(
      versionId: string,
      markers: Array<{ targetPosition: string; displayMode: 'inline' | 'standalone'; text: string }>
    ): Promise<void>;
  };
  notes: {
    getBySong(songId: string): Promise<Note[]>;
    create(songId: string, noteType: NoteType, body: string, targetId: string | null): Promise<Note>;
    update(id: string, body: string): Promise<void>;
    delete(id: string): Promise<void>;
  };
  annotations: {
    getBySong(songId: string): Promise<Annotation[]>;
    getByRange(songId: string, targetRange: string): Promise<Annotation | undefined>;
    create(songId: string, targetRange: string, body: string, tagId: string | null): Promise<Annotation>;
    update(id: string, body: string, tagId: string | null): Promise<void>;
    delete(id: string): Promise<void>;
  };
  tags: {
    getAll(): Promise<Tag[]>;
    create(name: string, color: string | null, createsReviewItem: boolean): Promise<Tag>;
    update(id: string, name: string, color: string | null, createsReviewItem: boolean): Promise<void>;
    delete(id: string): Promise<void>;
  };
  reviewQueue: {
    getBySong(songId: string): Promise<ReviewQueueItem[]>;
    create(songId: string, type: string, message: string, targetId: string | null): Promise<ReviewQueueItem>;
    resolve(id: string): Promise<void>;
    ignore(id: string): Promise<void>;
  };
}

declare global {
  interface Window {
    songwriterAPI: SongwriterAPI;
  }
}
