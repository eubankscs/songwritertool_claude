// Shared TypeScript types matching the database schema exactly.

export interface Project {
  id: string;
  name: string;
  createdOn: string | null;
  lastUsedOn: string | null;
  isSystemProject: boolean;
}

export interface Song {
  id: string;
  title: string;
  projectId: string;
  createdOn: string | null;
  updatedOn: string | null;
  lastOpenedOn: string | null;
  deletedOn: string | null;
  originalProjectId: string | null;
}

export type VersionType = 'saved' | 'working';

export interface SongVersion {
  id: string;
  songId: string;
  type: VersionType;
  capo: number | null;
  concertKey: string | null;
}

export type ContentBlockType = 'section' | 'lyricLine' | 'chordLine' | 'arrangementMarker';

export interface ContentBlock {
  id: string;
  versionId: string;
  type: ContentBlockType;
  content: string | null;
  position: number;
}

export type ArrangementMarkerDisplayMode = 'inline' | 'standalone';

export interface ArrangementMarker {
  id: string;
  versionId: string;
  targetPosition: string;
  displayMode: ArrangementMarkerDisplayMode;
  text: string;
}

export type NoteType = 'line' | 'section' | 'song';

export interface Note {
  id: string;
  songId: string;
  noteType: NoteType;
  targetId: string | null;
  body: string;
}

export interface Annotation {
  id: string;
  songId: string;
  targetRange: string;
  body: string;
  tagId: string | null;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  createsReviewItem: boolean;
}

export interface ReviewQueueItem {
  id: string;
  songId: string;
  targetId: string | null;
  type: string;
  message: string;
  createdOn: string | null;
  ignoredOn: string | null;
  resolvedOn: string | null;
}
