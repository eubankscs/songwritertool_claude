import type { Project, Song, SongVersion, ContentBlock, ContentBlockType, ArrangementMarker } from './schema';

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
    create(title: string, projectId: string): Promise<Song>;
    rename(id: string, title: string): Promise<void>;
    getNextUntitledName(): Promise<string>;
    softDelete(id: string): Promise<void>;
    touchLastOpened(id: string): Promise<void>;
    getById(id: string): Promise<Song | undefined>;
    persistWorkingSync(payload: PersistWorkingSyncPayload): { success: boolean; versionId?: string };
  };
  songVersions: {
    getBySong(songId: string): Promise<SongVersion[]>;
    upsertWorking(songId: string): Promise<SongVersion>;
    upsertSaved(songId: string): Promise<SongVersion>;
    deleteWorking(songId: string): Promise<void>;
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
}

declare global {
  interface Window {
    songwriterAPI: SongwriterAPI;
  }
}
