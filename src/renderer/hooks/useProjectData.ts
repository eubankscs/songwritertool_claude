import { useState, useEffect, useCallback } from 'react';
import type { Project, Song } from '../../shared/schema';

export interface ProjectData {
  project: Project | null;
  songs: Song[];
  loading: boolean;
  refresh: () => void;
}

export function useProjectData(projectId: string): ProjectData {
  const [project, setProject] = useState<Project | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [allProjects, projectSongs] = await Promise.all([
      window.songwriterAPI.projects.getAll(),
      window.songwriterAPI.songs.getByProject(projectId),
    ]);
    setProject(allProjects.find(p => p.id === projectId) ?? null);
    setSongs(projectSongs);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  return { project, songs, loading, refresh: load };
}
