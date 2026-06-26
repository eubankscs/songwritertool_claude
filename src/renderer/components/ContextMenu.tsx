import React, { useEffect, useRef } from 'react';
import { colors } from '../styles';

export interface ContextMenuItem {
  label: string;
  danger?: boolean;
  onClick: () => void;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: y,
        left: x,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        padding: '4px',
        zIndex: 200,
        minWidth: '160px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      {items.map(item => (
        <div
          key={item.label}
          onClick={() => { item.onClick(); onClose(); }}
          style={{
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            color: item.danger ? '#e06c6c' : colors.text,
            fontSize: '13px',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = colors.surfaceHover)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}
