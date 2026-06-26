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
    persistWorkingSync: (payload: unknown) => ipcRenderer.sendSync('songs:persistWorkingSync', payload),
  },
  songVersions: {
    getBySong: (songId: string) => ipcRenderer.invoke('songVersions:getBySong', songId),
    upsertWorking: (songId: string) => ipcRenderer.invoke('songVersions:upsertWorking', songId),
    upsertSaved: (songId: string) => ipcRenderer.invoke('songVersions:upsertSaved', songId),
    deleteWorking: (songId: string) => ipcRenderer.invoke('songVersions:deleteWorking', songId),
    updateMeta: (versionId: string, capo: number | null, concertKey: string | null) =>
      ipcRenderer.invoke('songVersions:updateMeta', versionId, capo, concertKey),
  },
  contentBlocks: {
    getByVersion: (versionId: string) => ipcRenderer.invoke('contentBlocks:getByVersion', versionId),
    replaceAll: (
      versionId: string,
      blocks: Array<{ type: string; content: string | null; position: number }>
    ) => ipcRenderer.invoke('contentBlocks:replaceAll', versionId, blocks),
  },
  arrangementMarkers: {
    getByVersion: (versionId: string) => ipcRenderer.invoke('arrangementMarkers:getByVersion', versionId),
    replaceAll: (
      versionId: string,
      markers: Array<{ targetPosition: string; displayMode: string; text: string }>
    ) => ipcRenderer.invoke('arrangementMarkers:replaceAll', versionId, markers),
  },
  notes: {
    getBySong: (songId: string) => ipcRenderer.invoke('notes:getBySong', songId),
    create: (songId: string, noteType: string, body: string, targetId: string | null) =>
      ipcRenderer.invoke('notes:create', songId, noteType, body, targetId),
    update: (id: string, body: string) => ipcRenderer.invoke('notes:update', id, body),
    delete: (id: string) => ipcRenderer.invoke('notes:delete', id),
  },
  annotations: {
    getBySong: (songId: string) => ipcRenderer.invoke('annotations:getBySong', songId),
    getByRange: (songId: string, targetRange: string) =>
      ipcRenderer.invoke('annotations:getByRange', songId, targetRange),
    create: (songId: string, targetRange: string, body: string, tagId: string | null) =>
      ipcRenderer.invoke('annotations:create', songId, targetRange, body, tagId),
    update: (id: string, body: string, tagId: string | null) =>
      ipcRenderer.invoke('annotations:update', id, body, tagId),
    delete: (id: string) => ipcRenderer.invoke('annotations:delete', id),
  },
  tags: {
    getAll: () => ipcRenderer.invoke('tags:getAll'),
    create: (name: string, color: string | null, createsReviewItem: boolean) =>
      ipcRenderer.invoke('tags:create', name, color, createsReviewItem),
    update: (id: string, name: string, color: string | null, createsReviewItem: boolean) =>
      ipcRenderer.invoke('tags:update', id, name, color, createsReviewItem),
    delete: (id: string) => ipcRenderer.invoke('tags:delete', id),
  },
  reviewQueue: {
    getBySong: (songId: string) => ipcRenderer.invoke('reviewQueue:getBySong', songId),
    create: (songId: string, type: string, message: string, targetId: string | null) =>
      ipcRenderer.invoke('reviewQueue:create', songId, type, message, targetId),
    resolve: (id: string) => ipcRenderer.invoke('reviewQueue:resolve', id),
    ignore: (id: string) => ipcRenderer.invoke('reviewQueue:ignore', id),
  },
});
