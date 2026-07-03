# Open Dashboard Tool — Design

**Goal:** Give the LLM a tool it can call to open Tempy's web dashboard in the
user's browser, so a person can visually watch inboxes and messages the AI is
working with.

## Problem

Tempy already serves a web dashboard on `TEMPY_PORT` (default 3000), but the
URL is only written to stderr on startup. The LLM never sees it, and the user
has to know to open it by hand. When someone tells the agent "show me the
emails" or "open the dashboard", the agent has no tool to satisfy that.

## Approach

Add one MCP tool, `open_dashboard`, plus the plumbing to launch the OS browser.

### Components

1. **`src/browser.ts` (new)** — `openInBrowser(url: string): boolean`.
   - Chooses the platform launcher: `open` (darwin), `start` (win32,
     via shell), `xdg-open` (other).
   - Spawns it detached with stdio ignored, attaches an `error` listener so an
     async spawn failure (no display) can't crash the process, and `unref()`s
     the child so it never keeps Node alive.
   - Returns `true` if the launch was attempted without a synchronous throw,
     `false` otherwise. Best-effort: the flag is informational, never an error.

2. **`src/mcp-server.ts`** — new `open_dashboard` tool.
   - `makeOpenDashboardHandler(uiUrl, open = openInBrowser)` returns the handler,
     with the opener injectable for tests.
   - Optional `inboxId` param. URL is `uiUrl` alone, or
     `${uiUrl}/?inbox=${encodeURIComponent(inboxId)}` when an id is passed.
   - Calls the opener and returns `{ url, opened }` as JSON text, so the model
     always has a clickable link even when auto-open fails (remote/headless).
   - `createMcpServer` gains an optional `{ uiUrl }` option (default
     `http://localhost:3000`) and registers the tool. Description is phrased for
     discoverability: opening the dashboard / seeing emails visually / on the
     user's machine.

3. **`src/index.ts`** — computes `http://localhost:${PORT}` and passes it as
   `uiUrl` to `createMcpServer`. The URL is valid whether this instance bound
   the port or another running Tempy already holds it (they share the store),
   so the tool works even when this instance skipped the UI on EADDRINUSE.

4. **`src/ui/app.js`** — on initial load, read `?inbox=` from the query string;
   if present, select that inbox once the inbox list has loaded so the
   deep-link lands directly on it.

### Data flow

`user: "show me the inbox"` → model calls `open_dashboard` (optionally with the
inbox it's working with) → handler builds the URL, spawns the browser, returns
`{ url, opened }` → the browser opens the dashboard (deep-linked to the inbox),
polling the same shared store the tools write to.

### Error handling

- No local browser (remote/headless client): `openInBrowser` returns `false`,
  the tool still returns the URL. No error surfaces.
- Port held by another Tempy instance: URL still resolves to that instance's
  dashboard over the shared store. No special handling needed.

### Testing

- `src/mcp-server.test.ts`: `makeOpenDashboardHandler` builds the base URL with
  no id, appends an encoded `?inbox=` with an id, invokes the injected opener,
  and returns `{ url, opened }`.
- `src/browser.test.ts`: `openInBrowser` returns `false` when `spawn` throws;
  returns `true` and unrefs on the happy path (with `spawn` mocked).

## Out of scope

- Multiple browser windows / tab reuse.
- Any auth or remote-access story — the dashboard stays local-only.
