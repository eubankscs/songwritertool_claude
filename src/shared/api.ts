import type { Project, Song } from './schema';

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
  };
}

declare global {
  interface Window {
    songwriterAPI: SongwriterAPI;
  }
}
