Songwriting Tool Master Specification V6.4
Final Build Handoff Specification
# 1. Platform / Tech Stack
- Target: Desktop-first cross-platform application.
- Framework: Electron + React.
- Language: TypeScript.
- Local database: SQLite stored as songwriter.db.
- No required cloud dependency, account system, or online sync for MVP.
- State management is local application state backed by persistent SQLite storage.
- Mobile is post-MVP. Mobile interaction rules are preserved in Section 24 for continuity but do not apply to the MVP build.

# 2. Database Schema
## Table Definitions
```sql
projects(id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, createdOn TEXT, lastUsedOn TEXT, isSystemProject BOOLEAN NOT NULL DEFAULT 0)
```

```sql
songs(id TEXT PRIMARY KEY, title TEXT NOT NULL, projectId TEXT NOT NULL REFERENCES projects(id), createdOn TEXT, updatedOn TEXT, lastOpenedOn TEXT, deletedOn TEXT NULL, originalProjectId TEXT NULL)
```

```sql
song_versions(id TEXT PRIMARY KEY, songId TEXT NOT NULL REFERENCES songs(id), type TEXT NOT NULL CHECK(type IN ('saved','working')), capo INTEGER NULL, concertKey TEXT NULL, UNIQUE(songId, type))
```

```sql
content_blocks(id TEXT PRIMARY KEY, versionId TEXT NOT NULL REFERENCES song_versions(id), type TEXT NOT NULL CHECK(type IN ('section','lyricLine','chordLine','arrangementMarker')), content TEXT, position INTEGER NOT NULL)
```

```sql
arrangement_markers(id TEXT PRIMARY KEY, versionId TEXT NOT NULL REFERENCES song_versions(id), targetPosition TEXT NOT NULL, displayMode TEXT CHECK(displayMode IN ('inline','standalone')), text TEXT NOT NULL)
```

```sql
notes(id TEXT PRIMARY KEY, songId TEXT NOT NULL REFERENCES songs(id), noteType TEXT NOT NULL CHECK(noteType IN ('line','section','song')), targetId TEXT NULL, body TEXT NOT NULL)
```

```sql
annotations(id TEXT PRIMARY KEY, songId TEXT NOT NULL REFERENCES songs(id), targetRange TEXT NOT NULL, body TEXT NOT NULL, tagId TEXT NULL REFERENCES tags(id))
```

```sql
tags(id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, color TEXT NULL, createsReviewItem BOOLEAN NOT NULL DEFAULT 0)
```

```sql
review_queue(id TEXT PRIMARY KEY, songId TEXT NOT NULL REFERENCES songs(id), targetId TEXT NULL, type TEXT NOT NULL, message TEXT NOT NULL, createdOn TEXT, ignoredOn TEXT NULL, resolvedOn TEXT NULL)
```

## Schema Constraints and Clarifications
- Song titles must be unique within the same active container/project, but may duplicate across different projects or between a project and Unassigned Songs.
- UNIQUE(songId, type) on song_versions enforces that each song has at most one saved version and one working version at any time.
- content_blocks.type is constrained to: section, lyricLine, chordLine, arrangementMarker.
- notes.targetId is NULL for song-level notes. Line and section notes must have a valid targetId referencing their respective content block.
- annotations.tagId is nullable. An annotation may exist without a tag. Untagged annotations render as an underline with no color.
- arrangement_markers.displayMode of 'inline' indicates the marker is anchored to a character position within a lyric line. displayMode of 'standalone' indicates the marker sits between content blocks in the vertical flow. The targetPosition field encodes either a block position (standalone) or a block ID plus character offset (inline), consistent with the character-position system used by chord placement.
- tags.createsReviewItem formalizes the tag-to-Review-Queue coupling: when true, applying that tag to an annotation creates a Review Queue item of type Placeholder lyric. Default tags ship with createsReviewItem set to false unless explicitly configured otherwise.

# 3. System Containers
- Unassigned Songs is a permanent system container represented as isSystemProject = true.
- Recently Deleted is a system-managed recovery container represented by songs with deletedOn populated, not a normal editable project.
- System containers cannot be renamed.
- Unassigned Songs cannot be deleted.
- Recently Deleted is hidden when empty and exists only as a recovery and management area.

