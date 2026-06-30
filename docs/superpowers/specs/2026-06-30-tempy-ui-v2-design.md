# Tempy UI v2 — Design Spec
_2026-06-30_

## Overview

A second iteration on Tempy that turns the bare two-pane UI into a polished, mail-client-style three-pane interface (inspired by the mail.tm desktop client), adds **local persistence** so inboxes survive restarts, and makes persisted inboxes durable against mail.tm's **token expiry** by re-authenticating on demand.

This builds on the v1 implementation (`2026-06-30-tempy-implementation.md`). The MCP tool surface (5 tools) is unchanged in count; both surfaces are refactored to call a new shared service layer.

---

## Goals

- Persist inboxes to local disk (`~/.tempy/inboxes.json`) so they survive process restarts.
- Re-authenticate transparently when a stored token expires (store the password, re-login on 401, retry once).
- Three-pane mail-client UI: accounts sidebar · message list · reading pane.
- Capital-T **"Tempy"** logo.
- Copy-to-clipboard for address and password.
- Render emails as **HTML** (sandboxed) or **plain text** via a toggle.
- Unread indicators (dots + counts), sender avatars, relative timestamps, quota bar, "Powered by Mail.tm" footer.

## Non-Goals

- Multi-user auth / accounts (still single-user, localhost-only).
- Sending email, attachments, search, pagination.
- Encrypting the local store (plaintext password on disk is accepted — localhost testing tool).

---

## Architecture

One process, two surfaces (MCP stdio + HTTP), now over a shared **service layer**:

```
Claude (MCP) ─┐
              ├─► inbox-service.ts ─► inbox-store.ts (in-memory)
Browser (HTTP)┘          │                   │
                         │             persistence.ts ─► ~/.tempy/inboxes.json
                         └─────────► mailtm.ts ─► mail.tm API
```

- **`inbox-service.ts`** (new): the single place that orchestrates mailtm + store. Owns mapping, unread counts, mark-seen, quota, and the token-refresh-on-401 retry. MCP handlers and HTTP routes become thin adapters over it. This removes the duplicated mailtm/store logic currently living in both `mcp-server.ts` and `http-server.ts`.
- **`persistence.ts`** (new): atomic read/write of the JSON store file.
- **`inbox-store.ts`**: stays pure in-memory; gains `initStore(path)` (loads file + enables write-through) and a persist hook that is a **no-op until initialized** — so existing store tests, which never call `initStore`, do no disk I/O and keep passing unchanged.

---

## Data Model

```typescript
interface StoredMessage {
  id: string;
  subject: string;
  from: string;
  intro: string;
  createdAt: string;
  seen: boolean;          // NEW — drives unread dots/counts
}

interface StoredInbox {
  id: string;
  address: string;
  token: string;
  password: string;       // NEW — needed for re-login and copy-password
  messages: StoredMessage[];
}
```

Persisted file shape (`~/.tempy/inboxes.json`):
```json
{ "version": 1, "inboxes": [ { "id": "...", "address": "...", "token": "...", "password": "...", "messages": [] } ] }
```

`token` is persisted as a cache; on a 401 it is refreshed from `password`.

---

## Persistence & Token Refresh

- **Location:** `~/.tempy/inboxes.json`. Override the directory with `TEMPY_DATA_DIR`. Directory is created on first write.
- **Load:** `initStore()` reads the file (if present) into the in-memory map on boot. Corrupt/unreadable file → log to stderr, start empty (never crash).
- **Write-through:** `addInbox`, `removeInbox`, `updateMessages`, and token refresh persist the full store after mutating. Writes are atomic (write to `inboxes.json.tmp`, then rename).
- **Refresh-on-401:** `inbox-service` wraps each authenticated mailtm call in `withFreshToken(inbox, fn)`. If `fn` throws an auth/401 error, it calls `loginMailTm(address, password)`, updates the inbox's token (persisted), and retries once. A second failure propagates.

---

## mail.tm Client Additions (`mailtm.ts`)

```typescript
createMailTmInbox(): Promise<MailTmInbox>          // now also returns { password }
loginMailTm(address, password): Promise<string>    // returns a fresh token
fetchAccount(token): Promise<{ used: number; quota: number }>  // GET /me
markSeen(token, messageId): Promise<void>          // PATCH /messages/:id { seen: true }
```

