import React, { useState } from 'react';
import { colors, s } from '../styles';
import { useHomeData } from '../hooks/useHomeData';
import { ContextMenu, type ContextMenuItem } from '../components/ContextMenu';
import { InputDialog, ConfirmDialog, DeleteProjectDialog } from '../components/Dialog';
import type { Project, Song } from '../../shared/schema';

interface Props {
  onOpenSong: (songId: string) => void;
  onOpenProject: (projectId: string) => void;
  onViewAllProjects: () => void;
  onNewSong: (projectId: string) => void;
  onOpenSongView: () => void;
}

type DialogState =
  | { type: 'none' }
  | { type: 'createProject' }
  | { type: 'renameProject'; project: Project }
  | { type: 'deleteProject'; project: Project }
  | { type: 'confirmPermanentDelete'; song: Song }
  | { type: 'confirmEmptyAll' }
  | { type: 'renameForRestore'; song: Song; targetProjectId: string; hasBoth: boolean }
  | { type: 'chooseRestoreMode'; song: Song; targetProjectId: string }
  | { type: 'renameForVariant'; song: Song; targetProjectId: string }
  | { type: 'error'; message: string };

interface CtxMenu {
  x: number;
  y: number;
  project: Project;
}

const COLLAPSE_THRESHOLD = 6;
const SHOW_COUNT = 4;

