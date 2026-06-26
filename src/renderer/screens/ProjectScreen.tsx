import React, { useState } from 'react';
import { colors, s } from '../styles';
import { useProjectData } from '../hooks/useProjectData';
import { InputDialog } from '../components/Dialog';

interface Props {
  projectId: string;
  onBack: () => void;
  onOpenSong: (songId: string) => void;
  onNewSong: (projectId: string) => void;
}

export function ProjectScreen({ projectId, onBack, onOpenSong, onNewSong }: Props): React.ReactElement {
  const { project, songs, loading, refresh } = useProjectData(projectId);
  const [showNewSong, setShowNewSong] = useState(false);
  const [newSongError, setNewSongError] = useState('');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const handleCreateSong = async (title: string) => {
    try {
      const song = await window.songwriterAPI.songs.create(title, projectId);
      setShowNewSong(false);
      setNewSongError('');
      onNewSong(song.id);
    } catch (e: unknown) {
      setNewSongError((e as Error).message);
    }
  };

  const handleNewUntitled = async () => {
    const title = await window.songwriterAPI.songs.getNextUntitledName();
    const song = await window.songwriterAPI.songs.create(title, projectId);
    onNewSong(song.id);
  };

  if (loading) {
    return (
      <div style={{ ...s.screen, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: colors.textSecondary }}>Loading…</span>
      </div>
    );
  }

  return (
    <div style={s.screen}>
      <div style={s.container}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span
            style={{ color: colors.accent, cursor: 'pointer', fontSize: '13px' }}
            onClick={onBack}
          >
            ← Home
          </span>
          <span style={{ color: colors.textSecondary }}>/</span>
          <span style={{ fontWeight: 600, color: colors.text }}>{project?.name ?? '…'}</span>
        </div>

        {/* + New Song */}
        <div
          style={{ ...s.actionText, marginBottom: '8px' }}
          onClick={handleNewUntitled}
          onMouseEnter={e => (e.currentTarget.style.background = colors.surfaceHover)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          + New Song
        </div>

        {/* Song list */}
        {songs.length === 0 ? (
          <div style={{ color: colors.textSecondary, fontSize: '13px', padding: '12px' }}>
            No songs yet.
          </div>
        ) : (
          songs.map(song => (
            <div
              key={song.id}
              style={{
                ...s.row,
                background: hoveredRow === song.id ? colors.surfaceHover : 'transparent',
                justifyContent: 'space-between',
              }}
              onClick={() => onOpenSong(song.id)}
              onMouseEnter={() => setHoveredRow(song.id)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <div style={s.primaryText}>{song.title}</div>
              <span style={{ color: colors.textSecondary, fontSize: '16px' }}>›</span>
            </div>
          ))
        )}
      </div>

      {showNewSong && (
        <InputDialog
          title="New Song"
          placeholder="Song title"
          confirmLabel="Create"
          onConfirm={handleCreateSong}
          onCancel={() => { setShowNewSong(false); setNewSongError(''); }}
          error={newSongError}
        />
      )}
    </div>
  );
}