Auth failures throw an error whose message contains `401` (or a typed marker) so the service can distinguish them from other failures.

---

## REST API Changes

- `GET  /api/inboxes` → `{ id, address, messageCount, unreadCount }[]`
- `POST /api/inboxes` → `201` `{ id, address }` (no token/password in response body)
- `GET  /api/inboxes/:id/messages` → `StoredMessage[]` (includes `seen`)
- `GET  /api/inboxes/:id/messages/:msgId` → `{ subject, from, text, html, createdAt }` (marks the message seen)
- `GET  /api/inboxes/:id/quota` → `{ used, quota }`  *(NEW)*
- `GET  /api/inboxes/:id/credentials` → `{ address, password }`  *(NEW — for copy-password; localhost only)*
- `DELETE /api/inboxes/:id` → `204`

---

## MCP Tools

Same 5 tools (`create_inbox`, `list_inboxes`, `list_messages`, `get_message`, `delete_inbox`), re-implemented as thin wrappers over `inbox-service`. `list_inboxes` includes `unreadCount`; `get_message` marks the message seen and returns `html` alongside `text`.

---

## Web UI (`src/ui/*`)

Three-pane dark layout:

```
┌───────────────┬───────────────────────┬───────────────────────────┐
│ Tempy         │ Inbox                 │  [trash] [copy]            │
│ [+ New Address]│ 1 message, 1 unread   │  F  Fieldsub Team  date    │
│ Active Accounts│ ● hola@…  3s ago      │  Subject                   │
│ ✉ wallnut@… 1 │   Verify your email   │  ─────────────────────     │
│ ✉ mulan@…     │   Your code is …       │  [HTML | Text]             │
│ …             │                       │  ┌─ sandboxed iframe ─┐    │
│ ─ Status ─    │                       │  │ rendered HTML body │    │
│ ● Active      │                       │  └────────────────────┘    │
│ Addr  [copy]  │                       │                            │
│ Pass  [copy]  │                       │                            │
│ ─ Quota ─     │                       │                            │
│ ▓▓▓░ 16/40MB  │                       │                            │
│ Powered by    │                       │                            │
│ Mail.tm       │                       │                            │
└───────────────┴───────────────────────┴───────────────────────────┘
```

- **Left:** capital-T `Tempy` logo; `+ New Address`; Active Accounts list (envelope glyph, address, unread badge); selected-account Status panel (status dot, address+copy, password+copy via `/credentials`); Quota bar (via `/quota`); `Powered by Mail.tm` footer.
- **Middle:** header (`N messages, M unread`); rows with initial-letter avatar, subject, intro preview, relative time, unread dot for `!seen`.
- **Right:** sender avatar + name + absolute date; subject; trash (delete inbox) + copy-address actions; **HTML / Text** toggle. HTML renders in `<iframe sandbox="">` (no `allow-scripts`) via `srcdoc`; Text renders in `<pre>` via `textContent`. All dynamic text set via `textContent` / safe DOM (no `innerHTML` with untrusted data).
- Polls `/api/inboxes` (and the selected inbox's messages) every 3s.

---

## Testing

- Existing 33 tests remain green (store tests untouched — no `initStore` call → no I/O).
- New unit tests:
  - `persistence.ts`: round-trip save/load using a `TEMPY_DATA_DIR` temp dir; corrupt-file tolerance.
  - `inbox-store.ts`: `initStore` loads file; mutations write through (temp-dir backed).
  - `mailtm.ts`: `loginMailTm`, `fetchAccount`, `markSeen` (mocked `fetch`); `createMailTmInbox` returns password.
  - `inbox-service.ts`: create/list (unreadCount)/get (marks seen)/delete/quota; **refresh-on-401 retries once then succeeds**, and propagates a second failure.
  - HTTP: new `/quota` and `/credentials` routes; `unreadCount` in list.
- UI verified manually (build + run + browser).

---

## Constraints & Notes

- **Plaintext password on disk** in `~/.tempy/inboxes.json` — accepted for a localhost testing tool; documented in README.
- **HTML email is untrusted** — rendered only inside a locked `sandbox=""` iframe (no script execution).
- Single-user, localhost-only; no auth on UI or API.
