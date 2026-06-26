import type { Project, Song, SongVersion, ContentBlock, ContentBlockType } from './schema';

export interface RecentSong extends Song {
  containerName: string;
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
  };
  songVersions: {
    getBySong(songId: string): Promise<SongVersion[]>;
    upsertWorking(songId: string): Promise<SongVersion>;
  };
  contentBlocks: {
    getByVersion(versionId: string): Promise<ContentBlock[]>;
    replaceAll(
      versionId: string,
      blocks: Array<{ type: ContentBlockType; content: string | null; position: number }>
    ): Promise<void>;
  };
}

declare global {
  interface Window {
    songwriterAPI: SongwriterAPI;
  }
}
