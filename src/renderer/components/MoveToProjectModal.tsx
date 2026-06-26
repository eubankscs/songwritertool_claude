import React, { useEffect, useState } from 'react';
import { colors } from '../styles';
import type { Project } from '../../shared/schema';

interface Props {
  songId: string;
  songTitle: string;
  currentProjectId: string;
  onClose: () => void;
  onMoved: () => void;
}

export function MoveToProjectModal({ songId, songTitle, currentProjectId, onClose, onMoved }: Props): React.ReactElement {
  const [projects, setProjects] = useState<Project[]>([]);
  const [unassigned, setUnassigned] = useState<Project | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [collision, setCollision] = useState(false);
  const [newTitle, setNewTitle] = useState(songTitle);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      window.songwriterAPI.projects.getUserProjects(),
      window.songwriterAPI.projects.getUnassigned(),
    ]).then(([user, ua]) => {
      setProjects(user);
      setUnassigned(ua);
    });
  }, []);

  const allProjects: Project[] = [
    ...projects,
    ...(unassigned ? [unassigned] : []),
  ].filter(p => p.id !== currentProjectId);

  async function handleSelect(projectId: string) {
    setSelectedId(projectId);
    setError('');
    const exists = await window.songwriterAPI.songs.checkTitleInProject(songTitle, projectId);
    setCollision(exists);
    if (!exists) setNewTitle(songTitle);
  }

  async function handleMove() {
    if (!selectedId) return;
    const titleToUse = collision ? newTitle.trim() : songTitle;
    if (!titleToUse) { setError('Title is required.'); return; }

    if (collision) {
      const stillCollides = await window.songwriterAPI.songs.checkTitleInProject(titleToUse, selectedId);
      if (stillCollides) { setError(`"${titleToUse}" already exists in that project.`); return; }
      await window.songwriterAPI.songs.rename(songId, titleToUse);
    }

    await window.songwriterAPI.songs.moveToProject(songId, selectedId);
    onMoved();
  }

  const inputStyle: React.CSSProperties = {
    background: colors.bg, border: `1px solid ${colors.border}`,
    color: colors.text, fontSize: '13px', padding: '5px 8px',
    borderRadius: '3px', outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '20px 24px', width: '340px', maxWidth: '92vw' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontWeight: 600, color: colors.text, fontSize: '14px', marginBottom: '12px' }}>Move to Project</div>
        <div style={{ color: colors.textSecondary, fontSize: '12px', marginBottom: '12px' }}>
          "{songTitle}" — select destination:
        </div>

        <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '12px' }}>
          {allProjects.map(p => (
            <div
              key={p.id}
              onClick={() => handleSelect(p.id)}
              style={{
                padding: '8px 10px', borderRadius: '4px', cursor: 'pointer',
                background: selectedId === p.id ? colors.accent + '33' : 'transparent',
                color: selectedId === p.id ? colors.text : colors.textSecondary,
                fontSize: '13px',
                border: selectedId === p.id ? `1px solid ${colors.accent}` : `1px solid transparent`,
                marginBottom: '4px',
              }}
            >{p.name}</div>
          ))}
        </div>

        {collision && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ color: colors.danger, fontSize: '12px', marginBottom: '6px' }}>
              A song with that title already exists there. Choose a new title:
            </div>
            <input
              value={newTitle}
              onChange={e => { setNewTitle(e.target.value); setError(''); }}
              style={inputStyle}
            />
          </div>
        )}

        {error && <div style={{ color: colors.danger, fontSize: '12px', marginBottom: '8px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: `1px solid ${colors.border}`, color: colors.textSecondary, fontSize: '12px', cursor: 'pointer', padding: '5px 14px', borderRadius: '3px' }}
          >Cancel</button>
          <button
            onClick={handleMove}
            disabled={!selectedId}
            style={{ background: selectedId ? colors.accent : '#555', border: 'none', color: '#fff', fontSize: '12px', cursor: selectedId ? 'pointer' : 'default', padding: '5px 14px', borderRadius: '3px' }}
          >Move</button>
        </div>
      </div>
    </div>
  );
}
