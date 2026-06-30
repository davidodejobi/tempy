# Tempy — Design Spec
_2026-06-30_

## Overview

Tempy is an MCP server + local web UI that provides disposable email inboxes via mail.tm. It lets Claude create, read, and delete temporary email addresses autonomously (for automated testing flows) or on demand (manual use). A tiny local web server gives the user a visual inbox browser that stays in sync with Claude's activity in real time.

Published as an npm package so users can run it with `npx tempy` and wire it into Claude's MCP config with a single JSON entry.

---

## Architecture

One process, two surfaces. Running `npx tempy` starts:

- **MCP server** on stdio — Claude connects via the MCP protocol
- **HTTP server** on `localhost:3000` — serves the web UI and a REST API the UI polls

Both share a single **InboxStore** — an in-memory map of active inboxes and cached messages. Inboxes created by Claude appear in the web UI instantly. Inboxes created via the UI's "New Inbox" button are equally accessible to Claude.

```
Claude (MCP client)
      │ stdio
      ▼
 ┌─────────────┐     shared     ┌─────────────┐
 │  MCP Server │◄──InboxStore──►│ HTTP Server │◄── Browser
 └─────────────┘                └─────────────┘
        │                              │
        └──────────► mail.tm API ◄─────┘
```

mail.tm is the only external dependency. No database, no auth, no config file required.

---

## MCP Tools

| Tool | Arguments | Returns | Description |
|------|-----------|---------|-------------|
| `create_inbox` | — | `{ address, token, id }` | Creates a new mail.tm address and stores it in InboxStore |
| `list_inboxes` | — | `Inbox[]` | Returns all active inboxes in the current session |
| `list_messages` | `{ inboxId }` | `Message[]` | Fetches and caches messages for the given inbox |
| `get_message` | `{ inboxId, messageId }` | `{ subject, from, text, html }` | Gets the full body of a specific message |
| `delete_inbox` | `{ inboxId }` | `{ success }` | Deletes from mail.tm and removes from InboxStore |

Polling for new email (e.g., waiting for a verification email) is handled by Claude calling `list_messages` in a loop — no dedicated wait tool. This keeps the flow transparent and interruptible.

---

## Web UI

Single-page UI — plain HTML/CSS/JS, no framework. Served by Express from `src/ui/`.

**Layout:**

```
┌─────────────────────────────────────────────────┐
│  tempy                              [+ New Inbox]│
├──────────────┬──────────────────────────────────┤
│              │  Subject: Verify your email       │
│ abc@mail.tm  │  From: noreply@example.com        │
│ xyz@mail.tm  │  ─────────────────────────────── │
│              │  Hi there, click here to verify…  │
│              │                                   │
└──────────────┴──────────────────────────────────┘
```

- **Left panel** — active inbox list, auto-refreshes every 3 seconds via `/api/inboxes`
- **Right panel** — message list for selected inbox + full message body on click
- **New Inbox button** — calls `POST /api/inboxes`, same effect as Claude's `create_inbox` tool

REST endpoints:
- `GET /api/inboxes` — all active inboxes + cached message counts
- `POST /api/inboxes` — create a new inbox
- `GET /api/inboxes/:id/messages` — message list for an inbox
- `GET /api/inboxes/:id/messages/:msgId` — full message body
- `DELETE /api/inboxes/:id` — delete inbox

---

## Project Structure

```
tempy/
├── src/
│   ├── index.ts          # entry point — starts MCP + HTTP together
│   ├── inbox-store.ts    # shared in-memory store (singleton)
│   ├── mailtm.ts         # mail.tm API client (fetch wrapper)
│   ├── mcp-server.ts     # MCP tool definitions
│   ├── http-server.ts    # Express server + REST routes
│   └── ui/
│       ├── index.html
│       ├── style.css
│       └── app.js        # polls REST API, renders inbox/messages
├── package.json
└── tsconfig.json
```

---

## npm Setup

- Package name: `tempy` (verify availability before publish)
- `bin: { "tempy": "dist/index.js" }` — enables `npx tempy`
- Key dependencies: `@modelcontextprotocol/sdk`, `express`, `node-fetch`
- Build: `tsc` compiles `src/` → `dist/`

**Claude MCP config entry:**
```json
{
  "mcpServers": {
    "tempy": {
      "command": "npx",
      "args": ["tempy"]
    }
  }
}
```

---

## Data Flow: Automated Test Example

1. Claude calls `create_inbox` → gets `abc123@mail.tm`
2. Claude triggers a sign-up on the target site using that address
3. Claude calls `list_messages` in a loop until a message appears
4. Claude calls `get_message` → extracts the verification link from the body
5. Claude visits the link to confirm the account
6. Claude calls `delete_inbox` to clean up

---

## Constraints & Notes

- **mail.tm inboxes are ephemeral and semi-public** — anyone who knows the address can read it. Suitable for testing only, not production secrets. README must make this clear.
- **In-memory store** — inboxes are lost when the process restarts. This is intentional for v1; persistence can be added later.
- **Port 3000** — hardcoded for v1. If it conflicts, user can set `TEMPY_PORT` env var.
- **No auth on the web UI** — it's localhost-only, so auth adds friction without security benefit.
