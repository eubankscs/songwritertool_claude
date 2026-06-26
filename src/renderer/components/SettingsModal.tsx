import React from 'react';
import { colors } from '../styles';

interface Props {
  onClose: () => void;
  onManageTags: () => void;
}

export function SettingsModal({ onClose, onManageTags }: Props): React.ReactElement {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '20px 24px', width: '320px', maxWidth: '92vw' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ fontWeight: 600, color: colors.text, fontSize: '14px' }}>Settings</span>
          <span onClick={onClose} style={{ color: colors.textSecondary, cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>✕</span>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ color: colors.textSecondary, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Appearance</div>
          <div style={{ color: colors.text, fontSize: '13px' }}>Dark</div>
        </div>

        <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '16px', marginBottom: '8px' }}>
          <div style={{ color: colors.textSecondary, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Annotation Tags</div>
          <button
            onClick={() => { onClose(); onManageTags(); }}
            style={{
              background: 'transparent', border: `1px solid ${colors.border}`,
              color: colors.text, fontSize: '13px', cursor: 'pointer',
              padding: '7px 16px', borderRadius: '5px', width: '100%',
              textAlign: 'left',
            }}
          >Manage Tags →</button>
        </div>
      </div>
    </div>
  );
}
