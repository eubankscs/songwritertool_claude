import React, { useEffect, useState, useRef, useCallback } from 'react';
import { colors, s } from '../styles';
import type { Song, ContentBlock, ContentBlockType, ArrangementMarker, Note, Annotation, Tag, ReviewQueueItem } from '../../shared/schema';
import type { PersistWorkingSyncPayload } from '../../shared/api';
import { NotesSidePanel } from '../components/NotesSidePanel';
import { ReviewQueuePanel } from '../components/ReviewQueuePanel';
import { ManageTagsModal } from '../components/ManageTagsModal';
import { SettingsModal } from '../components/SettingsModal';
import { MoveToProjectModal } from '../components/MoveToProjectModal';
import { PrintDialog, type PrintMode } from '../components/PrintDialog';
import { InputDialog } from '../components/Dialog';

// ── Types ────────────────────────────────────────────────────────────────────────────

interface ChordEntry {
  chord: string;
  pos: number;
}

interface InlineMarker {
  id: string;
  text: string;
  charOffset: number;
}

interface StandaloneMarker {
  id: string;
  text: string;
  afterLineIndex: number;
}

interface EditorLine {
  id: string;
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

interface AnnotationModalState {
  mode: 'create' | 'edit';
  lineIndex: number;
  startChar: number;
  endChar: number;
  existing?: Annotation;
  body: string;
  tagId: string | null;
}

// ── Pure helpers ───────────────────────────────────────────────────────────────────────────────

function isSectionContent(content: string): boolean {
  return /^\[.+\]$/.test(content.trim());
}

let tmpCounter = 0;
function newLine(content = ''): EditorLine {
  return { id: `tmp-${++tmpCounter}`, content, chords: [], inlineMarkers: [] };
}

function isValidChord(chord: string): boolean {
  return /^[A-G][b#]?[a-z0-9#+()/ ]*$/i.test(chord.trim());
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
      i++;
    }
  }
  return result.length > 0 ? result : [newLine()];
}

