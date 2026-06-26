import { useState, useEffect, useCallback } from 'react';
import type { Project, Song } from '../../shared/schema';
import type { RecentSong } from '../../shared/api';

export interface HomeData {
  recentSongs: RecentSong[];
  userProjects: Project[];
  unassigned: Project | null;
  deletedSongs: Song[];
  loading: boolean;
  refresh: () => void;
}

export function useHomeData(): HomeData {
  const [recentSongs, setRecentSongs] = useState<RecentSong[]>([]);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [unassigned, setUnassigned] = useState<Project | null>(null);
  const [deletedSongs, setDeletedSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [recent, projects, unassignedProject, deleted] = await Promise.all([
      window.songwriterAPI.songs.getRecentlyOpened(5),
      window.songwriterAPI.projects.getUserProjects(),
      window.songwriterAPI.projects.getUnassigned(),
      window.songwriterAPI.songs.getDeleted(),
    ]);
    setRecentSongs(recent);
    setUserProjects(projects);
    setUnassigned(unassignedProject);
    setDeletedSongs(deleted);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { recentSongs, userProjects, unassigned, deletedSongs, loading, refresh: load };
}