# 4. Screen / View Inventory
- Home Screen
- Project View
- View All Projects View
- Open Song View
- Song Editor
- Song Notes Side Panel
- Review Queue Side Panel
- Move To Project Modal
- Recently Deleted Modal
- Settings Modal
- Manage Tags Modal
- Print Dialog

# 5. Navigation Flows
- Home -> + New Song -> Song Editor.
- Home -> Recent Song -> Song Editor.
- Home -> Project -> Project View -> Song -> Song Editor.
- Home -> View All Projects -> Project View.
- Editor -> Hamburger Menu -> Open Song -> Open Song View -> Song Editor.
- Editor -> Hamburger Menu -> Print Chart -> Print Dialog.
- Editor -> Hamburger Menu -> Print With Comments -> Print Dialog.
- Editor -> Hamburger Menu -> Move To Project -> Move To Project Modal.
- Editor -> Bottom Utility Icon -> Song Notes Side Panel.
- Editor -> Bottom Utility Icon -> Review Queue Side Panel.
- Editor -> Hamburger Menu -> Settings -> Settings Modal.
- Settings Modal -> Manage Tags -> Manage Tags Modal.
- Home -> Recently Deleted -> Recently Deleted Modal.
- Recently Deleted -> Restore -> Song Editor for the restored song.
- Editor -> Home without manual save is allowed; working state persists automatically.

# 6. Home Screen Specification
- + New Song appears as the top-most action and is lightweight text, not a button.
- Recent Songs displays the 5 most recently opened songs globally, ordered by lastOpenedOn descending, regardless of project or container.
- Each Recent Song row shows the song title with its container name displayed below it in smaller secondary text, since duplicate titles may exist across different containers.
- Projects are ordered by most recently used.
- A project row displays the project name with its song count shown below in smaller secondary text. No last-used date or other metadata is shown.
- If there are 1-5 user projects, show all projects.
- If there are 6+ user projects, show the 4 most recently used projects plus View All Projects.
- View All Projects is visually distinct from project rows and is not shown with a project arrow.
- Unassigned Songs always appears after the displayed projects and after View All Projects when View All exists.
- Unassigned Songs is visually the same size and weight as project rows, but cannot be renamed or deleted.
- Recently Deleted appears as a compressed single-line entry and only when non-empty.

# 7. Project View / Open Song View
- Project View displays songs in the selected project or container as a title-only list.
- Open Song View displays all active songs across all user projects and Unassigned Songs, organized using the same project/container structure as the Home Screen. Recently Deleted is not included.
- Search exists only inside Open Song View.
- Search searches active songs only: songs in user projects and Unassigned Songs.
- Search excludes Recently Deleted.
- Search is title-only simple text match.
- Search results must show container context because duplicate titles may exist across different containers.

# 8. Song Editor Layout
- Header format: hamburger menu, working-state bullet if applicable, then song title.
- Example: ☰   • Midnight Highway
- Working-state bullet appears before the title, never after.
- Project name is never shown in the editor header.
- Capo and Concert Key appear below the header only when defined.
- Capo and Key remain sticky while scrolling.
- Bottom-right utility icons display Song Notes and Review Queue only when their counts are greater than zero.
- Utility icons are bottom-right anchored, icon-only, with visible counts.
- A new empty song opens to a blank canvas with a cursor ready to type. No placeholder text or pre-inserted content.

# 9. Song Lifecycle and State Model
- A new song starts as working-only with no savedVersion.
- A working-only song is valid.
- Manual Save overwrites the savedVersion with the current workingVersion, then deletes the workingVersion.
- After save, the working-state bullet disappears from the editor header.
- The working-state bullet reappears the moment the user makes a new edit after saving.
- Editing a saved song creates or updates the workingVersion.
- Revert To Saved destroys the workingVersion and restores the savedVersion.
- Delete moves savedVersion and workingVersion, if present, into Recently Deleted.
- Crash, app close, reboot, or navigation away must not lose working state.

# 10. Untitled Song Lifecycle
- Untitled songs may be saved without requiring a title.
- Untitled song names are generated using the lowest available untitled slot.
- The first untitled song is named Untitled Song.
- Additional untitled songs are named Untitled Song 2, Untitled Song 3, and so on.
- When an untitled song is renamed, its untitled slot is released immediately.
- Released untitled numbers are reclaimed by future untitled songs.
- Example: if Untitled Song 2 is renamed to Midnight Highway, the next available untitled song may again be Untitled Song 2.
- The numbering is collision avoidance only and does not imply creation count or history.

