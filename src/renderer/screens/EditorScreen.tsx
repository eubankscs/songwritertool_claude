import React, { useEffect, useState } from 'react';
import { colors, s } from '../styles';
import type { Song } from '../../shared/schema';

interface Props {
  songId: string;
  onBack: () => void;
}

export function EditorScreen({ songId, onBack }: Props): React.ReactElement {
  const [song, setSong] = useState<Song | null>(null);

  useEffect(() => {
    window.songwriterAPI.songs.touchLastOpened(songId);
    setSong({ id: songId, title: '…', projectId: '', createdOn: null, updatedOn: null, lastOpenedOn: null, deletedOn: null, originalProjectId: null });
  }, [songId]);

  return (
    <div style={{ ...s.screen, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderBottom: `1px solid ${colors.border}`,
        background: colors.surface,
      }}>
        <span style={{ fontSize: '18px', cursor: 'pointer', color: colors.textSecondary }} onClick={onBack}>☰</span>
        <span style={{ fontWeight: 600, color: colors.text }}>{song?.title ?? '…'}</span>
      </div>

      {/* Canvas — placeholder for Phase 3 */}
      <div style={{
        flex: 1,
        padding: '24px 16px',
        color: colors.textSecondary,
        fontSize: '13px',
      }}>
        Editor canvas — Phase 3
      </div>
    </div>
  );
}
