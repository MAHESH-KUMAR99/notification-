// Tab label for notices with no `source` field — either a watcher with no
// explicit `sourceLabel` (see lib/watcher.js) or a legacy notice stored
// before this field existed. Kept in its own dependency-free module (no
// `fs`/`path`) so both the server-only extractor/merge code and client
// components like DetailPanel.js can import it without pulling Node
// built-ins into the browser bundle.
export const DEFAULT_SOURCE_LABEL = "Direct from Website";