# 11. Auto-Persistence Rules
- Working state persists automatically using a 2-second debounce after the last edit.
- Working state also persists on focus loss, navigation away, and app close.
- Manual Save is distinct from persistence: it commits workingVersion into savedVersion.
- No recovery popup or recovered-document workflow is shown; persisted working state simply reappears.

# 12. Sections and Chords
- Section tags use bracket syntax such as [Verse 1], [Chorus], [Bridge].
- Section tags are flush-left, bold, colorized, and not indented.
- Blank line appears above section tags except the first section.
- No decorative separator lines around sections.
- Chord placement is character-position precise.
- No snapping to words or syllables.
- Chord lines appear only above the lyric line they affect.
- Unknown chords are accepted and may generate a Review Queue item.

# 13. Arrangement Markers
- Arrangement markers are active feature objects, not cut.
- ArrangementMarker fields: id, versionId, targetPosition, displayMode, text.
- displayMode is inline or standalone.
- Standalone markers sit between content blocks in the vertical flow, at section boundaries or between lines.
- Inline markers are anchored to a character position within a lyric line and render visibly between words in the line, not as an overlay.
- Placement is determined by insertion point.
- Examples include: Fingerpicked, Full Band, Harmony In, Drums Enter.
- Arrangement markers are included in Print unless unchecked in the Print Dialog.
- The targetPosition field encodes a block position for standalone markers or a block ID plus character offset for inline markers, consistent with the character-position rendering system used for chord placement.

# 14. Notes
- Supported note types: line note, section note, song note.
- All notes are accessed through the Song Notes side panel only.
- Line and section notes are stored against targets but do not render inline in the editor.
- Song-level notes have a NULL targetId. Line and section notes must have a valid targetId referencing their respective content block.
- Song Notes side panel width is approximately one-third of the editor width.
- Song Notes icon appears only when notes exist.

# 15. Annotations and Tags
- Annotations are active features, not cut.
- Annotations are bound to exact text ranges.
- Annotations are visually represented by underline and color only.
- Annotation body and details appear on hover or tap.
- Multiple annotations on the same line are allowed.
- Only one annotation object exists per exact selected range.
- Re-annotating an already annotated range opens the existing annotation for editing with cursor at the end.
- An annotation may exist without a tag. Untagged annotations render as an underline with no color.
- Tags are optional annotation shortcuts for commonly used annotation text, not organizational categories. They are not used for grouping or filtering.
- Default tags may include ?, ? rewrite, needs rhyme, favorite, placeholder.
- Manage Tags allows creating, renaming, deleting, and assigning colors to annotation tags.
- Manage Tags also allows configuring whether a tag creates a Review Queue item when applied, via the createsReviewItem setting.

# 16. Review Queue
- Review Queue is an editorial action list, not a warning or error system.
- Review Queue icon appears only when count > 0.
- Review Queue side panel width is approximately one-third of the editor width.
- Items are ordered oldest to newest.
- Selecting an item jumps the editor to the source.
- Resolve removes the item from the queue.
- Ignore removes the item permanently and it should not reappear automatically.
- Hidden notes and existing annotations do not create Review Queue items.

# 17. Review Queue Trigger Definitions
- Unknown chord: created when chord parser cannot validate a chord name or shape.
- Section conflict: created when a rename or link action creates ambiguity between repeated sections, for example renaming Verse to Chorus when Chorus already exists.
- Broken section link: created when a linked repeated section diverges and the user has not yet chosen update-all vs split variation.
- Ambiguous transpose: created when capo, key, or transposition conversion encounters a chord or alias that cannot be safely converted.
- Placeholder lyric: created only when the user applies an annotation tag with createsReviewItem set to true.
- Manual user flag: created when the user explicitly requests review for a selected item.

# 18. Saving, Moving, and Variants
- Move To Project is a commit action: it saves current working state, moves the song, and clears workingVersion.
- Move To Project must block if destination container already contains a song with the same title.
- The user must rename before the move can complete.
- Move To Unassigned is supported.
- Create Variant saves the original first, then creates a new named song.
- Save Working Copy As Variant extracts workingVersion into a new saved song and removes workingVersion from original.
- Save Working Copy As Variant defaults to same project as original, with optional checkbox to choose a different location.

