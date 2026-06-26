import React, { useState } from 'react';
import type { Tag } from '../../shared/schema';
import { colors } from '../styles';

interface Props {
  tags: Tag[];
  onClose: () => void;
  onTagsChanged: () => void;
}

const SWATCH_COLORS = [
  '#e06c75', '#e5c07b', '#98c379', '#61afef',
  '#c678dd', '#56b6c2', '#d19a66', '#abb2bf',
];

export function ManageTagsModal({ tags, onClose, onTagsChanged }: Props): React.ReactElement {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<string | null>(null);
  const [editCreatesReview, setEditCreatesReview] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  function startEdit(tag: Tag) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setEditCreatesReview(!!tag.createsReviewItem);
    setError('');
  }

  async function saveEdit() {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed) { setError('Name is required.'); return; }
    await window.songwriterAPI.tags.update(editingId, trimmed, editColor, editCreatesReview);
    setEditingId(null);
    setError('');
    onTagsChanged();
  }

  async function createTag() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await window.songwriterAPI.tags.create(trimmed, null, false);
    setNewName('');
    onTagsChanged();
  }

  async function deleteTag(id: string) {
    await window.songwriterAPI.tags.delete(id);
    if (editingId === id) setEditingId(null);
    onTagsChanged();
  }

  const inputStyle: React.CSSProperties = {
    background: colors.bg, border: `1px solid ${colors.border}`,
    color: colors.text, fontSize: '13px', padding: '5px 8px',
    borderRadius: '3px', outline: 'none', width: '100%', boxSizing: 'border-box',
  };
  const btnPrimary: React.CSSProperties = {
    background: colors.accent, border: 'none', color: '#fff',
    fontSize: '12px', cursor: 'pointer', padding: '4px 12px', borderRadius: '3px',
  };
  const btnGhost: React.CSSProperties = {
    background: 'transparent', border: `1px solid ${colors.border}`,
    color: colors.textSecondary, fontSize: '12px', cursor: 'pointer',
    padding: '4px 10px', borderRadius: '3px',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '20px 24px', width: '380px', maxWidth: '92vw', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontWeight: 600, color: colors.text, fontSize: '14px' }}>Manage Tags</span>
          <span onClick={onClose} style={{ color: colors.textSecondary, cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>✕</span>
        </div>

        {tags.length === 0 && (
          <div style={{ color: colors.textSecondary, fontSize: '13px', marginBottom: '12px' }}>No tags yet.</div>
        )}
        {tags.map(tag => (
          <div key={tag.id} style={{ borderBottom: `1px solid ${colors.border}`, paddingBottom: '10px', marginBottom: '10px' }}>
            {editingId === tag.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Tag name"
                  style={inputStyle}
                />
                {error && <div style={{ color: colors.danger, fontSize: '11px' }}>{error}</div>}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span
                    onClick={() => setEditColor(null)}
                    title="No color"
                    style={{ width: 18, height: 18, borderRadius: '50%', background: '#444', cursor: 'pointer', border: editColor === null ? '2px solid #fff' : '2px solid transparent', flexShrink: 0 }}
                  />
                  {SWATCH_COLORS.map(c => (
                    <span
                      key={c}
                      onClick={() => setEditColor(c)}
                      style={{ width: 18, height: 18, borderRadius: '50%', background: c, cursor: 'pointer', border: editColor === c ? '2px solid #fff' : '2px solid transparent', flexShrink: 0 }}
                    />
                  ))}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: colors.textSecondary, fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editCreatesReview}
                    onChange={e => setEditCreatesReview(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Creates Review Queue item when applied
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={saveEdit} style={btnPrimary}>Save</button>
                  <button onClick={() => { setEditingId(null); setError(''); }} style={btnGhost}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {tag.color
                  ? <span style={{ width: 10, height: 10, borderRadius: '50%', background: tag.color, flexShrink: 0 }} />
                  : <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#444', flexShrink: 0 }} />
                }
                <span style={{ color: colors.text, fontSize: '13px', flex: 1 }}>{tag.name}</span>
                {tag.createsReviewItem && (
                  <span style={{ color: colors.textSecondary, fontSize: '10px', border: `1px solid ${colors.border}`, borderRadius: '3px', padding: '0 4px' }}>RQ</span>
                )}
                <span onClick={() => startEdit(tag)} style={{ color: colors.accent, fontSize: '11px', cursor: 'pointer' }}>Edit</span>
                <span onClick={() => deleteTag(tag.id)} style={{ color: colors.danger, fontSize: '11px', cursor: 'pointer' }}>Delete</span>
              </div>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createTag(); }}
            placeholder="New tag name…"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={createTag} style={{ ...btnPrimary, padding: '5px 14px' }}>Add</button>
        </div>
      </div>
    </div>
  );
}
