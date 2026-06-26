import React, { useState } from 'react';
import { colors, s } from '../styles';
import { useHomeData } from '../hooks/useHomeData';
import { ContextMenu, type ContextMenuItem } from '../components/ContextMenu';
import { InputDialog, ConfirmDialog, DeleteProjectDialog } from '../components/Dialog';
import type { Project } from '../../shared/schema';

interface Props {
  onOpenSong: (songId: string) => void;
  onOpenProject: (projectId: string) => void;
  onViewAllProjects: () => void;
  onNewSong: (projectId: string) => void;
}

type DialogState =
  | { type: 'none' }
  | { type: 'createProject' }
  | { type: 'renameProject'; project: Project }
  | { type: 'deleteProject'; project: Project }
  | { type: 'error'; message: string };

interface CtxMenu {
  x: number;
  y: number;
  project: Project;
}

const COLLAPSE_THRESHOLD = 6;
const SHOW_COUNT = 4;

export function HomeScreen({ onOpenSong, onOpenProject, onViewAllProjects, onNewSong }: Props): React.ReactElement {
  const { recentSongs, userProjects, unassigned, deletedSongs, loading, refresh } = useHomeData();
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [dialogError, setDialogError] = useState('');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const handleNewSong = async () => {
    if (!unassigned) return;
    const title = await window.songwriterAPI.songs.getNextUntitledName();
    const song = await window.songwriterAPI.songs.create(title, unassigned.id);
    onNewSong(song.id);
  };

  const handleCreateProject = async (name: string) => {
    try {
      await window.songwriterAPI.projects.create(name);
      setDialog({ type: 'none' });
      setDialogError('');
      refresh();
    } catch (e: unknown) {
      setDialogError((e as Error).message);
    }
  };

  const handleRenameProject = async (name: string) => {
    if (dialog.type !== 'renameProject') return;
    try {
      await window.songwriterAPI.projects.rename(dialog.project.id, name);
      setDialog({ type: 'none' });
      setDialogError('');
      refresh();
    } catch (e: unknown) {
      setDialogError((e as Error).message);
    }
  };

  const handleDeleteProject = async (moveSongs: boolean) => {
    if (dialog.type !== 'deleteProject') return;
    await window.songwriterAPI.projects.delete(dialog.project.id, moveSongs);
    setDialog({ type: 'none' });
    refresh();
  };

  const openContextMenu = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, project });
  };

  const ctxMenuItems = (project: Project): ContextMenuItem[] => [
    { label: 'Rename', onClick: () => { setDialogError(''); setDialog({ type: 'renameProject', project }); } },
    { label: 'Delete', danger: true, onClick: () => setDialog({ type: 'deleteProject', project }) },
  ];

  const openProject = async (project: Project) => {
    await window.songwriterAPI.projects.touchLastUsed(project.id);
    onOpenProject(project.id);
  };

  const displayedProjects = userProjects.length >= COLLAPSE_THRESHOLD
    ? userProjects.slice(0, SHOW_COUNT)
    : userProjects;
  const showViewAll = userProjects.length >= COLLAPSE_THRESHOLD;

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

        {/* + New Song */}
        <div
          style={{ ...s.actionText, marginBottom: '8px' }}
          onClick={handleNewSong}
          onMouseEnter={e => (e.currentTarget.style.background = colors.surfaceHover)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          + New Song
        </div>

        {/* Recent Songs */}
        {recentSongs.length > 0 && (
          <>
            <div style={s.sectionLabel}>Recent Songs</div>
            {recentSongs.map(song => (
              <div
                key={song.id}
                style={{
                  ...s.row,
                  background: hoveredRow === song.id ? colors.surfaceHover : 'transparent',
                }}
                onClick={() => onOpenSong(song.id)}
                onMouseEnter={() => setHoveredRow(song.id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <div style={{ flex: 1 }}>
                  <div style={s.primaryText}>{song.title}</div>
                  <div style={s.secondaryText}>{song.containerName}</div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Projects */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={s.sectionLabel}>Projects</div>
          <div
            style={{ fontSize: '12px', color: colors.accent, cursor: 'pointer', marginTop: '20px' }}
            onClick={() => { setDialogError(''); setDialog({ type: 'createProject' }); }}
          >
            + New Project
          </div>
        </div>

        {displayedProjects.map(project => (
          <div
            key={project.id}
            style={{
              ...s.row,
              background: hoveredRow === project.id ? colors.surfaceHover : 'transparent',
              justifyContent: 'space-between',
            }}
            onClick={() => openProject(project)}
            onContextMenu={e => openContextMenu(e, project)}
            onMouseEnter={() => setHoveredRow(project.id)}
            onMouseLeave={() => setHoveredRow(null)}
          >
            <div style={{ flex: 1 }}>
              <div style={s.primaryText}>{project.name}</div>
              <SongCount projectId={project.id} />
            </div>
            <span style={{ color: colors.textSecondary, fontSize: '16px' }}>›</span>
          </div>
        ))}

        {showViewAll && (
          <div
            style={{
              ...s.row,
              color: colors.accent,
              background: hoveredRow === '__viewall' ? colors.surfaceHover : 'transparent',
              fontWeight: 500,
            }}
            onClick={onViewAllProjects}
            onMouseEnter={() => setHoveredRow('__viewall')}
            onMouseLeave={() => setHoveredRow(null)}
          >
            View All Projects
          </div>
        )}

        {/* Unassigned Songs */}
        {unassigned && (
          <div
            style={{
              ...s.row,
              justifyContent: 'space-between',
              background: hoveredRow === unassigned.id ? colors.surfaceHover : 'transparent',
            }}
            onClick={() => openProject(unassigned)}
            onMouseEnter={() => setHoveredRow(unassigned.id)}
            onMouseLeave={() => setHoveredRow(null)}
          >
            <div style={{ flex: 1 }}>
              <div style={s.primaryText}>{unassigned.name}</div>
              <SongCount projectId={unassigned.id} />
            </div>
            <span style={{ color: colors.textSecondary, fontSize: '16px' }}>›</span>
          </div>
        )}

        {/* Recently Deleted — only when non-empty */}
        {deletedSongs.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            <div
              style={{
                ...s.row,
                background: hoveredRow === '__deleted' ? colors.surfaceHover : 'transparent',
                color: colors.textSecondary,
                fontSize: '13px',
              }}
              onMouseEnter={() => setHoveredRow('__deleted')}
              onMouseLeave={() => setHoveredRow(null)}
            >
              Recently Deleted ({deletedSongs.length})
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenuItems(ctxMenu.project)}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* Dialogs */}
      {dialog.type === 'createProject' && (
        <InputDialog
          title="New Project"
          placeholder="Project name"
          confirmLabel="Create"
          onConfirm={handleCreateProject}
          onCancel={() => { setDialog({ type: 'none' }); setDialogError(''); }}
          error={dialogError}
        />
      )}
      {dialog.type === 'renameProject' && (
        <InputDialog
          title="Rename Project"
          initialValue={dialog.project.name}
          confirmLabel="Rename"
          onConfirm={handleRenameProject}
          onCancel={() => { setDialog({ type: 'none' }); setDialogError(''); }}
          error={dialogError}
        />
      )}
      {dialog.type === 'deleteProject' && (
        <DeleteProjectDialog
          projectName={dialog.project.name}
          onMoveSongs={() => handleDeleteProject(true)}
          onDeleteSongs={() => handleDeleteProject(false)}
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