# 19. Projects
- Projects can be created from Home Screen or from Move To Project.
- Project names must be globally unique.
- Projects can be renamed or deleted using right-click or tap-and-hold.
- Empty projects persist.
- Deleting a project prompts: Move Songs to Unassigned or Delete Songs.
- Delete Songs moves songs to Recently Deleted rather than permanently destroying them.
- Projects reorder by most recently used, but not while the user is actively viewing the list.

# 20. Recently Deleted
- Recently Deleted is hidden when empty.
- Deleted songs are ordered most recently deleted first.
- Only one deleted song expands at a time.
- Expanded row shows Restore and Delete Permanently inline under the selected song.
- No Cancel button; dismiss via top-right X.
- No countdown or days remaining display.
- Songs are retained for 7 days before automatic permanent deletion.
- Manual permanent delete requires confirmation.
- Empty Recently Deleted requires confirmation.

# 21. Restore Rules
- A deleted song restores to its original project if that project still exists.
- If original project no longer exists, restore to Unassigned Songs.
- If restore destination already contains a song with the same title, prompt user to rename before restoring.
- If deleted song has only savedVersion, restore that savedVersion.
- If deleted song has savedVersion and workingVersion, prompt Restore as Permanent or Restore as Variant.
- Restore as Permanent overwrites savedVersion with workingVersion, then deletes workingVersion.
- Restore as Variant creates a new saved song from the workingVersion. If the restore destination already contains a song with the same title, the user is prompted to rename the new song before it is created.
- After restore, open the restored song in the Editor.

# 22. Print System
- Menu has two distinct entries: Print Chart and Print With Comments.
- The Print Dialog reflects the chosen mode via a display-only mode indicator. The user is not asked again whether comments are included.
- Print Chart includes title, capo and key if defined, sections, lyrics, chords, and arrangement markers if included.
- Print Chart excludes notes and annotations.
- Print With Comments includes notes and annotations.
- Print Dialog controls: mode indicator (display only), layout toggle (Single Column or Dual Column), Arrangement Markers checkbox, and Print button.
- Print hands off to the OS system print dialog. The OS print preview is used; no custom preview is built.
- Print uses the system print dialog and OS PDF-capable print pipeline.

# 23. Export / Import
- Export and Import via Google Drive is the post-MVP path to cross-device access. It is not part of the MVP build.
- Export includes all saved song versions, projects, annotations, tags, and notes.
- Working versions are excluded from export and exist only on the local device.
- At export time, the app displays a warning that working versions are not included and advises the user to save before exporting if working state should be preserved.
- Import is a full database replace. The local database is completely overwritten by the imported file.
- Import replaces all local data, including songs (active and deleted), projects, song versions, content blocks, arrangement markers, notes, annotations, tags, and review queue items.
- At import time, the app displays a warning that all local data will be replaced and requires explicit confirmation before proceeding.
- Export and Import do not perform merging or conflict resolution. Last import wins.

# 24. Settings and Manage Tags
- Settings dismisses via top-right X, not a Close or Cancel button.
- Appearance supports Light and Dark only.
- Print Defaults supports Single Column or Dual Column.
- Annotation Tags section contains Manage Tags.
- Manage Tags modal allows add, rename, delete, reorder, and color assignment for annotation tags.
- No custom themes in MVP.

# 25. Interaction Model
Desktop rules apply for MVP. Mobile rules are preserved below for post-MVP continuity.

## Desktop
- Single click selects or opens.
- Double-click edits.
- Right-click opens contextual actions.
- Actions remain attached to the object they affect where possible.
- Keyboard shortcuts follow platform standards only; no custom shortcut ecosystem.

## Mobile (Post-MVP)
- Tap selects or opens.
- Tap-and-hold opens contextual actions and edit actions.

# 26. Acceptance Criteria
- User can create a song, write lyrics, add chords, save, close app, reopen, and see content preserved.
- Working state survives crash and restart without recovery dialogs.
- User can move songs between projects and Unassigned with conflict blocking.
- User can create and reuse untitled names according to lowest-available-number rule.
- User can create variants and save working copies as variants.
- User can delete and restore songs, including working-state songs.
- User can manage annotations and tags.
- User can print charts with or without comments.
- Review Queue items are created only by defined triggers and behave as specified.
- Search finds active songs by title only.
- All listed views are reachable by defined navigation flows.
- Export warns user that working versions are excluded before proceeding.
- Import warns user that local data will be replaced and requires confirmation before proceeding.