export function HomeScreen({ onOpenSong, onOpenProject, onViewAllProjects, onNewSong, onOpenSongView }: Props): React.ReactElement {
  const { recentSongs, userProjects, unassigned, deletedSongs, loading, refresh } = useHomeData();
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [dialogError, setDialogError] = useState('');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [expandedDeletedId, setExpandedDeletedId] = useState<string | null>(null);
  const [deletedExpanded, setDeletedExpanded] = useState(false);

  React.useEffect(() => {
    window.songwriterAPI.songs.purgeOldDeleted().then(refresh);
  }, []);

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

  const handlePermanentDelete = async (song: Song) => {
    await window.songwriterAPI.songs.permanentlyDelete(song.id);
    setExpandedDeletedId(null);
    refresh();
  };

  const handleEmptyAll = async () => {
    for (const song of deletedSongs) {
      await window.songwriterAPI.songs.permanentlyDelete(song.id);
    }
    setDeletedExpanded(false);
    setExpandedDeletedId(null);
    refresh();
  };

  async function beginRestore(song: Song) {
    const allProjects = await window.songwriterAPI.projects.getAll();
    const originalProject = song.originalProjectId
      ? allProjects.find(p => p.id === song.originalProjectId)
      : null;
    const ua = await window.songwriterAPI.projects.getUnassigned();
    const targetProjectId = originalProject ? originalProject.id : ua.id;

    const collides = await window.songwriterAPI.songs.checkTitleInProject(song.title, targetProjectId, song.id);

    const versions = await window.songwriterAPI.songVersions.getBySong(song.id);
    const hasWorking = versions.some(v => v.type === 'working');
    const hasSaved = versions.some(v => v.type === 'saved');
    const hasBoth = hasWorking && hasSaved;

    if (collides) {
      setDialog({ type: 'renameForRestore', song, targetProjectId, hasBoth });
      setDialogError('');
    } else if (hasBoth) {
      setDialog({ type: 'chooseRestoreMode', song, targetProjectId });
    } else {
      await window.songwriterAPI.songs.restorePermanent(song.id, targetProjectId);
      refresh();
      onOpenSong(song.id);
    }
  }

  async function handleRenameForRestore(newTitle: string) {
    if (dialog.type !== 'renameForRestore') return;
    const { song, targetProjectId, hasBoth } = dialog;
    const trimmed = newTitle.trim();
    if (!trimmed) { setDialogError('Title is required.'); return; }

    const stillCollides = await window.songwriterAPI.songs.checkTitleInProject(trimmed, targetProjectId, song.id);
    if (stillCollides) { setDialogError(`"${trimmed}" already exists in that project.`); return; }

    await window.songwriterAPI.songs.rename(song.id, trimmed);

    if (hasBoth) {
      setDialog({ type: 'chooseRestoreMode', song: { ...song, title: trimmed }, targetProjectId });
    } else {
      await window.songwriterAPI.songs.restorePermanent(song.id, targetProjectId);
      setDialog({ type: 'none' });
      refresh();
      onOpenSong(song.id);
    }
  }

  async function handleRestoreAsPermanent() {
    if (dialog.type !== 'chooseRestoreMode') return;
    const { song, targetProjectId } = dialog;
    await window.songwriterAPI.songs.restorePermanent(song.id, targetProjectId);
    setDialog({ type: 'none' });
    refresh();
    onOpenSong(song.id);
  }

  async function beginRestoreAsVariant() {
    if (dialog.type !== 'chooseRestoreMode') return;
    const { song, targetProjectId } = dialog;
    setDialog({ type: 'renameForVariant', song, targetProjectId });
    setDialogError('');
  }

  async function handleRestoreAsVariant(variantTitle: string) {
    if (dialog.type !== 'renameForVariant') return;
    const { song, targetProjectId } = dialog;
    const trimmed = variantTitle.trim();
    if (!trimmed) { setDialogError('Title is required.'); return; }

    const collides = await window.songwriterAPI.songs.checkTitleInProject(trimmed, targetProjectId);
    if (collides) { setDialogError(`"${trimmed}" already exists in that project.`); return; }

    await window.songwriterAPI.songs.restoreAsVariant(song.id, trimmed, targetProjectId);
    setDialog({ type: 'none' });
    refresh();
    onOpenSong(song.id);
  }

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

        {/* Open Song */}
        <div
          style={{ ...s.actionText, marginBottom: '8px' }}
          onClick={onOpenSongView}
          onMouseEnter={e => (e.currentTarget.style.background = colors.surfaceHover)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          Open Song…
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
                cursor: 'pointer',
                background: hoveredRow === '__deleted' ? colors.surfaceHover : 'transparent',
                color: colors.textSecondary,
                fontSize: '13px',
                justifyContent: 'space-between',
              }}
              onClick={() => setDeletedExpanded(x => !x)}
              onMouseEnter={() => setHoveredRow('__deleted')}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <span>Recently Deleted ({deletedSongs.length})</span>
              <span style={{ fontSize: '11px' }}>{deletedExpanded ? '▲' : '▼'}</span>
            </div>

            {deletedExpanded && (
              <div style={{ marginLeft: '8px' }}>
                {deletedSongs.map(song => (
                  <div key={song.id} style={{ borderBottom: `1px solid ${colors.border}`, paddingBottom: '8px', marginBottom: '8px' }}>
                    <div
                      style={{ ...s.row, cursor: 'pointer', background: expandedDeletedId === song.id ? colors.surfaceHover : 'transparent' }}
                      onClick={() => setExpandedDeletedId(id => id === song.id ? null : song.id)}
                    >
                      <span style={s.primaryText}>{song.title}</span>
                    </div>
                    {expandedDeletedId === song.id && (
                      <div style={{ display: 'flex', gap: '10px', paddingLeft: '8px', marginTop: '4px' }}>
                        <span
                          style={{ color: colors.accent, fontSize: '12px', cursor: 'pointer' }}
                          onClick={() => beginRestore(song)}
                        >Restore</span>
                        <span
                          style={{ color: colors.danger, fontSize: '12px', cursor: 'pointer' }}
                          onClick={() => setDialog({ type: 'confirmPermanentDelete', song })}
                        >Delete Permanently</span>
                      </div>
                    )}
                  </div>
                ))}
                <div
                  style={{ color: colors.danger, fontSize: '12px', cursor: 'pointer', padding: '4px 0' }}
                  onClick={() => setDialog({ type: 'confirmEmptyAll' })}
                >Empty Recently Deleted…</div>
              </div>
            )}
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
      {dialog.type === 'confirmPermanentDelete' && (
        <ConfirmDialog
          title="Delete Permanently"
          message={`"${dialog.song.title}" will be permanently deleted and cannot be recovered.`}
          confirmLabel="Delete Permanently"
          danger
          onConfirm={() => { handlePermanentDelete(dialog.song); setDialog({ type: 'none' }); }}
          onCancel={() => setDialog({ type: 'none' })}
        />
      )}
      {dialog.type === 'confirmEmptyAll' && (
        <ConfirmDialog
          title="Empty Recently Deleted"
          message="All deleted songs will be permanently removed. This cannot be undone."
          confirmLabel="Empty All"
          danger
          onConfirm={() => { handleEmptyAll(); setDialog({ type: 'none' }); }}
          onCancel={() => setDialog({ type: 'none' })}
        />
      )}
      {dialog.type === 'renameForRestore' && (
        <InputDialog
          title="Song Already Exists"
          placeholder="New title"
          initialValue={dialog.song.title}
          confirmLabel="Rename & Restore"
          onConfirm={handleRenameForRestore}
          onCancel={() => setDialog({ type: 'none' })}
          error={dialogError}
        />
      )}
      {dialog.type === 'chooseRestoreMode' && (
        <RestoreModeDialog
          songTitle={dialog.song.title}
          onPermanent={handleRestoreAsPermanent}
          onVariant={beginRestoreAsVariant}
          onCancel={() => setDialog({ type: 'none' })}
        />
      )}
      {dialog.type === 'renameForVariant' && (
        <InputDialog
          title="Save Working Copy as Variant"
          placeholder="Variant title"
          confirmLabel="Restore as Variant"
          onConfirm={handleRestoreAsVariant}
          onCancel={() => setDialog({ type: 'none' })}
          error={dialogError}
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

function RestoreModeDialog({ songTitle, onPermanent, onVariant, onCancel }: {
  songTitle: string;
  onPermanent: () => void;
  onVariant: () => void;
  onCancel: () => void;
}): React.ReactElement {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '20px 24px', width: '360px', maxWidth: '92vw' }}>
        <div style={{ fontWeight: 600, color: colors.text, fontSize: '14px', marginBottom: '8px' }}>Restore "{songTitle}"</div>
        <div style={{ color: colors.textSecondary, fontSize: '13px', marginBottom: '16px' }}>
          This song has both a saved version and unsaved working changes. How would you like to restore it?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={onPermanent}
            style={{ background: colors.accent, border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer', padding: '8px 14px', borderRadius: '4px', textAlign: 'left' }}
          >
            Restore (apply working changes to saved version)
          </button>
          <button
            onClick={onVariant}
            style={{ background: 'transparent', border: `1px solid ${colors.border}`, color: colors.text, fontSize: '13px', cursor: 'pointer', padding: '8px 14px', borderRadius: '4px', textAlign: 'left' }}
          >
            Restore as Variant (keep both versions as separate songs)
          </button>
          <button
            onClick={onCancel}
            style={{ background: 'transparent', border: 'none', color: colors.textSecondary, fontSize: '12px', cursor: 'pointer', padding: '4px 0', textAlign: 'left' }}
          >Cancel</button>
        </div>
      </div>
    </div>
  );
}
