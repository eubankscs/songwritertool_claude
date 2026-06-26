import React, { useEffect, useState } from 'react';
import { colors, s } from '../styles';
import type { RecentSong } from '../../shared/api';

interface Props {
  onBack: () => void;
  onOpenSong: (songId: string) => void;
}

export function OpenSongScreen({ onBack, onOpenSong }: Props): React.ReactElement {
  const [allSongs, setAllSongs] = useState<RecentSong[]>([]);
  const [query, setQuery] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    window.songwriterAPI.songs.getAllActive().then(setAllSongs);
  }, []);

  const filtered = query.trim()
    ? allSongs.filter(s => s.title.toLowerCase().includes(query.trim().toLowerCase()))
    : allSongs;

  const grouped = new Map<string, RecentSong[]>();
  for (const song of filtered) {
    const key = song.containerName;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(song);
  }

  return (
    <div style={s.screen}>
      <div style={s.container}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span
            style={{ color: colors.accent, fontSize: '13px', cursor: 'pointer' }}
            onClick={onBack}
          >← Back</span>
          <span style={{ fontWeight: 600, color: colors.text, fontSize: '15px' }}>Open Song</span>
        </div>

        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by title…"
          style={{
            background: colors.bg, border: `1px solid ${colors.border}`,
            color: colors.text, fontSize: '13px', padding: '7px 10px',
            borderRadius: '4px', outline: 'none', width: '100%',
            boxSizing: 'border-box', marginBottom: '16px',
          }}
        />

        {filtered.length === 0 && (
          <div style={{ color: colors.textSecondary, fontSize: '13px' }}>No songs found.</div>
        )}

        {Array.from(grouped.entries()).map(([container, songs]) => (
          <div key={container} style={{ marginBottom: '12px' }}>
            <div style={s.sectionLabel}>{container}</div>
            {songs.map(song => (
              <div
                key={song.id}
                style={{
                  ...s.row,
                  background: hoveredId === song.id ? colors.surfaceHover : 'transparent',
                }}
                onClick={() => onOpenSong(song.id)}
                onMouseEnter={() => setHoveredId(song.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <span style={s.primaryText}>{song.title}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
