Songwriting Tool — Phased Implementation Plan
Companion to Master Specification V6.4 — For Use With AI Coding Tools
# Purpose
This document sequences the build of the songwriting tool described in Master Specification V6.4 into five phases, each ending in a stop-and-review checkpoint. It is intended to be handed to an AI coding tool (e.g. Claude Code, Codex) alongside the spec, one phase at a time, rather than handing off the entire spec as a single build task.

# Why Phase the Build
- Isolates the highest-risk subsystem (chord and arrangement marker character-position rendering) before later phases depend on it.
- Creates natural checkpoints for comparing output across multiple AI coding tools before divergence compounds.
- Surfaces schema or interpretation errors early, when they are cheap to correct, rather than after multiple phases are built on top of them.
- Follows the dependency order already implicit in the spec's own structure.

# How to Use This Document
- Hand the AI coding tool the Master Spec V6.4 in full, plus only the current phase's section of this document.
- At each phase's Stop and Review checkpoint, validate against the listed review checklist before proceeding.
- Do not proceed to the next phase until the current phase's checklist passes.
- If a tool invents behavior not covered by the spec during a phase, treat it as a signal to amend the spec, not just the code.

# Phase 1 — Foundation
## Build
- Electron shell
- React app shell
- SQLite integration
- Schema and migrations (Spec Section 2)
- Core data models matching schema tables
- Repository / data-access layer (CRUD operations for each table)

## Spec Sections Referenced
Section 1 (Platform / Tech Stack), Section 2 (Database Schema).

## Stop and Review Checklist
- Every table in Section 2 exists with exact column names and types.
- UNIQUE(songId, type) constraint is present on song_versions.
- CHECK constraints are present on content_blocks.type, song_versions.type, arrangement_markers.displayMode, notes.noteType.
- tags.createsReviewItem column exists with correct default.
- Foreign key relationships match the schema exactly.
- No UI exists yet beyond a blank shell — this phase is data-layer only.
- Migration can rebuild a clean schema from an empty database.
- Migration can safely apply to an existing database without data loss, even though no prior schema version exists yet — this establishes the pattern before it is needed.

# Phase 2 — Home and Projects
## Build
- Home Screen
- New Song creation flow
- Recent Songs list
- Project system (create, rename, delete, reorder)
- Unassigned Songs container
- View All Projects view
- Recently Deleted shell (visible/hidden states only, not full restore logic)

## Spec Sections Referenced
Section 3 (System Containers), Section 4 (Screen Inventory, partial), Section 5 (Navigation Flows, partial), Section 6 (Home Screen Specification), Section 7 (Project View portion only — Open Song View and Search are built in Phase 5), Section 19 (Projects).

## Stop and Review Checklist
- Recent Songs shows 5 most recently opened songs globally, with container name shown as secondary text.
- Project row shows project name and song count only.
- Project list collapses to 4 + View All Projects at 6 or more projects, per the defined threshold.
- Unassigned Songs cannot be renamed or deleted in the UI.
- Title-uniqueness-per-container is enforced when creating or renaming a song or project.
- Recently Deleted entry is hidden when empty.

# Phase 3a — Editor Core: Rendering Engine
## Build
- Editor canvas
- Section tag rendering ([Verse 1], [Chorus], etc.)
- Lyric line rendering
- Character-position-precise chord placement above lyric lines

## Spec Sections Referenced
Section 8 (Song Editor Layout), Section 12 (Sections and Chords).

## Stop and Review Checklist
- Chords are positioned by exact character offset, with no snapping to words or syllables.
- Section tags are flush-left, bold, colorized, not indented, with correct blank-line spacing.
- No decorative separators are rendered around sections.
- Save and reload preserves exact character-position chord placement — verifies persistence fidelity, not just on-screen rendering.
- This is the highest-risk checkpoint in the build. Do not proceed to Phase 3b until chord positioning is verified against multiple manually-constructed test lines, including lines with chords mid-word and at line start/end.

# Phase 3b — Editor Core: Markers and State
## Build
- Arrangement markers — standalone placement (between content blocks)
- Arrangement markers — inline placement (mid-line, between words)
- Working / saved version state model
- Auto-persistence (debounce, focus loss, navigation away, app close)
- Manual save (working overwrites saved, working then deleted)
- Untitled song naming and slot reuse

## Spec Sections Referenced
Section 9 (Song Lifecycle and State Model), Section 10 (Untitled Song Lifecycle), Section 11 (Auto-Persistence Rules), Section 13 (Arrangement Markers).

## Stop and Review Checklist
- Inline arrangement markers use the same character-position system validated in Phase 3a, not a separate implementation.
- Working-state bullet appears in the header on edit and disappears immediately on save.
- Auto-save debounce is 2 seconds and also fires on focus loss, navigation, and app close.
- No recovery dialog appears on reopen; working state simply reappears.
- Untitled Song numbering reuses the lowest released slot correctly.

# Phase 4 — Notes, Annotations, and Review Queue
## Build
- Song Notes side panel (line, section, song notes)
- Annotation engine (text-range binding, underline/color rendering, hover/tap detail)
- Tags (including createsReviewItem behavior)
- Manage Tags modal
- Review Queue side panel and all trigger conditions

## Spec Sections Referenced
Section 14 (Notes), Section 15 (Annotations and Tags), Section 16 (Review Queue), Section 17 (Review Queue Trigger Definitions), Section 24 partial (Manage Tags).

## Stop and Review Checklist
- An annotation can be created without a tag, rendering as an underline with no color.
- Tags function as shortcut text only — confirm no grouping/filtering behavior was added that the spec does not call for.
- Each of the six Review Queue triggers in Section 17 can be independently demonstrated, including Placeholder lyric depending on tags.createsReviewItem.
- Resolve removes a queue item; Ignore removes it permanently with no reappearance.
- Side panels are approximately one-third of editor width.

# Phase 5 — Recovery, Variants, Print, and Data Portability
## Build
- Delete and Restore (including original-project-missing and title-collision cases)
- Create Variant and Save Working Copy As Variant
- Move To Project (including conflict blocking)
- Print system (Print Chart, Print With Comments, layout options)
- Export and Import (post-MVP path; build only if in scope for this release)

## Spec Sections Referenced
Section 7 (Open Song View and Search portion), Section 18 (Saving, Moving, and Variants), Section 20 (Recently Deleted), Section 21 (Restore Rules), Section 22 (Print System), Section 23 (Export / Import).

## Stop and Review Checklist
- Move To Project and Restore both block on title collision and prompt rename before completing.
- Restore as Variant also checks for title collision in the destination, not just Restore as Permanent.
- Print Chart and Print With Comments produce visibly different output (notes/annotations included or excluded).
- Export warns that working versions are excluded; Import warns that local data will be fully replaced.
- Full acceptance criteria list (Spec Section 26) can be run end-to-end against the completed build.

# Cross-Phase Notes for AI Coding Tools
- If the spec is ambiguous on a point not covered by a Stop and Review checklist, flag it for human review rather than silently choosing an interpretation.
- Schema changes after Phase 1 should be treated as a deviation requiring sign-off, not a routine refactor.
- When comparing output across two different AI coding tools, compare at each phase boundary, not only at the end of the full build.