function attachMarkers(
  lines: EditorLine[],
  markers: ArrangementMarker[],
  blocks: ContentBlock[]
): { updatedLines: EditorLine[]; standalones: StandaloneMarker[] } {
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

function computeLinePositions(lines: EditorLine[]): Map<number, number> {
  const map = new Map<number, number>();
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    if (isSectionContent(lines[i].content)) {
      map.set(i, pos++);
    } else {
      if (lines[i].chords.length > 0) pos++;
      map.set(i, pos++);
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

// ── Component ───────────────────────────────────────────────────────────────────────────────

interface Props {
  songId: string;
  onBack: () => void;
}

const LYRIC_FONT = 'monospace';
const LYRIC_SIZE = '14px';
const CHORD_SIZE = '12px';
const CHORD_ROW_HEIGHT = 20;
const DEBOUNCE_MS = 2000;

const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm']);
const SHARP_KEYS = new Set(['G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m']);

export function EditorScreen({ songId, onBack }: Props): React.ReactElement {
  // ── Core editor state ───────────────────────────────────────────────────────────────────
  const [song, setSong] = useState<Song | null>(null);
  const [workingVersionId, setWorkingVersionId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [lines, setLines] = useState<EditorLine[]>([newLine()]);
  const [standalones, setStandalones] = useState<StandaloneMarker[]>([]);
  const [charWidth, setCharWidth] = useState(8.41);
  const [chordInput, setChordInput] = useState<ChordInputState | null>(null);
  const [markerInput, setMarkerInput] = useState<MarkerInputState | null>(null);
  const [capo, setCapo] = useState<number | null>(null);
  const [concertKey, setConcertKey] = useState<string | null>(null);
  const [focusedLineIndex, setFocusedLineIndex] = useState(0);

  // ── Phase 4 state ────────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState<Note[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewQueueItem[]>([]);
  const [activePanel, setActivePanel] = useState<'notes' | 'reviewQueue' | null>(null);
  const [annotationModal, setAnnotationModal] = useState<AnnotationModalState | null>(null);
  const [selection, setSelection] = useState<{ lineIndex: number; startChar: number; endChar: number } | null>(null);
  const [showHamburger, setShowHamburger] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showManageTags, setShowManageTags] = useState(false);
  const [annTooltip, setAnnTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  // ── Phase 5 state ────────────────────────────────────────────────────────────────────
  const [showMoveToProject, setShowMoveToProject] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode | null>(null);
  const [variantDialog, setVariantDialog] = useState<'create' | 'saveAs' | null>(null);
  const [variantError, setVariantError] = useState('');

  // ── Refs ─────────────────────────────────────────────────────────────────────────────
  const measureSpanRef = useRef<HTMLSpanElement>(null);
  const lineRefs = useRef<(HTMLInputElement | null)[]>([]);
  const pendingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workingVersionIdRef = useRef<string | null>(null);
  const linesRef = useRef<EditorLine[]>(lines);
  const standalonesRef = useRef<StandaloneMarker[]>([]);
  const reviewItemsRef = useRef<ReviewQueueItem[]>([]);
  const tagsRef = useRef<Tag[]>([]);
  const concertKeyRef = useRef<string | null>(null);

  useEffect(() => { workingVersionIdRef.current = workingVersionId; }, [workingVersionId]);
  useEffect(() => { linesRef.current = lines; }, [lines]);
  useEffect(() => { standalonesRef.current = standalones; }, [standalones]);
  useEffect(() => { reviewItemsRef.current = reviewItems; }, [reviewItems]);
  useEffect(() => { tagsRef.current = tags; }, [tags]);
  useEffect(() => { concertKeyRef.current = concertKey; }, [concertKey]);

  // ── Measure character width ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (measureSpanRef.current) setCharWidth(measureSpanRef.current.getBoundingClientRect().width);
  }, []);

  // ── Focus first line after load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => lineRefs.current[0]?.focus(), 80);
    return () => clearTimeout(t);
  }, [song]);

  // ── Load all song data ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      window.songwriterAPI.songs.touchLastOpened(songId);
      const [loadedSong, allTags] = await Promise.all([
        window.songwriterAPI.songs.getById(songId),
        window.songwriterAPI.tags.getAll(),
      ]);
      if (cancelled) return;
      setSong(loadedSong ?? null);
      setTags(allTags);
      tagsRef.current = allTags;

      const [versions, loadedNotes, loadedAnnotations, loadedReviewItems] = await Promise.all([
        window.songwriterAPI.songVersions.getBySong(songId),
        window.songwriterAPI.notes.getBySong(songId),
        window.songwriterAPI.annotations.getBySong(songId),
        window.songwriterAPI.reviewQueue.getBySong(songId),
      ]);
      if (cancelled) return;

      setNotes(loadedNotes);
      setAnnotations(loadedAnnotations);
      setReviewItems(loadedReviewItems);
      reviewItemsRef.current = loadedReviewItems;

      const working = versions.find(v => v.type === 'working') ?? null;
      const saved = versions.find(v => v.type === 'saved') ?? null;
      const loadFrom = working ?? saved;

      setWorkingVersionId(working?.id ?? null);
      workingVersionIdRef.current = working?.id ?? null;
      setIsDirty(!!working);

      if (loadFrom) {
        setCapo(loadFrom.capo);
        setConcertKey(loadFrom.concertKey);
        concertKeyRef.current = loadFrom.concertKey;

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

  // ── Review queue helpers ────────────────────────────────────────────────────────────────────────
  const refreshReviewQueue = useCallback(async () => {
    const items = await window.songwriterAPI.reviewQueue.getBySong(songId);
    setReviewItems(items);
    reviewItemsRef.current = items;
  }, [songId]);

  const refreshNotes = useCallback(async () => {
    const n = await window.songwriterAPI.notes.getBySong(songId);
    setNotes(n);
  }, [songId]);

  const refreshAnnotations = useCallback(async () => {
    const a = await window.songwriterAPI.annotations.getBySong(songId);
    setAnnotations(a);
  }, [songId]);

  const refreshTags = useCallback(async () => {
    const t = await window.songwriterAPI.tags.getAll();
    setTags(t);
    tagsRef.current = t;
  }, []);

  // ── Review Queue trigger checks ───────────────────────────────────────────────────────────────────
  function hasActiveItem(type: string, message: string): boolean {
    return reviewItemsRef.current.some(i => i.type === type && i.message === message);
  }

  const checkUnknownChord = useCallback(async (chord: string, lineIndex: number) => {
    if (isValidChord(chord)) return;
    const msg = `Unknown chord: "${chord}"`;
    if (!hasActiveItem('unknown-chord', msg)) {
      await window.songwriterAPI.reviewQueue.create(songId, 'unknown-chord', msg, String(lineIndex));
      refreshReviewQueue();
    }
  }, [songId, refreshReviewQueue]);

  const checkSectionTriggers = useCallback(async (currentLines: EditorLine[]) => {
    const counts = new Map<string, number>();
    for (const line of currentLines) {
      if (isSectionContent(line.content)) {
        const name = line.content.trim();
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    for (const [name, count] of counts) {
      if (count > 1) {
        const msg = `Section ${name} appears ${count} times`;
        if (!hasActiveItem('section-conflict', msg)) {
          await window.songwriterAPI.reviewQueue.create(songId, 'section-conflict', msg, null);
        }
      }
    }

    const sectionContent = new Map<string, string[]>();
    let curSection: string | null = null;
    let curContent = '';
    for (const line of currentLines) {
      if (isSectionContent(line.content)) {
        if (curSection !== null) {
          if (!sectionContent.has(curSection)) sectionContent.set(curSection, []);
          sectionContent.get(curSection)!.push(curContent);
        }
        curSection = line.content.trim();
        curContent = '';
      } else {
        curContent += line.content + '|' + JSON.stringify(line.chords) + '\n';
      }
    }
    if (curSection !== null) {
      if (!sectionContent.has(curSection)) sectionContent.set(curSection, []);
      sectionContent.get(curSection)!.push(curContent);
    }
    for (const [name, contents] of sectionContent) {
      if (contents.length > 1 && !contents.every(c => c === contents[0])) {
        const msg = `Section ${name} has diverging content`;
        if (!hasActiveItem('broken-section-link', msg)) {
          await window.songwriterAPI.reviewQueue.create(songId, 'broken-section-link', msg, null);
        }
      }
    }
    refreshReviewQueue();
  }, [songId, refreshReviewQueue]);

  const checkAmbiguousTranspose = useCallback(async (key: string | null, currentLines: EditorLine[]) => {
    if (!key) return;
    const isFlat = FLAT_KEYS.has(key);
    const isSharp = SHARP_KEYS.has(key);
    if (!isFlat && !isSharp) return;

    for (const line of currentLines) {
      for (const { chord } of line.chords) {
        const acc = chord.match(/^[A-G]([b#]?)/)?.[1] ?? '';
        let msg = '';
        if (isFlat && acc === '#') {
          msg = `Chord "${chord}" uses sharp notation in flat key (${key})`;
        } else if (isSharp && acc === 'b') {
          msg = `Chord "${chord}" uses flat notation in sharp key (${key})`;
        }
        if (msg && !hasActiveItem('ambiguous-transpose', msg)) {
          await window.songwriterAPI.reviewQueue.create(songId, 'ambiguous-transpose', msg, null);
        }
      }
    }
    refreshReviewQueue();
  }, [songId, refreshReviewQueue]);

  const checkPlaceholderLyric = useCallback(async (tagId: string | null) => {
    if (!tagId) return;
    const tag = tagsRef.current.find(t => t.id === tagId);
    if (!tag?.createsReviewItem) return;
    const msg = `Placeholder lyric: tag "${tag.name}" applied`;
    if (!hasActiveItem('placeholder-lyric', msg)) {
      await window.songwriterAPI.reviewQueue.create(songId, 'placeholder-lyric', msg, null);
      refreshReviewQueue();
    }
  }, [songId, refreshReviewQueue]);

  function runTriggerChecks(currentLines: EditorLine[]) {
    checkSectionTriggers(currentLines);
    checkAmbiguousTranspose(concertKeyRef.current, currentLines);
  }

  // ── Persistence ──────────────────────────────────────────────────────────────────────────────────
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

    await window.songwriterAPI.songVersions.updateMeta(svId, capo, concertKey);

    await window.songwriterAPI.songVersions.deleteWorking(songId);

    setWorkingVersionId(null);
    workingVersionIdRef.current = null;
    setIsDirty(false);
    pendingRef.current = false;
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
  }, [songId, capo, concertKey]);

  useEffect(() => {
    const onBlur = () => { if (pendingRef.current) flushAutoSave(); };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [flushAutoSave]);

  useEffect(() => {
    function onBeforeUnload() {
      if (!pendingRef.current) return;
      const vid = workingVersionIdRef.current;
      const { blocks, inlineMarkers, standaloneMarkers } = buildSyncPayload(
        linesRef.current, standalonesRef.current
      );
      window.songwriterAPI.songs.persistWorkingSync({
        versionId: vid, songId, blocks, inlineMarkers, standaloneMarkers,
      });
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [songId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); manualSave(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [manualSave]);

  async function handleBack() {
    await flushAutoSave();
    onBack();
  }

  // ── Edit helpers ─────────────────────────────────────────────────────────────────────────────
  function markDirty(currentLines?: EditorLine[]) {
    setIsDirty(true);
    scheduleAutoSave();
    runTriggerChecks(currentLines ?? linesRef.current);
  }

  function updateLineContent(index: number, content: string) {
    setLines(prev => {
      const next = prev.map((l, i) => i === index ? { ...l, content } : l);
      linesRef.current = next;
      markDirty(next);
      return next;
    });
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

  // ── Chord input ─────────────────────────────────────────────────────────────────────────────
  function handleChordRowClick(lineIndex: number, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pos = Math.round(x / charWidth);

    if (e.altKey) {
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
    if (trimmed) {
      markDirty();
      checkUnknownChord(trimmed, chordInput.lineIndex);
    }
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

  // ── Arrangement marker input ───────────────────────────────────────────────────────────────────
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

  // ── Annotation helpers ───────────────────────────────────────────────────────────────────────────
  function getAnnotationsForLine(lineIndex: number): Array<{ ann: Annotation; startChar: number; endChar: number; color: string | null }> {
    const prefix = `${lineIndex}:`;
    return annotations
      .filter(a => a.targetRange.startsWith(prefix))
      .map(a => {
        const parts = a.targetRange.split(':');
        const startChar = parseInt(parts[1] ?? '0', 10);
        const endChar = parseInt(parts[2] ?? '0', 10);
        const tag = tags.find(t => t.id === a.tagId);
        return { ann: a, startChar, endChar, color: tag?.color ?? null };
      })
      .filter(x => !isNaN(x.startChar) && !isNaN(x.endChar) && x.endChar > x.startChar);
  }

  function handleLyricMouseUp(lineIndex: number, e: React.MouseEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    if (end > start) {
      setSelection({ lineIndex, startChar: start, endChar: end });
    } else {
      setSelection(null);
    }
  }

  async function openAnnotationForSelection() {
    if (!selection) return;
    const { lineIndex, startChar, endChar } = selection;
    const targetRange = `${lineIndex}:${startChar}:${endChar}`;
    const existing = await window.songwriterAPI.annotations.getByRange(songId, targetRange);
    setAnnotationModal({
      mode: existing ? 'edit' : 'create',
      lineIndex, startChar, endChar,
      existing,
      body: existing?.body ?? '',
      tagId: existing?.tagId ?? null,
    });
    setSelection(null);
  }

  async function saveAnnotation() {
    if (!annotationModal) return;
    const { lineIndex, startChar, endChar, existing, body, tagId } = annotationModal;
    const targetRange = `${lineIndex}:${startChar}:${endChar}`;
    const trimmedBody = body.trim();
    if (!trimmedBody) return;

    if (existing) {
      await window.songwriterAPI.annotations.update(existing.id, trimmedBody, tagId);
    } else {
      await window.songwriterAPI.annotations.create(songId, targetRange, trimmedBody, tagId);
    }
    await checkPlaceholderLyric(tagId);
    setAnnotationModal(null);
    refreshAnnotations();
  }

  async function deleteAnnotation() {
    if (!annotationModal?.existing) return;
    await window.songwriterAPI.annotations.delete(annotationModal.existing.id);
    setAnnotationModal(null);
    refreshAnnotations();
  }

  function openAnnotationForExisting(ann: Annotation, lineIndex: number, startChar: number, endChar: number) {
    setAnnotationModal({
      mode: 'edit',
      lineIndex, startChar, endChar,
      existing: ann,
      body: ann.body,
      tagId: ann.tagId,
    });
  }

  // ── Manual flag ──────────────────────────────────────────────────────────────────────────
  async function flagLineForReview(lineIndex: number) {
    const line = linesRef.current[lineIndex];
    const preview = line.content.substring(0, 40);
    const msg = `Manual review flag: "${preview}${line.content.length > 40 ? '…' : ''}"`;
    await window.songwriterAPI.reviewQueue.create(songId, 'manual-flag', msg, String(lineIndex));
    refreshReviewQueue();
  }

  // ── Capo / key ──────────────────────────────────────────────────────────────────────────
  function handleKeyChange(value: string) {
    const newKey = value.trim() || null;
    setConcertKey(newKey);
    concertKeyRef.current = newKey;
    setIsDirty(true);
    scheduleAutoSave();
    checkAmbiguousTranspose(newKey, linesRef.current);
  }

  function handleCapoChange(value: string) {
    const n = parseInt(value, 10);
    const newCapo = isNaN(n) || value === '' ? null : n;
    setCapo(newCapo);
    setIsDirty(true);
    scheduleAutoSave();
  }

  // ── Jump to review item ──────────────────────────────────────────────────────────────────────
  function jumpToReviewTarget(targetId: string | null) {
    if (!targetId) return;
    const lineIndex = parseInt(targetId, 10);
    if (!isNaN(lineIndex) && lineIndex >= 0 && lineIndex < lines.length) {
      lineRefs.current[lineIndex]?.focus();
      lineRefs.current[lineIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ── Phase 5: Variant / Move handlers ─────────────────────────────────────────────────────
  async function handleCreateVariant(title: string) {
    const trimmed = title.trim();
    if (!trimmed) { setVariantError('Title is required.'); return; }
    if (!song) return;
    const collides = await window.songwriterAPI.songs.checkTitleInProject(trimmed, song.projectId);
    if (collides) { setVariantError(`"${trimmed}" already exists in this project.`); return; }
    await window.songwriterAPI.songs.createVariant(songId, trimmed, song.projectId);
    setVariantDialog(null);
    setVariantError('');
    setIsDirty(false);
  }

  async function handleSaveAsVariant(title: string) {
    const trimmed = title.trim();
    if (!trimmed) { setVariantError('Title is required.'); return; }
    if (!song) return;
    const collides = await window.songwriterAPI.songs.checkTitleInProject(trimmed, song.projectId);
    if (collides) { setVariantError(`"${trimmed}" already exists in this project.`); return; }
    await window.songwriterAPI.songs.saveAsVariant(songId, trimmed, song.projectId);
    setVariantDialog(null);
    setVariantError('');
    setWorkingVersionId(null);
    setIsDirty(false);
  }

  // ── Derived values ─────────────────────────────────────────────────────────────────────────────
  const firstSectionIndex = lines.findIndex(l => isSectionContent(l.content));
  const noteCount = notes.length;
  const queueCount = reviewItems.length;

  const lineContexts = lines.map((l, i) => ({
    lineIndex: i,
    content: l.content,
    isSection: isSectionContent(l.content),
  }));

  // ── Render ──────────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ ...s.screen, display: 'flex', flexDirection: 'column' }}>
      {/* Hidden char-width measurement span */}
      <span
        ref={measureSpanRef}
        aria-hidden="true"
        style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', fontFamily: LYRIC_FONT, fontSize: LYRIC_SIZE, letterSpacing: 0, whiteSpace: 'pre' }}
      >m</span>

      {/* ── Header ──────────────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: `1px solid ${colors.border}`, background: colors.surface, flexShrink: 0, position: 'relative' }}>
        {/* Hamburger */}
        <span
          style={{ fontSize: '18px', cursor: 'pointer', color: colors.textSecondary, userSelect: 'none' }}
          onClick={() => setShowHamburger(h => !h)}
        >☰</span>

        {/* Hamburger dropdown */}
        {showHamburger && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setShowHamburger(false)} />
            <div style={{ position: 'absolute', top: '40px', left: '12px', zIndex: 51, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '6px', minWidth: '200px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
              {([
                { label: 'Home', action: () => handleBack() },
                { label: 'Settings', action: () => setShowSettings(true) },
                null,
                { label: 'Move To Project…', action: () => setShowMoveToProject(true) },
                { label: 'Create Variant…', action: () => { setVariantError(''); setVariantDialog('create'); } },
                ...(isDirty ? [{ label: 'Save Working Copy As Variant…', action: () => { setVariantError(''); setVariantDialog('saveAs'); } }] : []),
                null,
                { label: 'Print Chart…', action: () => setPrintMode('chart') },
                { label: 'Print With Comments…', action: () => setPrintMode('withComments') },
              ] as Array<{ label: string; action: () => void } | null>).map((item, i) => {
                if (!item) return <div key={`sep-${i}`} style={{ borderTop: `1px solid ${colors.border}`, margin: '4px 0' }} />;
                return (
                  <div
                    key={item.label}
                    onClick={() => { setShowHamburger(false); item.action(); }}
                    style={{ padding: '9px 14px', color: colors.text, fontSize: '13px', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = colors.surfaceHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >{item.label}</div>
                );
              })}
            </div>
          </>
        )}

        {isDirty && (
          <span style={{ color: colors.accent, fontSize: '18px', lineHeight: 1, userSelect: 'none' }}>•</span>
        )}
        <span style={{ fontWeight: 600, color: colors.text, flex: 1 }}>{song?.title ?? '…'}</span>
        <button
          onClick={manualSave}
          style={{ background: 'transparent', border: `1px solid ${colors.border}`, color: colors.textSecondary, fontSize: '12px', cursor: 'pointer', padding: '3px 10px', borderRadius: '3px' }}
        >Save</button>
      </div>

      {/* Capo / key row */}
      <div style={{ display: 'flex', gap: '16px', padding: '6px 16px', background: colors.surface, borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.textSecondary }}>
          Capo
          <input
            type="number"
            min={0} max={12}
            value={capo ?? ''}
            onChange={e => handleCapoChange(e.target.value)}
            placeholder="—"
            style={{ background: 'transparent', border: 'none', borderBottom: `1px solid ${colors.border}`, color: colors.text, fontSize: '12px', width: '36px', outline: 'none', textAlign: 'center', padding: '1px 0' }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.textSecondary }}>
          Key
          <input
            type="text"
            value={concertKey ?? ''}
            onChange={e => handleKeyChange(e.target.value)}
            placeholder="—"
            style={{ background: 'transparent', border: 'none', borderBottom: `1px solid ${colors.border}`, color: colors.text, fontSize: '12px', width: '48px', outline: 'none', padding: '1px 0' }}
          />
        </label>
      </div>

      {/* ── Arrangement marker dialog ──────────────────────────────────────────────────────────────────────── */}
      {markerInput && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }} onClick={() => setMarkerInput(null)}>
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '6px', padding: '16px 20px', minWidth: '300px' }} onClick={e => e.stopPropagation()}>
            <div style={{ color: colors.textSecondary, fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {markerInput.mode === 'inline' ? `Inline marker at char ${markerInput.charOffset}` : 'Standalone marker'}
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
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text, fontSize: '13px', fontFamily: 'sans-serif', padding: '6px 8px', borderRadius: '3px', outline: 'none' }}
            />
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setMarkerInput(null)} style={{ background: 'transparent', border: `1px solid ${colors.border}`, color: colors.textSecondary, fontSize: '12px', cursor: 'pointer', padding: '4px 12px', borderRadius: '3px' }}>Cancel</button>
              <button onClick={commitMarkerInput} style={{ background: colors.accent, border: 'none', color: '#fff', fontSize: '12px', cursor: 'pointer', padding: '4px 14px', borderRadius: '3px' }}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Annotation modal ───────────────────────────────────────────────────────────────────────────────── */}
      {annotationModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }} onClick={() => setAnnotationModal(null)}>
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '6px', padding: '16px 20px', minWidth: '320px', maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div style={{ color: colors.textSecondary, fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {annotationModal.mode === 'edit' ? 'Edit Annotation' : 'New Annotation'}
            </div>
            <textarea
              autoFocus
              value={annotationModal.body}
              onChange={e => setAnnotationModal({ ...annotationModal, body: e.target.value })}
              placeholder="Annotation note…"
              rows={3}
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text, fontSize: '13px', fontFamily: 'inherit', padding: '6px 8px', borderRadius: '3px', outline: 'none', resize: 'vertical' }}
            />
            <div style={{ marginTop: '10px' }}>
              <div style={{ color: colors.textSecondary, fontSize: '11px', marginBottom: '4px' }}>Tag (optional)</div>
              <select
                value={annotationModal.tagId ?? ''}
                onChange={e => setAnnotationModal({ ...annotationModal, tagId: e.target.value || null })}
                style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text, fontSize: '12px', padding: '4px 6px', borderRadius: '3px', outline: 'none', width: '100%' }}
              >
                <option value="">None</option>
                {tags.map(t => (
                  <option key={t.id} value={t.id}>{t.name}{t.createsReviewItem ? ' (RQ)' : ''}</option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
              {annotationModal.mode === 'edit' && (
                <button onClick={deleteAnnotation} style={{ background: 'transparent', border: `1px solid ${colors.danger}`, color: colors.danger, fontSize: '12px', cursor: 'pointer', padding: '4px 12px', borderRadius: '3px', marginRight: 'auto' }}>Delete</button>
              )}
              <button onClick={() => setAnnotationModal(null)} style={{ background: 'transparent', border: `1px solid ${colors.border}`, color: colors.textSecondary, fontSize: '12px', cursor: 'pointer', padding: '4px 12px', borderRadius: '3px' }}>Cancel</button>
              <button onClick={saveAnnotation} style={{ background: colors.accent, border: 'none', color: '#fff', fontSize: '12px', cursor: 'pointer', padding: '4px 14px', borderRadius: '3px' }}>
                {annotationModal.mode === 'edit' ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings / ManageTags modals ───────────────────────────────────────────────────────────────────── */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onManageTags={() => { setShowSettings(false); setShowManageTags(true); }}
        />
      )}
      {showManageTags && (
        <ManageTagsModal
          tags={tags}
          onClose={() => setShowManageTags(false)}
          onTagsChanged={refreshTags}
        />
      )}

      {/* ── Phase 5 modals ──────────────────────────────────────────────────────────────────────────────── */}
      {showMoveToProject && song && (
        <MoveToProjectModal
          songId={songId}
          songTitle={song.title}
          currentProjectId={song.projectId}
          onClose={() => setShowMoveToProject(false)}
          onMoved={() => { setShowMoveToProject(false); setIsDirty(false); onBack(); }}
        />
      )}
      {printMode && song && (
        <PrintDialog
          mode={printMode}
          songTitle={song.title}
          lines={lines}
          standalones={standalones}
          annotations={annotations}
          capo={capo}
          concertKey={concertKey}
          onClose={() => setPrintMode(null)}
        />
      )}
      {variantDialog === 'create' && (
        <InputDialog
          title="Create Variant"
          placeholder="Variant title"
          confirmLabel="Create"
          onConfirm={handleCreateVariant}
          onCancel={() => { setVariantDialog(null); setVariantError(''); }}
          error={variantError}
        />
      )}
      {variantDialog === 'saveAs' && (
        <InputDialog
          title="Save Working Copy As Variant"
          placeholder="Variant title"
          confirmLabel="Save As Variant"
          onConfirm={handleSaveAsVariant}
          onCancel={() => { setVariantDialog(null); setVariantError(''); }}
          error={variantError}
        />
      )}

      {/* ── Annotation tooltip ─────────────────────────────────────────────────────────────────────────────────────── */}
      {annTooltip && (
        <div style={{ position: 'fixed', left: annTooltip.x + 12, top: annTooltip.y - 4, zIndex: 200, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '4px', padding: '4px 8px', maxWidth: '240px', fontSize: '12px', color: colors.text, pointerEvents: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
          {annTooltip.text}
        </div>
      )}

      {/* ── Body: canvas + optional side panel ────────────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Canvas */}
        <div
          style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', minWidth: 0 }}
          onClick={() => {
            if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
              lineRefs.current[lines.length - 1]?.focus();
            }
          }}
        >
          {/* Annotate button (appears when text is selected) */}
          {selection && (
            <div style={{ marginBottom: '8px' }}>
              <button
                onClick={openAnnotationForSelection}
                style={{ background: colors.accent, border: 'none', color: '#fff', fontSize: '11px', cursor: 'pointer', padding: '3px 10px', borderRadius: '3px' }}
              >📌 Annotate selection (line {selection.lineIndex}, chars {selection.startChar}–{selection.endChar})</button>
              <span
                onClick={() => setSelection(null)}
                style={{ marginLeft: '6px', color: colors.textSecondary, fontSize: '11px', cursor: 'pointer' }}
              >✕</span>
            </div>
          )}

          {lines.map((line, index) => {
            const isSecLine = isSectionContent(line.content);
            const needsBlankAbove = isSecLine && index !== firstSectionIndex;
            const lineStandalones = standalones.filter(m => m.afterLineIndex === index);
            const lineAnns = isSecLine ? [] : getAnnotationsForLine(index);

            return (
              <React.Fragment key={line.id}>
                {needsBlankAbove && <div style={{ height: '1em' }} />}

                {isSecLine ? (
                  // ── Section tag ──────────────────────────────────────────────────────────────────────────
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      ref={el => { lineRefs.current[index] = el; }}
                      value={line.content}
                      onChange={e => updateLineContent(index, e.target.value)}
                      onKeyDown={e => handleLineKeyDown(index, e)}
                      onFocus={() => setFocusedLineIndex(index)}
                      style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: LYRIC_FONT, fontSize: LYRIC_SIZE, fontWeight: 700, color: colors.accent, padding: 0, lineHeight: '1.6' }}
                    />
                    <span
                      title="Add standalone marker after this line"
                      style={{ color: colors.textSecondary, fontSize: '11px', cursor: 'pointer', paddingLeft: '6px', flexShrink: 0 }}
                      onClick={() => setMarkerInput({ lineIndex: index, mode: 'standalone', charOffset: 0, value: '' })}
                    >+M</span>
                    <span
                      title="Flag for review"
                      style={{ color: colors.textSecondary, fontSize: '11px', cursor: 'pointer', paddingLeft: '6px', flexShrink: 0 }}
                      onClick={() => flagLineForReview(index)}
                    >⚑</span>
                  </div>
                ) : (
                  // ── Lyric line with chord row ───────────────────────────────────────────────────────────────────────────
                  <div>
                    {/* Chord row */}
                    <div
                      style={{ position: 'relative', height: `${CHORD_ROW_HEIGHT}px`, cursor: 'text', userSelect: 'none' }}
                      title="Click: add chord  •  Alt+click: add inline marker"
                      onClick={e => handleChordRowClick(index, e)}
                    >
                      {line.chords.map(({ chord, pos }) => (
                        <span
                          key={pos}
                          style={{ position: 'absolute', left: Math.round(pos * charWidth), fontFamily: LYRIC_FONT, fontSize: CHORD_SIZE, color: colors.accent, fontWeight: 600, lineHeight: `${CHORD_ROW_HEIGHT}px`, cursor: 'text' }}
                          onClick={e => { e.stopPropagation(); setChordInput({ lineIndex: index, pos, value: chord, isEdit: true }); }}
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
                          style={{ position: 'absolute', left: Math.round(chordInput.pos * charWidth), top: 1, width: 64, height: CHORD_ROW_HEIGHT - 2, background: colors.surface, border: `1px solid ${colors.accent}`, color: colors.text, fontFamily: LYRIC_FONT, fontSize: CHORD_SIZE, padding: '0 3px', outline: 'none', zIndex: 1 }}
                        />
                      )}
                    </div>

                    {/* Lyric row with inline markers + annotation underlines */}
                    <div
                      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                      onMouseMove={e => {
                        if (lineAnns.length === 0) { setAnnTooltip(null); return; }
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const charPos = Math.floor(x / charWidth);
                        const hit = lineAnns.find(a => a.startChar <= charPos && charPos < a.endChar);
                        if (hit) setAnnTooltip({ text: hit.ann.body, x: e.clientX, y: e.clientY });
                        else setAnnTooltip(null);
                      }}
                      onMouseLeave={() => setAnnTooltip(null)}
                    >
                      {/* Annotation underlines */}
                      {lineAnns.map(({ ann, startChar, endChar, color }) => (
                        <div
                          key={ann.id}
                          onClick={() => openAnnotationForExisting(ann, index, startChar, endChar)}
                          style={{ position: 'absolute', left: Math.round(startChar * charWidth), width: Math.round((endChar - startChar) * charWidth), bottom: 1, height: 2, background: color ?? '#888', cursor: 'pointer', zIndex: 0, pointerEvents: 'all' }}
                        />
                      ))}
                      {/* Inline marker badges */}
                      {line.inlineMarkers.map(m => (
                        <span
                          key={m.charOffset}
                          title={`Marker: "${m.text}" — click to remove`}
                          onClick={() => removeInlineMarker(index, m.charOffset)}
                          style={{ position: 'absolute', left: Math.round(m.charOffset * charWidth), bottom: 0, background: '#2d3a1e', color: '#8fc46a', border: '1px solid #4a6830', borderRadius: '3px', fontSize: '10px', fontFamily: 'sans-serif', padding: '0 4px', lineHeight: '14px', cursor: 'pointer', zIndex: 1, pointerEvents: 'all', whiteSpace: 'nowrap' }}
                        >◆ {m.text}</span>
                      ))}
                      {/* Lyric input */}
                      <input
                        ref={el => { lineRefs.current[index] = el; }}
                        value={line.content}
                        onChange={e => updateLineContent(index, e.target.value)}
                        onKeyDown={e => handleLineKeyDown(index, e)}
                        onFocus={() => setFocusedLineIndex(index)}
                        onMouseUp={e => handleLyricMouseUp(index, e)}
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: LYRIC_FONT, fontSize: LYRIC_SIZE, color: colors.text, padding: 0, lineHeight: '1.6', position: 'relative', zIndex: 1 }}
                      />
                      <span
                        title="Add standalone marker after this line"
                        style={{ color: colors.textSecondary, fontSize: '11px', cursor: 'pointer', paddingLeft: '6px', flexShrink: 0 }}
                        onClick={() => setMarkerInput({ lineIndex: index, mode: 'standalone', charOffset: 0, value: '' })}
                      >+M</span>
                      <span
                        title="Flag for review"
                        style={{ color: colors.textSecondary, fontSize: '11px', cursor: 'pointer', paddingLeft: '4px', flexShrink: 0 }}
                        onClick={() => flagLineForReview(index)}
                      >⚑</span>
                    </div>
                  </div>
                )}

                {/* Standalone markers after this line */}
                {lineStandalones.map(m => (
                  <div
                    key={m.id || `${m.afterLineIndex}-${m.text}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', margin: '2px 0', background: '#1e2a3a', color: '#6aaed4', border: '1px solid #2a4a6a', borderRadius: '4px', fontSize: '11px', fontFamily: 'sans-serif', padding: '2px 8px' }}
                  >
                    <span>◆ {m.text}</span>
                    <span onClick={() => removeStandaloneMarker(m)} style={{ cursor: 'pointer', color: colors.textSecondary, fontSize: '12px' }}>&times;</span>
                  </div>
                ))}
              </React.Fragment>
            );
          })}

          {/* Bottom click area */}
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

        {/* ── Side panel ────────────────────────────────────────────────────────────────────────────────────── */}
        {activePanel === 'notes' && (
          <NotesSidePanel
            songId={songId}
            notes={notes}
            lines={lineContexts}
            focusedLineIndex={focusedLineIndex}
            onClose={() => setActivePanel(null)}
            onNotesChanged={refreshNotes}
          />
        )}
        {activePanel === 'reviewQueue' && (
          <ReviewQueuePanel
            items={reviewItems}
            onClose={() => setActivePanel(null)}
            onItemsChanged={refreshReviewQueue}
            onJumpTo={jumpToReviewTarget}
          />
        )}
      </div>

      {/* ── Bottom-right utility icons ─────────────────────────────────────────────────────────────────────────────────── */}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 40 }}>
        {noteCount > 0 && (
          <button
            onClick={() => setActivePanel(p => p === 'notes' ? null : 'notes')}
            title="Song Notes"
            style={{ background: activePanel === 'notes' ? colors.accent : colors.surface, border: `1px solid ${activePanel === 'notes' ? colors.accent : colors.border}`, color: activePanel === 'notes' ? '#fff' : colors.textSecondary, borderRadius: '50%', width: '40px', height: '40px', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
          >
            📝
            <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: colors.accent, color: '#fff', fontSize: '10px', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{noteCount}</span>
          </button>
        )}
        {queueCount > 0 && (
          <button
            onClick={() => setActivePanel(p => p === 'reviewQueue' ? null : 'reviewQueue')}
            title="Review Queue"
            style={{ background: activePanel === 'reviewQueue' ? colors.accent : colors.surface, border: `1px solid ${activePanel === 'reviewQueue' ? colors.accent : colors.border}`, color: activePanel === 'reviewQueue' ? '#fff' : colors.textSecondary, borderRadius: '50%', width: '40px', height: '40px', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
          >
            ⚠
            <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: colors.danger, color: '#fff', fontSize: '10px', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{queueCount}</span>
          </button>
        )}
      </div>
    </div>
  );
}
