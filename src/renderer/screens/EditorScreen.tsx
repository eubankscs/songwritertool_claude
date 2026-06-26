import React, { useEffect, useState, useRef, useCallback } from 'react';
import { colors, s } from '../styles';
import type { Song, ContentBlock, ContentBlockType, ArrangementMarker } from '../../shared/schema';
import type { PersistWorkingSyncPayload } from '../../shared/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface ChordEntry {
  chord: string;
  pos: number;  // character index within the lyric line
}

interface InlineMarker {
  id: string;
  text: string;
  charOffset: number;  // character index — same system as ChordEntry.pos
}

interface StandaloneMarker {
  id: string;
  text: string;
  afterLineIndex: number;
}

interface EditorLine {
  id: string;  // lyricLine or section block id from DB (or 'tmp-N' for new)
  content: string;
  chords: ChordEntry[];
  inlineMarkers: InlineMarker[];
}

interface ChordInputState {
  lineIndex: number;
  pos: number;
  value: string;
  isEdit: boolean;
}

interface MarkerInputState {
  lineIndex: number;
  mode: 'standalone' | 'inline';
  charOffset: number;
  value: string;
}

// ── Pure helpers ───────────────────────────────────────────────────────────────

function isSectionContent(content: string): boolean {
  return /^\[.+\]$/.test(content.trim());
}

let tmpCounter = 0;
function newLine(content = ''): EditorLine {
  return { id: `tmp-${++tmpCounter}`, content, chords: [], inlineMarkers: [] };
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
        result.push({ id: next.id, content: next.content ?? '', chords, inlineMarkers: [] });
        i += 2;
        continue;
      }
      i++;
    } else if (block.type === 'section' || block.type === 'lyricLine') {
      result.push({ id: block.id, content: block.content ?? '', chords: [], inlineMarkers: [] });
      i++;
    } else {
      i++; // arrangementMarker block type — not used
    }
  }
  return result.length > 0 ? result : [newLine()];
}

function attachMarkers(
  lines: EditorLine[],
  markers: ArrangementMarker[],
  blocks: ContentBlock[]
): { updatedLines: EditorLine[]; standalones: StandaloneMarker[] } {
  // Build maps: blockId → lineIndex, blockPosition → lineIndex
  const idToLine = new Map<string, number>();
  const posToLine = new Map<number, number>();
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].id.startsWith('tmp-')) idToLine.set(lines[i].id, i);
  }
  for (const block of blocks) {
    if (block.type === 'lyricLine' || block.type === 'section') {
      const idx = idToLine.get(block.id);
      if (idx !== undefined) posToLine.set(block.position, idx);
    }
  }

  const updatedLines = lines.map(l => ({ ...l, inlineMarkers: [] as InlineMarker[] }));
  const standalones: StandaloneMarker[] = [];

  for (const m of markers) {
    if (m.displayMode === 'inline') {
      const colon = m.targetPosition.lastIndexOf(':');
      if (colon >= 0) {
        const blockId = m.targetPosition.substring(0, colon);
        const charOffset = parseInt(m.targetPosition.substring(colon + 1), 10);
        const idx = idToLine.get(blockId);
        if (idx !== undefined && !isNaN(charOffset)) {
          updatedLines[idx].inlineMarkers.push({ id: m.id, text: m.text, charOffset });
        }
      }
    } else {
      const blockPos = parseInt(m.targetPosition, 10);
      const idx = posToLine.get(blockPos);
      standalones.push({ id: m.id, text: m.text, afterLineIndex: idx ?? 0 });
    }
  }

  return { updatedLines, standalones };
}

// Returns: Map<lineIndex → position of the primary block for that line>
function computeLinePositions(lines: EditorLine[]): Map<number, number> {
  const map = new Map<number, number>();
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    if (isSectionContent(lines[i].content)) {
      map.set(i, pos++);
    } else {
      if (lines[i].chords.length > 0) pos++; // chordLine block
      map.set(i, pos++);                      // lyricLine block
    }
  }
  return map;
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

