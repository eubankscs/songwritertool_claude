import React from 'react';
import type { ReviewQueueItem } from '../../shared/schema';
import { colors } from '../styles';

interface Props {
  items: ReviewQueueItem[];
  onClose: () => void;
  onItemsChanged: () => void;
  onJumpTo: (targetId: string | null) => void;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  'unknown-chord':       { label: 'Unknown Chord',       color: '#e5c07b' },
  'section-conflict':    { label: 'Section Conflict',     color: '#e06c75' },
  'broken-section-link': { label: 'Broken Section Link',  color: '#d19a66' },
  'ambiguous-transpose': { label: 'Ambiguous Transpose',  color: '#c678dd' },
  'placeholder-lyric':   { label: 'Placeholder Lyric',    color: '#61afef' },
  'manual-flag':         { label: 'Manual Flag',          color: '#56b6c2' },
};

export function ReviewQueuePanel({ items, onClose, onItemsChanged, onJumpTo }: Props): React.ReactElement {
  async function resolve(id: string) {
    await window.songwriterAPI.reviewQueue.resolve(id);
    onItemsChanged();
  }

  async function ignore(id: string) {
    await window.songwriterAPI.reviewQueue.ignore(id);
    onItemsChanged();
  }

  return (
    <div style={{
      width: '280px', flexShrink: 0, borderLeft: `1px solid ${colors.border}`,
      background: colors.surface, display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
        <span style={{ fontWeight: 600, fontSize: '12px', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Review Queue {items.length > 0 && <span style={{ color: colors.accent }}>({items.length})</span>}
        </span>
        <span onClick={onClose} style={{ color: colors.textSecondary, cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>✕</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        {items.length === 0 ? (
          <div style={{ color: colors.textSecondary, fontSize: '13px', textAlign: 'center', marginTop: '24px' }}>
            No items to review.
          </div>
        ) : (
          items.map(item => {
            const meta = TYPE_LABELS[item.type] ?? { label: item.type, color: colors.textSecondary };
            return (
              <div
                key={item.id}
                style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '5px', padding: '10px 12px', marginBottom: '10px', cursor: 'pointer' }}
                onClick={() => onJumpTo(item.targetId)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: meta.color, border: `1px solid ${meta.color}`, borderRadius: '3px', padding: '0 5px', lineHeight: '16px', flexShrink: 0 }}>
                    {meta.label}
                  </span>
                </div>
                <div style={{ color: colors.text, fontSize: '12px', marginBottom: '8px', wordBreak: 'break-word' }}>{item.message}</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={e => { e.stopPropagation(); resolve(item.id); }}
                    style={{ background: '#1e3a2f', border: '1px solid #2d5a45', color: '#6bbf8f', fontSize: '11px', cursor: 'pointer', padding: '2px 10px', borderRadius: '3px' }}
                  >Resolve</button>
                  <button
                    onClick={e => { e.stopPropagation(); ignore(item.id); }}
                    style={{ background: 'transparent', border: `1px solid ${colors.border}`, color: colors.textSecondary, fontSize: '11px', cursor: 'pointer', padding: '2px 10px', borderRadius: '3px' }}
                  >Ignore</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
