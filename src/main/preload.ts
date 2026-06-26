import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('songwriterAPI', {
  projects: {
    getAll: () => ipcRenderer.invoke('projects:getAll'),
    getUserProjects: () => ipcRenderer.invoke('projects:getUserProjects'),
    getUnassigned: () => ipcRenderer.invoke('projects:getUnassigned'),
    create: (name: string) => ipcRenderer.invoke('projects:create', name),
    rename: (id: string, name: string) => ipcRenderer.invoke('projects:rename', id, name),
    delete: (id: string, moveSongsToUnassigned: boolean) =>
      ipcRenderer.invoke('projects:delete', id, moveSongsToUnassigned),
    touchLastUsed: (id: string) => ipcRenderer.invoke('projects:touchLastUsed', id),
    getSongCount: (id: string) => ipcRenderer.invoke('projects:getSongCount', id),
  },
  songs: {
    getRecentlyOpened: (limit?: number) => ipcRenderer.invoke('songs:getRecentlyOpened', limit ?? 5),
    getByProject: (projectId: string) => ipcRenderer.invoke('songs:getByProject', projectId),
    getDeleted: () => ipcRenderer.invoke('songs:getDeleted'),
    create: (title: string, projectId: string) => ipcRenderer.invoke('songs:create', title, projectId),
    rename: (id: string, title: string) => ipcRenderer.invoke('songs:rename', id, title),
    getNextUntitledName: () => ipcRenderer.invoke('songs:getNextUntitledName'),
    softDelete: (id: string) => ipcRenderer.invoke('songs:softDelete', id),
    touchLastOpened: (id: string) => ipcRenderer.invoke('songs:touchLastOpened', id),
    getById: (id: string) => ipcRenderer.invoke('songs:getById', id),
  },
  songVersions: {
    getBySong: (songId: string) => ipcRenderer.invoke('songVersions:getBySong', songId),
    upsertWorking: (songId: string) => ipcRenderer.invoke('songVersions:upsertWorking', songId),
  },
  contentBlocks: {
    getByVersion: (versionId: string) => ipcRenderer.invoke('contentBlocks:getByVersion', versionId),
    replaceAll: (
      versionId: string,
      blocks: Array<{ type: string; content: string | null; position: number }>
    ) => ipcRenderer.invoke('contentBlocks:replaceAll', versionId, blocks),
  },
});