// Builds position-based marker payload for IPC (main process resolves positions → block IDs).
function buildSyncPayload(
  lines: EditorLine[],
  standalones: StandaloneMarker[]
): Pick<PersistWorkingSyncPayload, 'blocks' | 'inlineMarkers' | 'standaloneMarkers'> {
  const blocks = linesToBlocks(lines);
  const linePositions = computeLinePositions(lines);

  const inlineMarkers: PersistWorkingSyncPayload['inlineMarkers'] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isSectionContent(lines[i].content)) continue;
    const lyricPos = linePositions.get(i);
    if (lyricPos === undefined) continue;
    for (const m of lines[i].inlineMarkers) {
      inlineMarkers.push({ lyricLinePosition: lyricPos, charOffset: m.charOffset, text: m.text });
    }
  }

  const standaloneMarkers = standalones.map(sm => ({
    afterBlockPosition: linePositions.get(sm.afterLineIndex) ?? 0,
    text: sm.text,
  }));

  return { blocks, inlineMarkers, standaloneMarkers };
}

// Builds final arrangement marker records with real block IDs (for async saves).
function buildFinalMarkers(
  lines: EditorLine[],
  standalones: StandaloneMarker[],
  newBlocks: ContentBlock[]
): Array<{ targetPosition: string; displayMode: 'inline' | 'standalone'; text: string }> {
  const posToId = new Map(newBlocks.map(b => [b.position, b.id]));
  const linePositions = computeLinePositions(lines);
  const result: Array<{ targetPosition: string; displayMode: 'inline' | 'standalone'; text: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    if (isSectionContent(lines[i].content)) continue;
    const lyricPos = linePositions.get(i);
    if (lyricPos === undefined) continue;
    const blockId = posToId.get(lyricPos);
    if (!blockId) continue;
    for (const m of lines[i].inlineMarkers) {
      result.push({ targetPosition: `${blockId}:${m.charOffset}`, displayMode: 'inline', text: m.text });
    }
  }

  for (const sm of standalones) {
    const blockPos = linePositions.get(sm.afterLineIndex) ?? 0;
    result.push({ targetPosition: String(blockPos), displayMode: 'standalone', text: sm.text });
  }

  return result;
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
const DEBOUNCE_MS = 2000;

export function EditorScreen({ songId, onBack }: Props): React.ReactElement {
  const [song, setSong] = useState<Song | null>(null);
  const [workingVersionId, setWorkingVersionId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [lines, setLines] = useState<EditorLine[]>([newLine()]);
  const [standalones, setStandalones] = useState<StandaloneMarker[]>([]);
  const [charWidth, setCharWidth] = useState(8.41);
  const [chordInput, setChordInput] = useState<ChordInputState | null>(null);
  const [markerInput, setMarkerInput] = useState<MarkerInputState | null>(null);

  // Stable refs — used in event handlers that must not capture stale closures
  const measureSpanRef = useRef<HTMLSpanElement>(null);
  const lineRefs = useRef<(HTMLInputElement | null)[]>([]);
  const pendingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workingVersionIdRef = useRef<string | null>(null);
  const linesRef = useRef<EditorLine[]>(lines);
  const standalonesRef = useRef<StandaloneMarker[]>([]);

  useEffect(() => { workingVersionIdRef.current = workingVersionId; }, [workingVersionId]);
  useEffect(() => { linesRef.current = lines; }, [lines]);
  useEffect(() => { standalonesRef.current = standalones; }, [standalones]);

  // Measure monospace character width once after first paint
  useEffect(() => {
    if (measureSpanRef.current) setCharWidth(measureSpanRef.current.getBoundingClientRect().width);
  }, []);

  // Focus first line when song loads
  useEffect(() => {
    const t = setTimeout(() => lineRefs.current[0]?.focus(), 80);
    return () => clearTimeout(t);
  }, [song]);

  // Load song + versions + content + markers
  useEffect(() => {
    let cancelled = false;
    async function load() {
      window.songwriterAPI.songs.touchLastOpened(songId);
      const loadedSong = await window.songwriterAPI.songs.getById(songId);
      if (cancelled) return;
      setSong(loadedSong ?? null);

      const versions = await window.songwriterAPI.songVersions.getBySong(songId);
      if (cancelled) return;

      const working = versions.find(v => v.type === 'working') ?? null;
      const saved = versions.find(v => v.type === 'saved') ?? null;
      const loadFrom = working ?? saved;

      setWorkingVersionId(working?.id ?? null);
      workingVersionIdRef.current = working?.id ?? null;
      setIsDirty(!!working);

      if (loadFrom) {
        const [rawBlocks, rawMarkers] = await Promise.all([
          window.songwriterAPI.contentBlocks.getByVersion(loadFrom.id),
          window.songwriterAPI.arrangementMarkers.getByVersion(loadFrom.id),
        ]);
        if (cancelled) return;
        const editorLines = blocksToLines(rawBlocks);
        const { updatedLines, standalones: sMarkers } = attachMarkers(editorLines, rawMarkers, rawBlocks);
        setLines(updatedLines);
        linesRef.current = updatedLines;
        setStandalones(sMarkers);
        standalonesRef.current = sMarkers;
      } else {
        const initial = [newLine()];
        setLines(initial);
        linesRef.current = initial;
        setStandalones([]);
        standalonesRef.current = [];
      }
    }
    load();
    return () => { cancelled = true; };
  }, [songId]);

  // ── Persistence ────────────────────────────────────────────────────────────────

  const persistWorking = useCallback(async (): Promise<void> => {
    const currentLines = linesRef.current;
    const currentStandalones = standalonesRef.current;
    let vid = workingVersionIdRef.current;

    if (!vid) {
      const version = await window.songwriterAPI.songVersions.upsertWorking(songId);
      vid = version.id;
      setWorkingVersionId(vid);
      workingVersionIdRef.current = vid;
    }

    const { blocks } = buildSyncPayload(currentLines, currentStandalones);
    await window.songwriterAPI.contentBlocks.replaceAll(vid, blocks);

    const newBlocks = await window.songwriterAPI.contentBlocks.getByVersion(vid);
    const finalMarkers = buildFinalMarkers(currentLines, currentStandalones, newBlocks);
    await window.songwriterAPI.arrangementMarkers.replaceAll(vid, finalMarkers);

    pendingRef.current = false;
  }, [songId]);

  const scheduleAutoSave = useCallback(() => {
    pendingRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { persistWorking(); }, DEBOUNCE_MS);
  }, [persistWorking]);

  const flushAutoSave = useCallback(async () => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    if (pendingRef.current) await persistWorking();
  }, [persistWorking]);

  // Manual save: write to saved version, delete working version
  const manualSave = useCallback(async () => {
    const currentLines = linesRef.current;
    const currentStandalones = standalonesRef.current;

    const savedVersion = await window.songwriterAPI.songVersions.upsertSaved(songId);
    const svId = savedVersion.id;

    const { blocks } = buildSyncPayload(currentLines, currentStandalones);
    await window.songwriterAPI.contentBlocks.replaceAll(svId, blocks);
    const newBlocks = await window.songwriterAPI.contentBlocks.getByVersion(svId);
    const finalMarkers = buildFinalMarkers(currentLines, currentStandalones, newBlocks);
    await window.songwriterAPI.arrangementMarkers.replaceAll(svId, finalMarkers);

    await window.songwriterAPI.songVersions.deleteWorking(songId);

    setWorkingVersionId(null);
    workingVersionIdRef.current = null;
    setIsDirty(false);
    pendingRef.current = false;
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
  }, [songId]);

  // Window blur → flush immediately
  useEffect(() => {
    const onBlur = () => { if (pendingRef.current) flushAutoSave(); };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [flushAutoSave]);

  // beforeunload → synchronous persist (blocks renderer thread until complete)
  useEffect(() => {
    function onBeforeUnload() {
      if (!pendingRef.current) return;
      const vid = workingVersionIdRef.current;
      const { blocks, inlineMarkers, standaloneMarkers } = buildSyncPayload(
        linesRef.current,
        standalonesRef.current
      );
      window.songwriterAPI.songs.persistWorkingSync({
        versionId: vid,
        songId,
        blocks,
        inlineMarkers,
        standaloneMarkers,
      });
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [songId]);

  // Ctrl+S / Cmd+S → manual save
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); manualSave(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [manualSave]);

  // Navigate back: flush before leaving
  async function handleBack() {
    await flushAutoSave();
    onBack();
  }

  // ── Edit helpers ──────────────────────────────────────────────────────────

  function markDirty() {
    setIsDirty(true);
    scheduleAutoSave();
  }

  function updateLineContent(index: number, content: string) {
    setLines(prev => {
      const next = prev.map((l, i) => i === index ? { ...l, content } : l);
      linesRef.current = next;
      return next;
    });
    markDirty();
  }

  function handleLineKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = newLine();
      setLines(prev => {
        const copy = [...prev];
        copy.splice(index + 1, 0, next);
        linesRef.current = copy;
        return copy;
      });
      markDirty();
      setTimeout(() => lineRefs.current[index + 1]?.focus(), 0);
    } else if (e.key === 'Backspace' && lines[index].content === '' && lines.length > 1) {
      e.preventDefault();
      setLines(prev => {
        const next = prev.filter((_, i) => i !== index);
        linesRef.current = next;
        return next;
      });
      markDirty();
      setTimeout(() => lineRefs.current[Math.max(0, index - 1)]?.focus(), 0);
    } else if (e.key === 'ArrowUp' && index > 0) {
      lineRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowDown' && index < lines.length - 1) {
      lineRefs.current[index + 1]?.focus();
    }
  }

  // ── Chord input ────────────────────────────────────────────────────────────

  function handleChordRowClick(lineIndex: number, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pos = Math.round(x / charWidth);

    if (e.altKey) {
      // Alt+click → add inline arrangement marker at this character position
      setMarkerInput({ lineIndex, mode: 'inline', charOffset: pos, value: '' });
      return;
    }

    const existing = lines[lineIndex].chords.find(c => Math.abs(c.pos - pos) < 2);
    if (existing) {
      setChordInput({ lineIndex, pos: existing.pos, value: existing.chord, isEdit: true });
    } else {
      setChordInput({ lineIndex, pos, value: '', isEdit: false });
    }
  }

  function commitChordInput() {
    if (!chordInput) return;
    const trimmed = chordInput.value.trim();
    setLines(prev => {
      const next = prev.map((l, i) => {
        if (i !== chordInput.lineIndex) return l;
        const filtered = l.chords.filter(c => c.pos !== chordInput.pos);
        const chords = trimmed
          ? [...filtered, { chord: trimmed, pos: chordInput.pos }].sort((a, b) => a.pos - b.pos)
          : filtered;
        return { ...l, chords };
      });
      linesRef.current = next;
      return next;
    });
    setChordInput(null);
    markDirty();
  }

  function handleChordInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!chordInput) return;
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commitChordInput(); }
    else if (e.key === 'Escape') setChordInput(null);
    else if (e.key === 'Backspace' && chordInput.value === '' && chordInput.isEdit) {
      setLines(prev => {
        const next = prev.map((l, i) =>
          i === chordInput.lineIndex ? { ...l, chords: l.chords.filter(c => c.pos !== chordInput.pos) } : l
        );
        linesRef.current = next;
        return next;
      });
      setChordInput(null);
      markDirty();
    }
  }

  // ── Arrangement marker input ───────────────────────────────────────────────

  function commitMarkerInput() {
    if (!markerInput) return;
    const trimmed = markerInput.value.trim();
    if (!trimmed) { setMarkerInput(null); return; }

    if (markerInput.mode === 'inline') {
      setLines(prev => {
        const next = prev.map((l, i) =>
          i === markerInput.lineIndex
            ? { ...l, inlineMarkers: [...l.inlineMarkers, { id: '', text: trimmed, charOffset: markerInput.charOffset }] }
            : l
        );
        linesRef.current = next;
        return next;
      });
    } else {
      setStandalones(prev => {
        const next = [...prev, { id: '', text: trimmed, afterLineIndex: markerInput.lineIndex }];
        standalonesRef.current = next;
        return next;
      });
    }
    setMarkerInput(null);
    markDirty();
  }

  function removeInlineMarker(lineIndex: number, charOffset: number) {
    setLines(prev => {
      const next = prev.map((l, i) =>
        i === lineIndex ? { ...l, inlineMarkers: l.inlineMarkers.filter(m => m.charOffset !== charOffset) } : l
      );
      linesRef.current = next;
      return next;
    });
    markDirty();
  }

  function removeStandaloneMarker(marker: StandaloneMarker) {
    setStandalones(prev => {
      const next = prev.filter(m => m !== marker);
      standalonesRef.current = next;
      return next;
    });
    markDirty();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const firstSectionIndex = lines.findIndex(l => isSectionContent(l.content));

  return (
    <div style={{ ...s.screen, display: 'flex', flexDirection: 'column' }}>
      {/* Hidden span — character width measurement */}
      <span
        ref={measureSpanRef}
        aria-hidden="true"
        style={{
          position: 'absolute', visibility: 'hidden', pointerEvents: 'none',
          fontFamily: LYRIC_FONT, fontSize: LYRIC_SIZE, letterSpacing: 0, whiteSpace: 'pre',
        }}
      >m</span>

      {/* Header: ☰  [•] Title  [Save] */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 16px',
        borderBottom: `1px solid ${colors.border}`,
        background: colors.surface, flexShrink: 0,
      }}>
        <span
          style={{ fontSize: '18px', cursor: 'pointer', color: colors.textSecondary }}
          onClick={handleBack}
        >☰</span>
        {isDirty && (
          <span style={{ color: colors.accent, fontSize: '18px', lineHeight: 1, userSelect: 'none' }}>•</span>
        )}
        <span style={{ fontWeight: 600, color: colors.text, flex: 1 }}>{song?.title ?? '…'}</span>
        <button
          onClick={manualSave}
          style={{
            background: 'transparent', border: `1px solid ${colors.border}`,
            color: colors.textSecondary, fontSize: '12px', cursor: 'pointer',
            padding: '3px 10px', borderRadius: '3px',
          }}
        >Save</button>
      </div>

      {/* Arrangement marker input dialog */}
      {markerInput && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)',
          }}
          onClick={() => setMarkerInput(null)}
        >
          <div
            style={{
              background: colors.surface, border: `1px solid ${colors.border}`,
              borderRadius: '6px', padding: '16px 20px', minWidth: '300px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ color: colors.textSecondary, fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {markerInput.mode === 'inline'
                ? `Inline marker at char ${markerInput.charOffset}`
                : 'Standalone marker'}
            </div>
            <input
              autoFocus
              value={markerInput.value}
              placeholder="e.g. Fingerpicked, Full Band, Harmony In"
              onChange={e => setMarkerInput({ ...markerInput, value: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commitMarkerInput(); }
                else if (e.key === 'Escape') setMarkerInput(null);
              }}
              style={{
                display: 'block', width: '100%', boxSizing: 'border-box',
                background: colors.bg, border: `1px solid ${colors.border}`,
                color: colors.text, fontSize: '13px', fontFamily: 'sans-serif',
                padding: '6px 8px', borderRadius: '3px', outline: 'none',
              }}
            />
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setMarkerInput(null)}
                style={{ background: 'transparent', border: `1px solid ${colors.border}`, color: colors.textSecondary, fontSize: '12px', cursor: 'pointer', padding: '4px 12px', borderRadius: '3px' }}
              >Cancel</button>
              <button
                onClick={commitMarkerInput}
                style={{ background: colors.accent, border: 'none', color: '#fff', fontSize: '12px', cursor: 'pointer', padding: '4px 14px', borderRadius: '3px' }}
              >Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Editor canvas */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}
        onClick={() => {
          if (document.activeElement?.tagName !== 'INPUT') {
            lineRefs.current[lines.length - 1]?.focus();
          }
        }}
      >
        {lines.map((line, index) => {
          const isSecLine = isSectionContent(line.content);
          const needsBlankAbove = isSecLine && index !== firstSectionIndex;
          const lineStandalones = standalones.filter(m => m.afterLineIndex === index);

          return (
            <React.Fragment key={line.id}>
              {needsBlankAbove && <div style={{ height: '1em' }} />}

              {isSecLine ? (
                // ── Section tag ──────────────────────────────────────────
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    ref={el => { lineRefs.current[index] = el; }}
                    value={line.content}
                    onChange={e => updateLineContent(index, e.target.value)}
                    onKeyDown={e => handleLineKeyDown(index, e)}
                    style={{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      fontFamily: LYRIC_FONT, fontSize: LYRIC_SIZE,
                      fontWeight: 700, color: colors.accent, padding: 0, lineHeight: '1.6',
                    }}
                  />
                  <span
                    title="Add standalone marker after this line"
                    style={{ color: colors.textSecondary, fontSize: '11px', cursor: 'pointer', paddingLeft: '8px', flexShrink: 0 }}
                    onClick={() => setMarkerInput({ lineIndex: index, mode: 'standalone', charOffset: 0, value: '' })}
                  >+M</span>
                </div>
              ) : (
                // ── Lyric line with chord row ──────────────────────────────
                <div>
                  {/* Chord row — click: add chord • Alt+click: add inline marker */}
                  <div
                    style={{ position: 'relative', height: `${CHORD_ROW_HEIGHT}px`, cursor: 'text', userSelect: 'none' }}
                    title="Click: add chord  •  Alt+click: add inline marker"
                    onClick={e => handleChordRowClick(index, e)}
                  >
                    {line.chords.map(({ chord, pos }) => (
                      <span
                        key={pos}
                        style={{
                          position: 'absolute', left: Math.round(pos * charWidth),
                          fontFamily: LYRIC_FONT, fontSize: CHORD_SIZE,
                          color: colors.accent, fontWeight: 600,
                          lineHeight: `${CHORD_ROW_HEIGHT}px`, cursor: 'text',
                        }}
                        onClick={e => {
                          e.stopPropagation();
                          setChordInput({ lineIndex: index, pos, value: chord, isEdit: true });
                        }}
                      >{chord}</span>
                    ))}
                    {chordInput?.lineIndex === index && (
                      <input
                        autoFocus
                        value={chordInput.value}
                        onChange={e => setChordInput({ ...chordInput, value: e.target.value })}
                        onKeyDown={handleChordInputKeyDown}
                        onBlur={commitChordInput}
                        onClick={e => e.stopPropagation()}
                        style={{
                          position: 'absolute', left: Math.round(chordInput.pos * charWidth),
                          top: 1, width: 64, height: CHORD_ROW_HEIGHT - 2,
                          background: colors.surface, border: `1px solid ${colors.accent}`,
                          color: colors.text, fontFamily: LYRIC_FONT, fontSize: CHORD_SIZE,
                          padding: '0 3px', outline: 'none', zIndex: 1,
                        }}
                      />
                    )}
                  </div>

                  {/* Lyric row with inline marker badges */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    {line.inlineMarkers.map(m => (
                      <span
                        key={m.charOffset}
                        title={`Marker: "${m.text}" — click to remove`}
                        onClick={() => removeInlineMarker(index, m.charOffset)}
                        style={{
                          position: 'absolute',
                          left: Math.round(m.charOffset * charWidth),
                          bottom: 0,
                          background: '#2d3a1e', color: '#8fc46a',
                          border: '1px solid #4a6830',
                          borderRadius: '3px', fontSize: '10px', fontFamily: 'sans-serif',
                          padding: '0 4px', lineHeight: '14px',
                          cursor: 'pointer', zIndex: 1, pointerEvents: 'all',
                          whiteSpace: 'nowrap',
                        }}
                      >◆ {m.text}</span>
                    ))}
                    <input
                      ref={el => { lineRefs.current[index] = el; }}
                      value={line.content}
                      onChange={e => updateLineContent(index, e.target.value)}
                      onKeyDown={e => handleLineKeyDown(index, e)}
                      style={{
                        flex: 1, background: 'transparent', border: 'none', outline: 'none',
                        fontFamily: LYRIC_FONT, fontSize: LYRIC_SIZE,
                        color: colors.text, padding: 0, lineHeight: '1.6',
                      }}
                    />
                    <span
                      title="Add standalone marker after this line"
                      style={{ color: colors.textSecondary, fontSize: '11px', cursor: 'pointer', paddingLeft: '8px', flexShrink: 0 }}
                      onClick={() => setMarkerInput({ lineIndex: index, mode: 'standalone', charOffset: 0, value: '' })}
                    >+M</span>
                  </div>
                </div>
              )}

              {/* Standalone markers after this line */}
              {lineStandalones.map(m => (
                <div
                  key={m.id || `${m.afterLineIndex}-${m.text}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    margin: '2px 0',
                    background: '#1e2a3a', color: '#6aaed4',
                    border: '1px solid #2a4a6a',
                    borderRadius: '4px', fontSize: '11px', fontFamily: 'sans-serif',
                    padding: '2px 8px',
                  }}
                >
                  <span>◆ {m.text}</span>
                  <span
                    onClick={() => removeStandaloneMarker(m)}
                    style={{ cursor: 'pointer', color: colors.textSecondary, fontSize: '12px' }}
                  >×</span>
                </div>
              ))}
            </React.Fragment>
          );
        })}

        {/* Bottom area: click to add/focus last line */}
        <div
          style={{ height: '120px' }}
          onClick={e => {
            e.stopPropagation();
            const last = lines[lines.length - 1];
            if (last.content === '') {
              lineRefs.current[lines.length - 1]?.focus();
            } else {
              const next = newLine();
              setLines(prev => {
                const updated = [...prev, next];
                linesRef.current = updated;
                return updated;
              });
              setTimeout(() => lineRefs.current[lines.length]?.focus(), 0);
            }
          }}
        />
      </div>
    </div>
  );
}
