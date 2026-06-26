import React, { useState } from 'react';
import type { Note, NoteType } from '../../shared/schema';
import { colors } from '../styles';

interface LineContext {
  lineIndex: number;
  content: string;
  isSection: boolean;
}

interface Props {
  songId: string;
  notes: Note[];
  lines: LineContext[];
  focusedLineIndex: number;
  onClose: () => void;
  onNotesChanged: () => void;
}

export function NotesSidePanel({ songId, notes, lines, focusedLineIndex, onClose, onNotesChanged }: Props): React.ReactElement {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [newSongBody, setNewSongBody] = useState('');
  const [newLineBody, setNewLineBody] = useState('');
  const [addingLineNote, setAddingLineNote] = useState(false);

  const songNotes = notes.filter(n => n.noteType === 'song');
  const lineNotes = notes.filter(n => n.noteType !== 'song');

  function startEdit(note: Note) {
    setEditingId(note.id);
    setEditBody(note.body);
  }

  async function saveEdit() {
    if (!editingId) return;
    await window.songwriterAPI.notes.update(editingId, editBody.trim());
    setEditingId(null);
    onNotesChanged();
  }

  async function deleteNote(id: string) {
    await window.songwriterAPI.notes.delete(id);
    if (editingId === id) setEditingId(null);
    onNotesChanged();
  }

  async function addSongNote() {
    const trimmed = newSongBody.trim();
    if (!trimmed) return;
    await window.songwriterAPI.notes.create(songId, 'song', trimmed, null);
    setNewSongBody('');
    onNotesChanged();
  }

  async function addLineNote() {
    const trimmed = newLineBody.trim();
    if (!trimmed) return;
    const ctx = lines[focusedLineIndex];
    if (!ctx) return;
    const noteType: NoteType = ctx.isSection ? 'section' : 'line';
    await window.songwriterAPI.notes.create(songId, noteType, trimmed, String(focusedLineIndex));
    setNewLineBody('');
    setAddingLineNote(false);
    onNotesChanged();
  }

  function getLineContext(note: Note): string {
    const idx = parseInt(note.targetId ?? '');
    if (isNaN(idx)) return '';
    return lines[idx]?.content?.substring(0, 35) ?? '';
  }

  const textareaStyle: React.CSSProperties = {
    background: colors.bg, border: `1px solid ${colors.border}`,
    color: colors.text, fontSize: '12px', padding: '6px 8px',
    borderRadius: '3px', outline: 'none', width: '100%',
    boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
    minHeight: '52px',
  };
  const btnSmall: React.CSSProperties = {
    background: colors.accent, border: 'none', color: '#fff',
    fontSize: '11px', cursor: 'pointer', padding: '3px 10px', borderRadius: '3px',
  };
  const btnGhost: React.CSSProperties = {
    background: 'transparent', border: `1px solid ${colors.border}`,
    color: colors.textSecondary, fontSize: '11px', cursor: 'pointer',
    padding: '3px 8px', borderRadius: '3px',
  };

  const focusedLine = lines[focusedLineIndex];

  return (
    <div style={{
      width: '280px', flexShrink: 0, borderLeft: `1px solid ${colors.border}`,
      background: colors.surface, display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
        <span style={{ fontWeight: 600, fontSize: '12px', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Song Notes</span>
        <span onClick={onClose} style={{ color: colors.textSecondary, cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>✕</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
        <div style={{ color: colors.textSecondary, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Song Note</div>
        {songNotes.map(note => (
          <div key={note.id} style={{ marginBottom: '8px' }}>
            {editingId === note.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <textarea autoFocus value={editBody} onChange={e => setEditBody(e.target.value)} style={textareaStyle} />
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={saveEdit} style={btnSmall}>Save</button>
                  <button onClick={() => setEditingId(null)} style={btnGhost}>Cancel</button>
                  <button onClick={() => deleteNote(note.id)} style={{ ...btnGhost, color: colors.danger, marginLeft: 'auto' }}>Delete</button>
                </div>
              </div>
            ) : (
              <div onClick={() => startEdit(note)} style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '4px', padding: '6px 8px', cursor: 'pointer' }}>
                <div style={{ color: colors.text, fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{note.body}</div>
              </div>
            )}
          </div>
        ))}
        <div style={{ marginBottom: '16px' }}>
          <textarea value={newSongBody} onChange={e => setNewSongBody(e.target.value)} placeholder="Add song note…" style={{ ...textareaStyle, minHeight: '40px' }} />
          {newSongBody.trim() && (
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              <button onClick={addSongNote} style={btnSmall}>Add</button>
              <button onClick={() => setNewSongBody('')} style={btnGhost}>Clear</button>
            </div>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '12px' }}>
          <div style={{ color: colors.textSecondary, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Line & Section Notes</div>
          {lineNotes.length === 0 && (
            <div style={{ color: colors.textSecondary, fontSize: '12px', marginBottom: '8px' }}>No line notes yet.</div>
          )}
          {lineNotes.map(note => {
            const ctx = getLineContext(note);
            return (
              <div key={note.id} style={{ marginBottom: '8px' }}>
                {ctx && (
                  <div style={{ color: colors.textSecondary, fontSize: '10px', marginBottom: '2px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {note.noteType === 'section' ? '§' : '↳'} {ctx}
                  </div>
                )}
                {editingId === note.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <textarea autoFocus value={editBody} onChange={e => setEditBody(e.target.value)} style={textareaStyle} />
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={saveEdit} style={btnSmall}>Save</button>
                      <button onClick={() => setEditingId(null)} style={btnGhost}>Cancel</button>
                      <button onClick={() => deleteNote(note.id)} style={{ ...btnGhost, color: colors.danger, marginLeft: 'auto' }}>Delete</button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => startEdit(note)} style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '4px', padding: '6px 8px', cursor: 'pointer' }}>
                    <div style={{ color: colors.text, fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{note.body}</div>
                  </div>
                )}
              </div>
            );
          })}

          {focusedLine && !addingLineNote && (
            <button onClick={() => setAddingLineNote(true)} style={{ ...btnGhost, fontSize: '11px', width: '100%', textAlign: 'left', padding: '5px 8px' }}>
              + Add note for "{focusedLine.content.substring(0, 20) || '(empty line)'}"
            </button>
          )}
          {addingLineNote && focusedLine && (
            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ color: colors.textSecondary, fontSize: '10px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {focusedLine.isSection ? '§' : '↳'} {focusedLine.content.substring(0, 35) || '(empty line)'}
              </div>
              <textarea autoFocus value={newLineBody} onChange={e => setNewLineBody(e.target.value)} placeholder="Add note…" style={textareaStyle} />
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={addLineNote} style={btnSmall}>Add</button>
                <button onClick={() => { setAddingLineNote(false); setNewLineBody(''); }} style={btnGhost}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
