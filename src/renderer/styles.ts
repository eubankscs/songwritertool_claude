export const colors = {
  bg: '#1a1a1a',
  surface: '#242424',
  surfaceHover: '#2e2e2e',
  border: '#333',
  text: '#e8e8e8',
  textSecondary: '#888',
  accent: '#6d9eeb',
  accentHover: '#5a8de0',
  danger: '#e06c6c',
  dangerHover: '#c95a5a',
};

export const s = {
  screen: {
    background: colors.bg,
    color: colors.text,
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: '14px',
  } as React.CSSProperties,

  container: {
    maxWidth: '640px',
    margin: '0 auto',
    padding: '24px 16px',
  } as React.CSSProperties,

  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    gap: '8px',
  } as React.CSSProperties,

  sectionLabel: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: colors.textSecondary,
    textTransform: 'uppercase' as const,
    marginBottom: '6px',
    marginTop: '20px',
  } as React.CSSProperties,

  primaryText: {
    fontSize: '14px',
    color: colors.text,
    fontWeight: 500,
  } as React.CSSProperties,

  secondaryText: {
    fontSize: '12px',
    color: colors.textSecondary,
    marginTop: '1px',
  } as React.CSSProperties,

  actionText: {
    fontSize: '14px',
    color: colors.accent,
    cursor: 'pointer',
    padding: '10px 12px',
    borderRadius: '6px',
    fontWeight: 500,
  } as React.CSSProperties,

  input: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: '6px',
    color: colors.text,
    padding: '8px 10px',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box' as const,
    outline: 'none',
  } as React.CSSProperties,

  button: {
    padding: '7px 14px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  } as React.CSSProperties,

  modal: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  } as React.CSSProperties,

  modalBox: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: '10px',
    padding: '24px',
    width: '360px',
    maxWidth: '90vw',
  } as React.CSSProperties,
};
