import React, { useState } from 'react';
import { colors } from '../styles';

export type PrintMode = 'chart' | 'withComments';

interface EditorLine {
  content: string;
  chords: Array<{ chord: string; pos: number }>;
  inlineMarkers: Array<{ text: string; charOffset: number }>;
}

interface StandaloneMarker {
  text: string;
  afterLineIndex: number;
}

interface Annotation {
  targetRange: string;
  body: string;
}

interface Props {
  mode: PrintMode;
  songTitle: string;
  lines: EditorLine[];
  standalones: StandaloneMarker[];
  annotations: Annotation[];
  capo: number | null;
  concertKey: string | null;
  onClose: () => void;
}

function isSectionContent(content: string): boolean {
  return /^\[.+\]$/.test(content.trim());
}

export function PrintDialog({ mode, songTitle, lines, standalones, annotations, capo, concertKey, onClose }: Props): React.ReactElement {
  const [dualColumn, setDualColumn] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);

  function buildPrintHtml(): string {
    const metaParts: string[] = [];
    if (capo) metaParts.push(`Capo ${capo}`);
    if (concertKey) metaParts.push(`Key of ${concertKey}`);
    const meta = metaParts.join(' · ');

    const lineHtmlParts: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (showMarkers) {
        const before = standalones.filter(sm => sm.afterLineIndex === i - 1);
        for (const sm of before) {
          lineHtmlParts.push(`<div class="marker standalone">${escHtml(sm.text)}</div>`);
        }
      }

      if (isSectionContent(line.content)) {
        lineHtmlParts.push(`<div class="section">${escHtml(line.content)}</div>`);
        continue;
      }

      if (line.chords.length > 0) {
        const chordRow = buildChordRow(line.content, line.chords);
        lineHtmlParts.push(`<div class="chord-row">${chordRow}</div>`);
      }

      if (showMarkers && line.inlineMarkers.length > 0) {
        const sorted = [...line.inlineMarkers].sort((a, b) => a.charOffset - b.charOffset);
        let out = '';
        let pos = 0;
        for (const m of sorted) {
          out += escHtml(line.content.substring(pos, m.charOffset));
          out += `<span class="inline-marker">${escHtml(m.text)}</span>`;
          pos = m.charOffset;
        }
        out += escHtml(line.content.substring(pos));
        lineHtmlParts.push(`<div class="lyric">${out}</div>`);
      } else {
        lineHtmlParts.push(`<div class="lyric">${escHtml(line.content) || '&nbsp;'}</div>`);
      }

      if (mode === 'withComments') {
        const lineAnnotations = annotations.filter(a => {
          const parts = a.targetRange.split(':');
          return parseInt(parts[0], 10) === i;
        });
        for (const ann of lineAnnotations) {
          const parts = ann.targetRange.split(':');
          const start = parseInt(parts[1] ?? '0', 10);
          const end = parseInt(parts[2] ?? '0', 10);
          const excerpt = line.content.substring(start, end);
          lineHtmlParts.push(`<div class="annotation"><span class="ann-excerpt">"${escHtml(excerpt)}"</span> — ${escHtml(ann.body)}</div>`);
        }
      }
    }

    if (showMarkers) {
      const last = standalones.filter(sm => sm.afterLineIndex === lines.length - 1);
      for (const sm of last) {
        lineHtmlParts.push(`<div class="marker standalone">${escHtml(sm.text)}</div>`);
      }
    }

    const columnStyle = dualColumn ? 'column-count: 2; column-gap: 32px;' : '';

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${escHtml(songTitle)}</title>
<style>
  body { font-family: 'Courier New', monospace; font-size: 11pt; color: #000; background: #fff; margin: 0; padding: 0; }
  h1 { font-size: 16pt; margin: 0 0 4px; }
  .meta { font-size: 10pt; color: #555; margin-bottom: 16px; }
  .content { ${columnStyle} }
  .section { font-weight: bold; margin-top: 14px; margin-bottom: 2px; color: #333; }
  .chord-row { color: #000; font-weight: bold; white-space: pre; }
  .lyric { white-space: pre; }
  .inline-marker { font-style: italic; color: #555; font-size: 9pt; vertical-align: super; }
  .marker.standalone { font-style: italic; color: #555; font-size: 9pt; margin: 4px 0; }
  .annotation { font-size: 9pt; color: #444; margin: 2px 0 6px 16px; }
  .ann-excerpt { font-style: italic; }
  @media print { body > *:not(#sw-print) { display: none !important; } #sw-print { display: block !important; } }
</style>
</head><body id="sw-print">
<h1>${escHtml(songTitle)}</h1>
${meta ? `<div class="meta">${escHtml(meta)}</div>` : ''}
<div class="content">${lineHtmlParts.join('\n')}</div>
</body></html>`;
  }

  function buildChordRow(lyric: string, chords: Array<{ chord: string; pos: number }>): string {
    const sorted = [...chords].sort((a, b) => a.pos - b.pos);
    let row = '';
    let col = 0;
    for (const { chord, pos } of sorted) {
      if (pos > col) row += ' '.repeat(pos - col);
      row += chord;
      col = pos + chord.length;
    }
    return escHtml(row);
  }

  function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function handlePrint() {
    const html = buildPrintHtml();
    const printWin = window.open('', '_blank', 'width=800,height=900');
    if (!printWin) return;
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 250);
    onClose();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '20px 24px', width: '320px', maxWidth: '92vw' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontWeight: 600, color: colors.text, fontSize: '14px', marginBottom: '4px' }}>
          {mode === 'chart' ? 'Print Chart' : 'Print With Comments'}
        </div>
        <div style={{ color: colors.textSecondary, fontSize: '11px', marginBottom: '16px' }}>
          {mode === 'chart' ? 'Chords and lyrics only' : 'Includes annotations and notes'}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.textSecondary, fontSize: '13px', cursor: 'pointer', marginBottom: '10px' }}>
          <input type="checkbox" checked={dualColumn} onChange={e => setDualColumn(e.target.checked)} style={{ cursor: 'pointer' }} />
          Dual-column layout
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.textSecondary, fontSize: '13px', cursor: 'pointer', marginBottom: '20px' }}>
          <input type="checkbox" checked={showMarkers} onChange={e => setShowMarkers(e.target.checked)} style={{ cursor: 'pointer' }} />
          Show arrangement markers
        </label>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: `1px solid ${colors.border}`, color: colors.textSecondary, fontSize: '12px', cursor: 'pointer', padding: '5px 14px', borderRadius: '3px' }}
          >Cancel</button>
          <button
            onClick={handlePrint}
            style={{ background: colors.accent, border: 'none', color: '#fff', fontSize: '12px', cursor: 'pointer', padding: '5px 14px', borderRadius: '3px' }}
          >Print…</button>
        </div>
      </div>
    </div>
  );
}
