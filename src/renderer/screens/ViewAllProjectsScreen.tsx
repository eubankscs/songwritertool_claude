import React, { useState, useEffect } from 'react';
import { colors, s } from '../styles';
import { ContextMenu, type ContextMenuItem } from '../components/ContextMenu';
import { InputDialog, DeleteProjectDialog } from '../components/Dialog';
import type { Project } from '../../shared/schema';

interface Props {
  onBack: () => void;
  onOpenProject: (projectId: string) => void;
}

interface CtxMenu { x: number; y: number; project: Project; }

export function ViewAllProjectsScreen({ onBack, onOpenProject }: Props): React.ReactElement {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [dialog, setDialog] = useState<
    { type: 'none' } |
    { type: 'rename'; project: Project } |
    { type: 'delete'; project: Project }
  >({ type: 'none' });
  const [dialogError, setDialogError] = useState('');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const all = await window.songwriterAPI.projects.getUserProjects();
    setProjects(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleRename = async (name: string) => {
    if (dialog.type !== 'rename') return;
    try {
      await window.songwriterAPI.projects.rename(dialog.project.id, name);
      setDialog({ type: 'none' });
      setDialogError('');
      load();
    } catch (e: unknown) {
      setDialogError((e as Error).message);
    }
  };

  const handleDelete = async (moveSongs: boolean) => {
    if (dialog.type !== 'delete') return;
    await window.songwriterAPI.projects.delete(dialog.project.id, moveSongs);
    setDialog({ type: 'none' });
    load();
  };

  const ctxItems = (project: Project): ContextMenuItem[] => [
    { label: 'Rename', onClick: () => { setDialogError(''); setDialog({ type: 'rename', project }); } },
    { label: 'Delete', danger: true, onClick: () => setDialog({ type: 'delete', project }) },
  ];

  const openProject = async (project: Project) => {
    await window.songwriterAPI.projects.touchLastUsed(project.id);
    onOpenProject(project.id);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <span style={{ color: colors.accent, cursor: 'pointer', fontSize: '13px' }} onClick={onBack}>
            ← Home
          </span>
          <span style={{ color: colors.textSecondary }}>/</span>
          <span style={{ fontWeight: 600, color: colors.text }}>All Projects</span>
        </div>

        {projects.length === 0 ? (
          <div style={{ color: colors.textSecondary, fontSize: '13px', padding: '12px' }}>
            No projects yet.
          </div>
        ) : (
          projects.map(project => (
            <div
              key={project.id}
              style={{
                ...s.row,
                background: hoveredRow === project.id ? colors.surfaceHover : 'transparent',
                justifyContent: 'space-between',
              }}
              onClick={() => openProject(project)}
              onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, project }); }}
              onMouseEnter={() => setHoveredRow(project.id)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <div style={{ flex: 1 }}>
                <div style={s.primaryText}>{project.name}</div>
                <SongCount projectId={project.id} />
              </div>
              <span style={{ color: colors.textSecondary, fontSize: '16px' }}>›</span>
            </div>
          ))
        )}
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          items={ctxItems(ctxMenu.project)}
          onClose={() => setCtxMenu(null)}
        />
      )}
      {dialog.type === 'rename' && (
        <InputDialog
          title="Rename Project"
          initialValue={dialog.project.name}
          confirmLabel="Rename"
          onConfirm={handleRename}
          onCancel={() => { setDialog({ type: 'none' }); setDialogError(''); }}
          error={dialogError}
        />
      )}
      {dialog.type === 'delete' && (
        <DeleteProjectDialog
          projectName={dialog.project.name}
          onMoveSongs={() => handleDelete(true)}
          onDeleteSongs={() => handleDelete(false)}
          onCancel={() => setDialog({ type: 'none' })}
        />
      )}
    </div>
  );
}

function SongCount({ projectId }: { projectId: string }): React.ReactElement {
  const [count, setCount] = React.useState<number | null>(null);
  React.useEffect(() => {
    window.songwriterAPI.projects.getSongCount(projectId).then(setCount);
  }, [projectId]);
  if (count === null) return <></>;
  return <div style={{ fontSize: '12px', color: '#888', marginTop: '1px' }}>{count} {count === 1 ? 'song' : 'songs'}</div>;
}
