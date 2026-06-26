import React, { useState, useEffect, useRef } from 'react';
import { colors, s } from '../styles';

interface InputDialogProps {
  title: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  error?: string;
}

export function InputDialog({
  title, placeholder, initialValue = '', confirmLabel = 'OK',
  onConfirm, onCancel, error,
}: InputDialogProps): React.ReactElement {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  const submit = () => { if (value.trim()) onConfirm(value.trim()); };

  return (
    <div style={s.modal} onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={s.modalBox}>
        <div style={{ fontWeight: 600, marginBottom: '14px', color: colors.text }}>{title}</div>
        <input
          ref={inputRef}
          style={s.input}
          value={value}
          placeholder={placeholder}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
        />
        {error && (
          <div style={{ color: '#e06c6c', fontSize: '12px', marginTop: '6px' }}>{error}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button
            style={{ ...s.button, background: 'transparent', color: colors.textSecondary }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            style={{ ...s.button, background: colors.accent, color: '#fff' }}
            onClick={submit}
            disabled={!value.trim()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title, message, confirmLabel = 'OK', danger = false, onConfirm, onCancel,
}: ConfirmDialogProps): React.ReactElement {
  return (
    <div style={s.modal} onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={s.modalBox}>
        <div style={{ fontWeight: 600, marginBottom: '10px', color: colors.text }}>{title}</div>
        <div style={{ color: colors.textSecondary, fontSize: '13px', lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button
            style={{ ...s.button, background: 'transparent', color: colors.textSecondary }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            style={{ ...s.button, background: danger ? colors.danger : colors.accent, color: '#fff' }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DeleteProjectDialogProps {
  projectName: string;
  onMoveSongs: () => void;
  onDeleteSongs: () => void;
  onCancel: () => void;
}

export function DeleteProjectDialog({
  projectName, onMoveSongs, onDeleteSongs, onCancel,
}: DeleteProjectDialogProps): React.ReactElement {
  return (
    <div style={s.modal} onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={s.modalBox}>
        <div style={{ fontWeight: 600, marginBottom: '10px', color: colors.text }}>
          Delete "{projectName}"?
        </div>
        <div style={{ color: colors.textSecondary, fontSize: '13px', lineHeight: 1.5, marginBottom: '20px' }}>
          What should happen to the songs in this project?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            style={{ ...s.button, background: colors.surface, color: colors.text, border: `1px solid ${colors.border}`, textAlign: 'left' }}
            onClick={onMoveSongs}
          >
            Move Songs to Unassigned Songs
          </button>
          <button
            style={{ ...s.button, background: colors.surface, color: colors.danger, border: `1px solid ${colors.border}`, textAlign: 'left' }}
            onClick={onDeleteSongs}
          >
            Delete Songs
          </button>
          <button
            style={{ ...s.button, background: 'transparent', color: colors.textSecondary }}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
