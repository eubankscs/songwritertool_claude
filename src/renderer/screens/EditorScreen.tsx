import React, { useEffect, useState, useRef, useCallback } from 'react';
import { colors, s } from '../styles';
import type { Song, ContentBlock, ContentBlockType } from '../../shared/schema';

// ── Types ────────────────────────────────────────────────────────────────────

interface ChordEntry {
  chord: string;
  pos: number;  // character-index offset into the lyric line
}

interface EditorLine {
  id: string;
  content: string;
  chords: ChordEntry[];
}

interface ChordInputState {
  lineIndex: number;
  pos: number;
  value: string;
  isEdit: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isSectionContent(content: string): boolean {
  return /^\[.+\]$/.test(content.trim());
}

let tmpCounter = 0;
function newLine(content = ''): EditorLine {
  return { id: `tmp-${++tmpCounter}`, content, chords: [] };
}

function blocksToLines(blocks: ContentBlock[]): EditorLine[] {
  const result: EditorLine[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (block.type === 'chordLine') {
      const next = blocks[i + 1];
      if (next && next.type === 'lyricLine') {
        let chords: ChordEntry[] = [];
        try { chords = JSON.parse(block.content ?? '[]'); } catch { /* ignore */ }
        result.push({ id: next.id, content: next.content ?? '', chords });
        i += 2;
        continue;
      }
      // Orphan chordLine — skip
      i++;
    } else if (block.type === 'section' || block.type === 'lyricLine') {
      result.push({ id: block.id, content: block.content ?? '', chords: [] });
      i++;
    } else {
      // arrangementMarker — skip in Phase 3a
      i++;
    }
  }
  return result.length > 0 ? result : [newLine()];
}

function linesToBlocks(
  lines: EditorLine[]
): Array<{ type: ContentBlockType; content: string | null; position: number }> {
  const out: Array<{ type: ContentBlockType; content: string | null; position: number }> = [];
  let pos = 0;
  for (const line of lines) {
    if (isSectionContent(line.content)) {
      out.push({ type: 'section', content: line.content, position: pos++ });
    } else {
      if (line.chords.length > 0) {
        out.push({ type: 'chordLine', content: JSON.stringify(line.chords), position: pos++ });
      }
      out.push({ type: 'lyricLine', content: line.content, position: pos++ });
    }
  }
  return out;
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  songId: string;
  onBack: () => void;
}

const LYRIC_FONT = 'monospace';
const LYRIC_SIZE = '14px';
const CHORD_SIZE = '12px';
const CHORD_ROW_HEIGHT = 20;

export function EditorScreen({ songId, onBack }: Props): React.ReactElement {
  const [song, setSong] = useState<Song | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [lines, setLines] = useState<EditorLine[]>([newLine()]);
  const [charWidth, setCharWidth] = useState(8.41);  // measured on mount
  const [chordInput, setChordInput] = useState<ChordInputState | null>(null);

  const measureSpanRef = useRef<HTMLSpanElement>(null);
  const lineRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Measure a single monospace character width after paint
  useEffect(() => {
    if (measureSpanRef.current) {
      setCharWidth(measureSpanRef.current.getBoundingClientRect().width);
    }
  }, []);

  // Focus the first line on initial load
  useEffect(() => {
    const t = setTimeout(() => lineRefs.current[0]?.focus(), 80);
    return () => clearTimeout(t);
  }, [song]);

  // Load song + version + content blocks
  useEffect(() => {
    let cancelled = false;
    async function load() {
      window.songwriterAPI.songs.touchLastOpened(songId);
      const loadedSong = await window.songwriterAPI.songs.getById(songId);
      if (cancelled) return;
      setSong(loadedSong ?? null);

      const versions = await window.songwriterAPI.songVersions.getBySong(songId);
      if (cancelled) return;
      // Prefer working version; fall back to saved
      const version =
        versions.find(v => v.type === 'working') ??
        versions.find(v => v.type === 'saved') ??
        null;

      if (version) {
        setVersionId(version.id);
        const rawBlocks = await window.songwriterAPI.contentBlocks.getByVersion(version.id);
        if (cancelled) return;
        setLines(blocksToLines(rawBlocks));
      } else {
        setVersionId(null);
        setLines([newLine()]);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [songId]);

  // Save: upsert working version then replace content blocks
  const save = useCallback(async () => {
    let vid = versionId;
    if (!vid) {
      const version = await window.songwriterAPI.songVersions.upsertWorking(songId);
      vid = version.id;
      setVersionId(vid);
    }
    const blocks = linesToBlocks(lines);
    await window.songwriterAPI.contentBlocks.replaceAll(vid, blocks);
  }, [songId, versionId, lines]);

  // Global Ctrl+S / Cmd+S
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  // ── Line editing ─────────────────────────────────────────────────────────

  function updateLineContent(index: number, content: string) {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, content } : l));
  }

  function handleLineKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = newLine();
      setLines(prev => {
        const copy = [...prev];
        copy.splice(index + 1, 0, next);
        return copy;
      });
      setTimeout(() => lineRefs.current[index + 1]?.focus(), 0);
    } else if (e.key === 'Backspace' && lines[index].content === '' && lines.length > 1) {
      e.preventDefault();
      setLines(prev => prev.filter((_, i) => i !== index));
      setTimeout(() => lineRefs.current[Math.max(0, index - 1)]?.focus(), 0);
    } else if (e.key === 'ArrowUp' && index > 0) {
      lineRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowDown' && index < lines.length - 1) {
      lineRefs.current[index + 1]?.focus();
    }
  }

  // ── Chord editing ─────────────────────────────────────────────────────────

  function handleChordRowClick(lineIndex: number, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pos = Math.round(x / charWidth);
    // If clicking near an existing chord, open it for editing
    const existing = lines[lineIndex].chords.find(c => Math.abs(c.pos - pos) < 2);
    if (existing) {
      setChordInput({ lineIndex, pos: existing.pos, value: existing.chord, isEdit: true });
    } else {
      setChordInput({ lineIndex, pos, value: '', isEdit: false });
    }
  }

  function handleChordSpanClick(lineIndex: number, pos: number, chord: string, e: React.MouseEvent) {
    e.stopPropagation();
    setChordInput({ lineIndex, pos, value: chord, isEdit: true });
  }

  function handleChordInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!chordInput) return;
    setChordInput({ ...chordInput, value: e.target.value });
  }

  function commitChordInput() {
    if (!chordInput) return;
    const trimmed = chordInput.value.trim();
    setLines(prev => prev.map((l, i) => {
      if (i !== chordInput.lineIndex) return l;
      const filtered = l.chords.filter(c => c.pos !== chordInput.pos);
      if (trimmed) {
        const updated = [...filtered, { chord: trimmed, pos: chordInput.pos }];
        updated.sort((a, b) => a.pos - b.pos);
        return { ...l, chords: updated };
      }
      return { ...l, chords: filtered };
    }));
    setChordInput(null);
  }

  function handleChordInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!chordInput) return;
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      commitChordInput();
    } else if (e.key === 'Escape') {
      setChordInput(null);
    } else if (e.key === 'Backspace' && chordInput.value === '' && chordInput.isEdit) {
      // Delete existing chord with Backspace on empty input
      setLines(prev => prev.map((l, i) =>
        i === chordInput.lineIndex
          ? { ...l, chords: l.chords.filter(c => c.pos !== chordInput.pos) }
          : l
      ));
      setChordInput(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const firstSectionIndex = lines.findIndex(l => isSectionContent(l.content));

  return (
    <div style={{ ...s.screen, display: 'flex', flexDirection: 'column' }}>
      {/* Hidden span for character width measurement */}
      <span
        ref={measureSpanRef}
        aria-hidden="true"
        style={{
          position: 'absolute', visibility: 'hidden', pointerEvents: 'none',
          fontFamily: LYRIC_FONT, fontSize: LYRIC_SIZE,
          letterSpacing: 0, whiteSpace: 'pre',
        }}
      >m</span>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px',
        borderBottom: `1px solid ${colors.border}`,
        background: colors.surface,
        flexShrink: 0,
      }}>
        <span
          style={{ fontSize: '18px', cursor: 'pointer', color: colors.textSecondary }}
          onClick={onBack}
        >☰</span>
        <span style={{ fontWeight: 600, color: colors.text }}>{song?.title ?? '…'}</span>
        <button
          onClick={save}
          style={{
            marginLeft: 'auto',
            background: 'transparent', border: `1px solid ${colors.border}`,
            color: colors.textSecondary, fontSize: '12px', cursor: 'pointer',
            padding: '3px 10px', borderRadius: '3px',
          }}
        >Save</button>
      </div>

      {/* Editor canvas */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}
        onClick={() => {
          // Clicking blank canvas area below lines focuses last line
          if (document.activeElement?.tagName !== 'INPUT') {
            lineRefs.current[lines.length - 1]?.focus();
          }
        }}
      >
        {lines.map((line, index) => {
          const isSecLine = isSectionContent(line.content);
          const needsBlankAbove = isSecLine && index !== firstSectionIndex;

          return (
            <React.Fragment key={line.id}>
              {needsBlankAbove && <div style={{ height: '1em' }} />}

              {isSecLine ? (
                // ── Section tag line ──────────────────────────────────────
                <input
                  ref={el => { lineRefs.current[index] = el; }}
                  value={line.content}
                  onChange={e => updateLineContent(index, e.target.value)}
                  onKeyDown={e => handleLineKeyDown(index, e)}
                  style={{
                    display: 'block', width: '100%', boxSizing: 'border-box',
                    background: 'transparent', border: 'none', outline: 'none',
                    fontFamily: LYRIC_FONT, fontSize: LYRIC_SIZE,
                    fontWeight: 700, color: colors.accent,
                    padding: 0, lineHeight: '1.6',
                  }}
                />
              ) : (
                // ── Lyric line with chord row ──────────────────────────────
                <div style={{ position: 'relative' }}>
                  {/* Chord row — click anywhere to add a chord at that character position */}
                  <div
                    style={{
                      position: 'relative', height: `${CHORD_ROW_HEIGHT}px`,
                      cursor: 'text', userSelect: 'none',
                    }}
                    onClick={e => handleChordRowClick(index, e)}
                  >
                    {line.chords.map(({ chord, pos }) => (
                      <span
                        key={pos}
                        style={{
                          position: 'absolute', left: Math.round(pos * charWidth),
                          fontFamily: LYRIC_FONT, fontSize: CHORD_SIZE,
                          color: colors.accent, fontWeight: 600,
                          lineHeight: `${CHORD_ROW_HEIGHT}px`,
                          cursor: 'text',
                        }}
                        onClick={e => handleChordSpanClick(index, pos, chord, e)}
                      >{chord}</span>
                    ))}

                    {/* Inline chord input */}
                    {chordInput?.lineIndex === index && (
                      <input
                        autoFocus
                        value={chordInput.value}
                        onChange={handleChordInputChange}
                        onKeyDown={handleChordInputKeyDown}
                        onBlur={commitChordInput}
                        onClick={e => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          left: Math.round(chordInput.pos * charWidth),
                          top: 1, width: 64, height: CHORD_ROW_HEIGHT - 2,
                          background: colors.surface,
                          border: `1px solid ${colors.accent}`,
                          color: colors.text, fontFamily: LYRIC_FONT, fontSize: CHORD_SIZE,
                          padding: '0 3px', outline: 'none', zIndex: 1,
                        }}
                      />
                    )}
                  </div>

                  {/* Lyric input */}
                  <input
                    ref={el => { lineRefs.current[index] = el; }}
                    value={line.content}
                    onChange={e => updateLineContent(index, e.target.value)}
                    onKeyDown={e => handleLineKeyDown(index, e)}
                    style={{
                      display: 'block', width: '100%', boxSizing: 'border-box',
                      background: 'transparent', border: 'none', outline: 'none',
                      fontFamily: LYRIC_FONT, fontSize: LYRIC_SIZE,
                      color: colors.text, padding: 0, lineHeight: '1.6',
                    }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}

        {/* Tap-to-extend: empty space at bottom that adds a new line when clicked */}
        <div
          style={{ height: '120px' }}
          onClick={e => {
            e.stopPropagation();
            const last = lines[lines.length - 1];
            if (last.content === '') {
              lineRefs.current[lines.length - 1]?.focus();
            } else {
              const next = newLine();
              setLines(prev => [...prev, next]);
              setTimeout(() => lineRefs.current[lines.length]?.focus(), 0);
            }
          }}
        />
      </div>
    </div>
  );
}
