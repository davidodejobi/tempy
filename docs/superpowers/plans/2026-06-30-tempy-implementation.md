# Tempy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript MCP server + local web UI for disposable email inboxes via mail.tm, published as an npm package (`npx tempy-mcp`).

**Architecture:** Single Node.js process — MCP server on stdio and Express HTTP server on port 3000 share an in-memory `InboxStore` singleton. Claude interacts via 5 MCP tools; a browser UI polls the REST API for visual access.

**Tech Stack:** TypeScript 5, `@modelcontextprotocol/sdk` ^1.0, Express 4, Zod 3, Vitest 1, Supertest 7, Node 18+

## Global Constraints

- Node 18+ required (uses built-in `fetch` — no node-fetch)
- `"type": "module"` in package.json — all local imports must end in `.js`
- Source in `src/`, compiled to `dist/` via `tsc`
- `process.stderr.write` for all logging — stdout is reserved for MCP protocol
- Default port 3000, overridable via `TEMPY_PORT` env var
- mail.tm base URL: `https://api.mail.tm`
- Package name: `tempy-mcp` (`tempy` is taken on npm — verify with `npm view tempy-mcp` before publishing)

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/index.ts` (placeholder)

**Interfaces:**
- Produces: `npm run build` compiles without errors; `npm test` runs with zero failures

- [ ] **Step 1: Create package.json**

```json
{
  "name": "tempy-mcp",
  "version": "0.1.0",
  "description": "MCP server for disposable email inboxes via mail.tm",
  "type": "module",
  "bin": { "tempy": "dist/index.js" },
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc && npm run copy-ui",
    "copy-ui": "cp -r src/ui dist/ui",
    "postbuild": "chmod +x dist/index.js",
    "start": "node dist/index.js",
    "test": "vitest run",
    "dev": "tsc --watch"
  },
  "keywords": ["mcp", "email", "disposable", "testing", "mail.tm"],
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "express": "^4.19.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.0",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "typescript": "^5.4.5",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
*.js.map
```

- [ ] **Step 5: Create placeholder entry point**

Create `src/index.ts`:
```typescript
// entry point — implemented in Task 7
export {};
```

- [ ] **Step 6: Install dependencies**

```bash
npm install
```

- [ ] **Step 7: Verify build**

```bash
npm run build
```
Expected: `dist/index.js` created, no TypeScript errors.

- [ ] **Step 8: Verify tests run**

```bash
npm test
```
Expected output includes `Test Files  0 passed` — no failures.

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore src/index.ts
git commit -m "chore: project scaffold"
```

---

### Task 2: mail.tm API Client

**Files:**
- Create: `src/mailtm.ts`
- Create: `src/mailtm.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  interface MailTmInbox  { id: string; address: string; token: string; }
  interface MailTmMessage { id: string; subject: string; from: { address: string; name: string }; intro: string; createdAt: string; seen: boolean; }
  interface MailTmMessageDetail extends MailTmMessage { text: string; html: string[]; }

  createMailTmInbox(): Promise<MailTmInbox>
  fetchMessages(token: string): Promise<MailTmMessage[]>
  fetchMessage(token: string, messageId: string): Promise<MailTmMessageDetail>
  deleteMailTmAccount(token: string, accountId: string): Promise<void>
  ```

- [ ] **Step 1: Write failing tests**

Create `src/mailtm.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMailTmInbox, fetchMessages, fetchMessage, deleteMailTmAccount } from "./mailtm.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => mockFetch.mockReset());

describe("createMailTmInbox", () => {
  it("returns address, id, and token", async () => {
    mockFetch
      .mockReturnValueOnce(makeResponse({ "hydra:member": [{ domain: "mail.tm" }] }))
      .mockReturnValueOnce(makeResponse({ id: "acc-1", address: "test@mail.tm" }))
      .mockReturnValueOnce(makeResponse({ token: "jwt-abc" }));

    const inbox = await createMailTmInbox();
    expect(inbox.id).toBe("acc-1");
    expect(inbox.address).toMatch(/@mail\.tm$/);
    expect(inbox.token).toBe("jwt-abc");
  });

  it("throws if domains fetch fails", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}, 500));
    await expect(createMailTmInbox()).rejects.toThrow("Failed to fetch domains");
  });

  it("throws if account creation fails", async () => {
    mockFetch
      .mockReturnValueOnce(makeResponse({ "hydra:member": [{ domain: "mail.tm" }] }))
      .mockReturnValueOnce(makeResponse({}, 422));
    await expect(createMailTmInbox()).rejects.toThrow("Failed to create account");
  });
});

describe("fetchMessages", () => {
  it("returns message list", async () => {
    const messages = [{ id: "m1", subject: "Hello", from: { address: "a@b.com", name: "A" }, intro: "Hi", createdAt: "2024-01-01", seen: false }];
    mockFetch.mockReturnValueOnce(makeResponse({ "hydra:member": messages }));
    const result = await fetchMessages("token-123");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m1");
  });

  it("throws on failure", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}, 401));
    await expect(fetchMessages("bad-token")).rejects.toThrow("Failed to fetch messages");
  });
});

describe("fetchMessage", () => {
  it("returns full message detail", async () => {
    const detail = { id: "m1", subject: "Hello", from: { address: "a@b.com", name: "A" }, intro: "Hi", createdAt: "2024-01-01", seen: false, text: "body text", html: ["<p>body</p>"] };
    mockFetch.mockReturnValueOnce(makeResponse(detail));
    const result = await fetchMessage("token-123", "m1");
    expect(result.text).toBe("body text");
    expect(result.html).toEqual(["<p>body</p>"]);
  });
});

describe("deleteMailTmAccount", () => {
  it("resolves on 204", async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve({}) }));
    await expect(deleteMailTmAccount("token-123", "acc-1")).resolves.toBeUndefined();
  });

  it("throws on error status", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}, 500));
    await expect(deleteMailTmAccount("token-123", "acc-1")).rejects.toThrow("Failed to delete account");
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test
```
Expected: `Cannot find module './mailtm.js'`

- [ ] **Step 3: Implement mailtm.ts**

Create `src/mailtm.ts`:
```typescript
const BASE_URL = "https://api.mail.tm";

export interface MailTmInbox {
  id: string;
  address: string;
  token: string;
}

export interface MailTmMessage {
  id: string;
  subject: string;
  from: { address: string; name: string };
  intro: string;
  createdAt: string;
  seen: boolean;
}

export interface MailTmMessageDetail extends MailTmMessage {
  text: string;
  html: string[];
}

function randomString(length: number): string {
  return Math.random().toString(36).substring(2, 2 + length).padEnd(length, "a");
}

export async function createMailTmInbox(): Promise<MailTmInbox> {
  const domainsRes = await fetch(`${BASE_URL}/domains?page=1`);
  if (!domainsRes.ok) throw new Error("Failed to fetch domains");
  const domainsData = await domainsRes.json() as { "hydra:member": { domain: string }[] };
  const domain = domainsData["hydra:member"][0].domain;

  const address = `${randomString(10)}@${domain}`;
  const password = randomString(16);

  const createRes = await fetch(`${BASE_URL}/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, password }),
  });
  if (!createRes.ok) throw new Error("Failed to create account");
  const account = await createRes.json() as { id: string };

  const tokenRes = await fetch(`${BASE_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, password }),
  });
  if (!tokenRes.ok) throw new Error("Failed to get token");
  const tokenData = await tokenRes.json() as { token: string };

  return { id: account.id, address, token: tokenData.token };
}

export async function fetchMessages(token: string): Promise<MailTmMessage[]> {
  const res = await fetch(`${BASE_URL}/messages?page=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch messages");
  const data = await res.json() as { "hydra:member": MailTmMessage[] };
  return data["hydra:member"];
}

export async function fetchMessage(token: string, messageId: string): Promise<MailTmMessageDetail> {
  const res = await fetch(`${BASE_URL}/messages/${messageId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch message ${messageId}`);
  return res.json() as Promise<MailTmMessageDetail>;
}

export async function deleteMailTmAccount(token: string, accountId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/accounts/${accountId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) throw new Error("Failed to delete account");
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npm test
```
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/mailtm.ts src/mailtm.test.ts
git commit -m "feat: mail.tm API client"
```

---

### Task 3: InboxStore

**Files:**
- Create: `src/inbox-store.ts`
- Create: `src/inbox-store.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  interface StoredMessage { id: string; subject: string; from: string; intro: string; createdAt: string; }
  interface StoredInbox   { id: string; address: string; token: string; messages: StoredMessage[]; }

  addInbox(inbox: StoredInbox): void
  getInbox(id: string): StoredInbox | undefined
  listInboxes(): StoredInbox[]
  updateMessages(inboxId: string, messages: StoredMessage[]): void
  removeInbox(id: string): boolean
  clearAll(): void   // test isolation only
  ```

- [ ] **Step 1: Write failing tests**

Create `src/inbox-store.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { addInbox, getInbox, listInboxes, updateMessages, removeInbox, clearAll } from "./inbox-store.js";

const sample = { id: "abc", address: "abc@mail.tm", token: "tok", messages: [] };

beforeEach(() => clearAll());

describe("addInbox / getInbox", () => {
  it("stores and retrieves an inbox", () => {
    addInbox(sample);
    expect(getInbox("abc")).toEqual(sample);
  });

  it("returns undefined for unknown id", () => {
    expect(getInbox("nope")).toBeUndefined();
  });
});

describe("listInboxes", () => {
  it("returns empty array initially", () => {
    expect(listInboxes()).toEqual([]);
  });

  it("returns all added inboxes", () => {
    addInbox(sample);
    addInbox({ id: "xyz", address: "xyz@mail.tm", token: "tok2", messages: [] });
    expect(listInboxes()).toHaveLength(2);
  });
});

describe("updateMessages", () => {
  it("replaces the message list for an inbox", () => {
    addInbox(sample);
    const msgs = [{ id: "m1", subject: "Hi", from: "a@b.com", intro: "...", createdAt: "2024-01-01" }];
    updateMessages("abc", msgs);
    expect(getInbox("abc")?.messages).toEqual(msgs);
  });

  it("does nothing for unknown inboxId", () => {
    expect(() => updateMessages("nope", [])).not.toThrow();
  });
});

describe("removeInbox", () => {
  it("removes inbox and returns true", () => {
    addInbox(sample);
    expect(removeInbox("abc")).toBe(true);
    expect(getInbox("abc")).toBeUndefined();
  });

  it("returns false for unknown id", () => {
    expect(removeInbox("nope")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test
```
Expected: `Cannot find module './inbox-store.js'`

- [ ] **Step 3: Implement inbox-store.ts**

Create `src/inbox-store.ts`:
```typescript
export interface StoredMessage {
  id: string;
  subject: string;
  from: string;
  intro: string;
  createdAt: string;
}

export interface StoredInbox {
  id: string;
  address: string;
  token: string;
  messages: StoredMessage[];
}

const inboxes = new Map<string, StoredInbox>();

export function addInbox(inbox: StoredInbox): void {
  inboxes.set(inbox.id, { ...inbox, messages: [...inbox.messages] });
}

export function getInbox(id: string): StoredInbox | undefined {
  return inboxes.get(id);
}

export function listInboxes(): StoredInbox[] {
  return Array.from(inboxes.values());
}

export function updateMessages(inboxId: string, messages: StoredMessage[]): void {
  const inbox = inboxes.get(inboxId);
  if (inbox) inbox.messages = messages;
}

export function removeInbox(id: string): boolean {
  return inboxes.delete(id);
}

export function clearAll(): void {
  inboxes.clear();
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npm test
```
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/inbox-store.ts src/inbox-store.test.ts
git commit -m "feat: inbox store"
```

---

### Task 4: MCP Server

**Files:**
- Create: `src/mcp-server.ts`
- Create: `src/mcp-server.test.ts`

**Interfaces:**
- Consumes:
  - `createMailTmInbox`, `fetchMessages`, `fetchMessage`, `deleteMailTmAccount` from `./mailtm.js`
  - `addInbox`, `getInbox`, `listInboxes`, `updateMessages`, `removeInbox` from `./inbox-store.js`
  - `StoredMessage` from `./inbox-store.js`
- Produces:
  ```typescript
  // Exported handlers — used directly in tests
  handleCreateInbox(): Promise<{ content: [{ type: "text"; text: string }] }>
  handleListInboxes(): Promise<{ content: [{ type: "text"; text: string }] }>
  handleListMessages(args: { inboxId: string }): Promise<{ content: [{ type: "text"; text: string }] }>
  handleGetMessage(args: { inboxId: string; messageId: string }): Promise<{ content: [{ type: "text"; text: string }] }>
  handleDeleteInbox(args: { inboxId: string }): Promise<{ content: [{ type: "text"; text: string }] }>

  createMcpServer(): McpServer
  ```

- [ ] **Step 1: Write failing tests**

Create `src/mcp-server.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./mailtm.js", () => ({
  createMailTmInbox: vi.fn(),
  fetchMessages: vi.fn(),
  fetchMessage: vi.fn(),
  deleteMailTmAccount: vi.fn(),
}));

vi.mock("./inbox-store.js", () => ({
  addInbox: vi.fn(),
  getInbox: vi.fn(),
  listInboxes: vi.fn(),
  updateMessages: vi.fn(),
  removeInbox: vi.fn(),
  clearAll: vi.fn(),
}));

import * as mailtm from "./mailtm.js";
import * as store from "./inbox-store.js";
import {
  handleCreateInbox,
  handleListInboxes,
  handleListMessages,
  handleGetMessage,
  handleDeleteInbox,
} from "./mcp-server.js";

function parse(result: { content: { text: string }[] }) {
  return JSON.parse(result.content[0].text);
}

beforeEach(() => vi.clearAllMocks());

describe("handleCreateInbox", () => {
  it("creates inbox and returns address and id", async () => {
    vi.mocked(mailtm.createMailTmInbox).mockResolvedValue({ id: "i1", address: "a@b.com", token: "tok" });
    vi.mocked(store.getInbox).mockReturnValue({ id: "i1", address: "a@b.com", token: "tok", messages: [] });

    const result = parse(await handleCreateInbox());
    expect(result.address).toBe("a@b.com");
    expect(result.id).toBe("i1");
    expect(store.addInbox).toHaveBeenCalledWith({ id: "i1", address: "a@b.com", token: "tok", messages: [] });
  });
});

describe("handleListInboxes", () => {
  it("returns all inboxes with message counts", async () => {
    vi.mocked(store.listInboxes).mockReturnValue([
      { id: "i1", address: "a@b.com", token: "tok", messages: [] },
    ]);
    const result = parse(await handleListInboxes());
    expect(result).toHaveLength(1);
    expect(result[0].messageCount).toBe(0);
  });
});

describe("handleListMessages", () => {
  it("fetches, maps, caches, and returns messages", async () => {
    vi.mocked(store.getInbox).mockReturnValue({ id: "i1", address: "a@b.com", token: "tok", messages: [] });
    vi.mocked(mailtm.fetchMessages).mockResolvedValue([
      { id: "m1", subject: "Hi", from: { address: "x@y.com", name: "X" }, intro: "...", createdAt: "2024-01-01", seen: false },
    ]);

    const result = parse(await handleListMessages({ inboxId: "i1" }));
    expect(result).toHaveLength(1);
    expect(result[0].from).toBe("x@y.com");
    expect(store.updateMessages).toHaveBeenCalledWith("i1", [
      { id: "m1", subject: "Hi", from: "x@y.com", intro: "...", createdAt: "2024-01-01" },
    ]);
  });

  it("throws if inbox not found", async () => {
    vi.mocked(store.getInbox).mockReturnValue(undefined);
    await expect(handleListMessages({ inboxId: "bad" })).rejects.toThrow("Inbox bad not found");
  });
});

describe("handleGetMessage", () => {
  it("returns message detail", async () => {
    vi.mocked(store.getInbox).mockReturnValue({ id: "i1", address: "a@b.com", token: "tok", messages: [] });
    vi.mocked(mailtm.fetchMessage).mockResolvedValue({
      id: "m1", subject: "Hi", from: { address: "x@y.com", name: "X" },
      intro: "...", createdAt: "2024-01-01", seen: false, text: "Hello!", html: ["<p>Hello!</p>"],
    });

    const result = parse(await handleGetMessage({ inboxId: "i1", messageId: "m1" }));
    expect(result.text).toBe("Hello!");
    expect(result.from).toBe("x@y.com");
  });

  it("throws if inbox not found", async () => {
    vi.mocked(store.getInbox).mockReturnValue(undefined);
    await expect(handleGetMessage({ inboxId: "bad", messageId: "m1" })).rejects.toThrow("Inbox bad not found");
  });
});

describe("handleDeleteInbox", () => {
  it("deletes from mailtm and store, returns success", async () => {
    vi.mocked(store.getInbox).mockReturnValue({ id: "i1", address: "a@b.com", token: "tok", messages: [] });
    vi.mocked(mailtm.deleteMailTmAccount).mockResolvedValue(undefined);

    const result = parse(await handleDeleteInbox({ inboxId: "i1" }));
    expect(result.success).toBe(true);
    expect(mailtm.deleteMailTmAccount).toHaveBeenCalledWith("tok", "i1");
    expect(store.removeInbox).toHaveBeenCalledWith("i1");
  });

  it("throws if inbox not found", async () => {
    vi.mocked(store.getInbox).mockReturnValue(undefined);
    await expect(handleDeleteInbox({ inboxId: "bad" })).rejects.toThrow("Inbox bad not found");
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test
```
Expected: `Cannot find module './mcp-server.js'`

- [ ] **Step 3: Implement mcp-server.ts**

Create `src/mcp-server.ts`:
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createMailTmInbox, fetchMessages, fetchMessage, deleteMailTmAccount } from "./mailtm.js";
import { addInbox, getInbox, listInboxes, updateMessages, removeInbox } from "./inbox-store.js";
import type { StoredMessage } from "./inbox-store.js";

type ToolResult = { content: [{ type: "text"; text: string }] };

function text(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

export async function handleCreateInbox(): Promise<ToolResult> {
  const mailtm = await createMailTmInbox();
  addInbox({ ...mailtm, messages: [] });
  const inbox = getInbox(mailtm.id)!;
  return text({ id: inbox.id, address: inbox.address });
}

export async function handleListInboxes(): Promise<ToolResult> {
  return text(
    listInboxes().map(({ id, address, messages }) => ({ id, address, messageCount: messages.length }))
  );
}

export async function handleListMessages({ inboxId }: { inboxId: string }): Promise<ToolResult> {
  const inbox = getInbox(inboxId);
  if (!inbox) throw new Error(`Inbox ${inboxId} not found`);
  const raw = await fetchMessages(inbox.token);
  const messages: StoredMessage[] = raw.map((m) => ({
    id: m.id,
    subject: m.subject,
    from: m.from.address,
    intro: m.intro,
    createdAt: m.createdAt,
  }));
  updateMessages(inboxId, messages);
  return text(messages);
}

export async function handleGetMessage({ inboxId, messageId }: { inboxId: string; messageId: string }): Promise<ToolResult> {
  const inbox = getInbox(inboxId);
  if (!inbox) throw new Error(`Inbox ${inboxId} not found`);
  const detail = await fetchMessage(inbox.token, messageId);
  return text({ subject: detail.subject, from: detail.from.address, text: detail.text, html: detail.html });
}

export async function handleDeleteInbox({ inboxId }: { inboxId: string }): Promise<ToolResult> {
  const inbox = getInbox(inboxId);
  if (!inbox) throw new Error(`Inbox ${inboxId} not found`);
  await deleteMailTmAccount(inbox.token, inbox.id);
  removeInbox(inboxId);
  return text({ success: true });
}

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "tempy", version: "0.1.0" });

  server.tool("create_inbox", "Creates a new temporary email inbox", {}, handleCreateInbox);

  server.tool("list_inboxes", "Lists all active inboxes in this session", {}, handleListInboxes);

  server.tool(
    "list_messages",
    "Fetches messages for an inbox (call repeatedly to poll for new mail)",
    { inboxId: z.string().describe("Inbox ID from create_inbox") },
    handleListMessages
  );

  server.tool(
    "get_message",
    "Gets the full body of a specific message",
    {
      inboxId: z.string().describe("Inbox ID"),
      messageId: z.string().describe("Message ID from list_messages"),
    },
    handleGetMessage
  );

  server.tool(
    "delete_inbox",
    "Deletes an inbox from mail.tm and removes it from this session",
    { inboxId: z.string().describe("Inbox ID to delete") },
    handleDeleteInbox
  );

  return server;
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npm test
```
Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/mcp-server.ts src/mcp-server.test.ts
git commit -m "feat: MCP server with 5 tools"
```

---

### Task 5: HTTP Server

**Files:**
- Create: `src/http-server.ts`
- Create: `src/http-server.test.ts`

**Interfaces:**
- Consumes:
  - `createMailTmInbox`, `fetchMessages`, `fetchMessage`, `deleteMailTmAccount` from `./mailtm.js`
  - `addInbox`, `getInbox`, `listInboxes`, `updateMessages`, `removeInbox` from `./inbox-store.js`
- Produces:
  ```typescript
  createHttpServer(): express.Express
  ```
  REST surface:
  - `GET  /api/inboxes` → 200 `{ id, address, messageCount }[]`
  - `POST /api/inboxes` → 201 `StoredInbox`
  - `GET  /api/inboxes/:id/messages` → 200 `StoredMessage[]` | 404
  - `GET  /api/inboxes/:id/messages/:msgId` → 200 `{ subject, from, text, html }` | 404
  - `DELETE /api/inboxes/:id` → 204 | 404

- [ ] **Step 1: Write failing tests**

Create `src/http-server.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("./mailtm.js", () => ({
  createMailTmInbox: vi.fn(),
  fetchMessages: vi.fn(),
  fetchMessage: vi.fn(),
  deleteMailTmAccount: vi.fn(),
}));

vi.mock("./inbox-store.js", () => ({
  addInbox: vi.fn(),
  getInbox: vi.fn(),
  listInboxes: vi.fn(),
  updateMessages: vi.fn(),
  removeInbox: vi.fn(),
}));

import * as mailtm from "./mailtm.js";
import * as store from "./inbox-store.js";
import { createHttpServer } from "./http-server.js";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/inboxes", () => {
  it("returns inbox list with message counts", async () => {
    vi.mocked(store.listInboxes).mockReturnValue([
      { id: "i1", address: "a@b.com", token: "tok", messages: [{ id: "m1", subject: "Hi", from: "x@y.com", intro: "...", createdAt: "2024-01-01" }] },
    ]);
    const res = await request(createHttpServer()).get("/api/inboxes");
    expect(res.status).toBe(200);
    expect(res.body[0].messageCount).toBe(1);
  });
});

describe("POST /api/inboxes", () => {
  it("creates and returns new inbox", async () => {
    vi.mocked(mailtm.createMailTmInbox).mockResolvedValue({ id: "i1", address: "a@b.com", token: "tok" });
    vi.mocked(store.getInbox).mockReturnValue({ id: "i1", address: "a@b.com", token: "tok", messages: [] });

    const res = await request(createHttpServer()).post("/api/inboxes");
    expect(res.status).toBe(201);
    expect(res.body.address).toBe("a@b.com");
    expect(store.addInbox).toHaveBeenCalledWith({ id: "i1", address: "a@b.com", token: "tok", messages: [] });
  });

  it("returns 500 on mailtm failure", async () => {
    vi.mocked(mailtm.createMailTmInbox).mockRejectedValue(new Error("API down"));
    const res = await request(createHttpServer()).post("/api/inboxes");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/inboxes/:id/messages", () => {
  it("fetches and returns messages", async () => {
    vi.mocked(store.getInbox).mockReturnValue({ id: "i1", address: "a@b.com", token: "tok", messages: [] });
    vi.mocked(mailtm.fetchMessages).mockResolvedValue([
      { id: "m1", subject: "Hi", from: { address: "x@y.com", name: "X" }, intro: "...", createdAt: "2024-01-01", seen: false },
    ]);
    const res = await request(createHttpServer()).get("/api/inboxes/i1/messages");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].from).toBe("x@y.com");
  });

  it("returns 404 for unknown inbox", async () => {
    vi.mocked(store.getInbox).mockReturnValue(undefined);
    const res = await request(createHttpServer()).get("/api/inboxes/bad/messages");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/inboxes/:id/messages/:msgId", () => {
  it("returns full message detail", async () => {
    vi.mocked(store.getInbox).mockReturnValue({ id: "i1", address: "a@b.com", token: "tok", messages: [] });
    vi.mocked(mailtm.fetchMessage).mockResolvedValue({
      id: "m1", subject: "Hi", from: { address: "x@y.com", name: "X" },
      intro: "...", createdAt: "2024-01-01", seen: false, text: "Hello!", html: ["<p>Hello!</p>"],
    });
    const res = await request(createHttpServer()).get("/api/inboxes/i1/messages/m1");
    expect(res.status).toBe(200);
    expect(res.body.text).toBe("Hello!");
    expect(res.body.from).toBe("x@y.com");
  });

  it("returns 404 for unknown inbox", async () => {
    vi.mocked(store.getInbox).mockReturnValue(undefined);
    const res = await request(createHttpServer()).get("/api/inboxes/bad/messages/m1");
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/inboxes/:id", () => {
  it("deletes inbox and returns 204", async () => {
    vi.mocked(store.getInbox).mockReturnValue({ id: "i1", address: "a@b.com", token: "tok", messages: [] });
    vi.mocked(mailtm.deleteMailTmAccount).mockResolvedValue(undefined);

    const res = await request(createHttpServer()).delete("/api/inboxes/i1");
    expect(res.status).toBe(204);
    expect(store.removeInbox).toHaveBeenCalledWith("i1");
  });

  it("returns 404 for unknown inbox", async () => {
    vi.mocked(store.getInbox).mockReturnValue(undefined);
    const res = await request(createHttpServer()).delete("/api/inboxes/bad");
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test
```
Expected: `Cannot find module './http-server.js'`

- [ ] **Step 3: Implement http-server.ts**

Create `src/http-server.ts`:
```typescript
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createMailTmInbox, fetchMessages, fetchMessage, deleteMailTmAccount } from "./mailtm.js";
import { addInbox, getInbox, listInboxes, updateMessages, removeInbox } from "./inbox-store.js";
import type { StoredMessage } from "./inbox-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createHttpServer() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "ui")));

  app.get("/api/inboxes", (_req, res) => {
    res.json(
      listInboxes().map(({ id, address, messages }) => ({ id, address, messageCount: messages.length }))
    );
  });

  app.post("/api/inboxes", async (_req, res) => {
    try {
      const mailtm = await createMailTmInbox();
      addInbox({ ...mailtm, messages: [] });
      res.status(201).json(getInbox(mailtm.id));
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/inboxes/:id/messages", async (req, res) => {
    const inbox = getInbox(req.params.id);
    if (!inbox) { res.status(404).json({ error: "Inbox not found" }); return; }
    try {
      const raw = await fetchMessages(inbox.token);
      const messages: StoredMessage[] = raw.map((m) => ({
        id: m.id, subject: m.subject, from: m.from.address, intro: m.intro, createdAt: m.createdAt,
      }));
      updateMessages(inbox.id, messages);
      res.json(messages);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/inboxes/:id/messages/:msgId", async (req, res) => {
    const inbox = getInbox(req.params.id);
    if (!inbox) { res.status(404).json({ error: "Inbox not found" }); return; }
    try {
      const detail = await fetchMessage(inbox.token, req.params.msgId);
      res.json({ subject: detail.subject, from: detail.from.address, text: detail.text, html: detail.html });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/inboxes/:id", async (req, res) => {
    const inbox = getInbox(req.params.id);
    if (!inbox) { res.status(404).json({ error: "Inbox not found" }); return; }
    try {
      await deleteMailTmAccount(inbox.token, inbox.id);
      removeInbox(inbox.id);
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  return app;
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npm test
```
Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/http-server.ts src/http-server.test.ts
git commit -m "feat: HTTP server with REST API"
```

---

### Task 6: Web UI

**Files:**
- Create: `src/ui/index.html`
- Create: `src/ui/style.css`
- Create: `src/ui/app.js`

**Interfaces:**
- Consumes: REST API from Task 5 (all 5 endpoints)
- No automated tests — verified manually after Task 7

- [ ] **Step 1: Create src/ui/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>tempy</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header>
    <span class="logo">tempy</span>
    <button id="btn-new">+ New Inbox</button>
  </header>
  <main>
    <aside id="inbox-list"></aside>
    <section id="message-panel">
      <ul id="message-list"></ul>
      <article id="message-body"></article>
    </section>
  </main>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create src/ui/style.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body { font-family: system-ui, sans-serif; background: #0f0f0f; color: #e0e0e0; height: 100vh; display: flex; flex-direction: column; }

header { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid #2a2a2a; }

.logo { font-weight: 700; font-size: 1.1rem; letter-spacing: 0.05em; color: #fff; }

button { background: #1a1a2e; color: #a0a0ff; border: 1px solid #3a3a6e; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
button:hover { background: #2a2a4e; }

main { display: flex; flex: 1; overflow: hidden; }

aside { width: 220px; border-right: 1px solid #2a2a2a; overflow-y: auto; flex-shrink: 0; }

.inbox-item { padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #1a1a1a; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; justify-content: space-between; }
.inbox-item:hover, .inbox-item.active { background: #1a1a2e; }
.inbox-item .count { color: #666; font-size: 0.75rem; flex-shrink: 0; margin-left: 8px; }

#message-panel { flex: 1; display: flex; overflow: hidden; }

#message-list { width: 280px; border-right: 1px solid #2a2a2a; overflow-y: auto; list-style: none; flex-shrink: 0; }

.msg-item { padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #1a1a1a; }
.msg-item:hover, .msg-item.active { background: #1a1a2e; }
.msg-item .subject { font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.msg-item .from { font-size: 0.75rem; color: #888; margin-top: 2px; }

#message-body { flex: 1; padding: 24px; overflow-y: auto; font-size: 0.9rem; line-height: 1.6; }
#message-body h2 { font-size: 1rem; margin-bottom: 8px; }
#message-body .meta { color: #888; font-size: 0.8rem; margin-bottom: 16px; }
#message-body pre { white-space: pre-wrap; font-family: inherit; }

.empty { padding: 24px 16px; color: #555; font-size: 0.85rem; }
```

- [ ] **Step 3: Create src/ui/app.js**

```javascript
let selectedInboxId = null;
let selectedMsgId = null;

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  return res.json();
}

async function loadInboxes() {
  const inboxes = await api("GET", "/api/inboxes");
  const list = document.getElementById("inbox-list");
  list.innerHTML = "";
  if (!inboxes.length) {
    list.innerHTML = '<div class="empty">No inboxes yet.<br>Click + New Inbox.</div>';
    return;
  }
  inboxes.forEach((inbox) => {
    const el = document.createElement("div");
    el.className = "inbox-item" + (inbox.id === selectedInboxId ? " active" : "");
    el.innerHTML = `<span>${inbox.address}</span><span class="count">${inbox.messageCount}</span>`;
    el.onclick = () => selectInbox(inbox.id);
    list.appendChild(el);
  });
}

async function selectInbox(id) {
  selectedInboxId = id;
  selectedMsgId = null;
  document.getElementById("message-body").innerHTML = "";
  await loadInboxes();
  await loadMessages(id);
}

async function loadMessages(inboxId) {
  const messages = await api("GET", `/api/inboxes/${inboxId}/messages`);
  const list = document.getElementById("message-list");
  list.innerHTML = "";
  if (!messages.length) {
    list.innerHTML = '<li class="empty">No messages yet.</li>';
    return;
  }
  messages.forEach((msg) => {
    const li = document.createElement("li");
    li.className = "msg-item" + (msg.id === selectedMsgId ? " active" : "");
    li.innerHTML = `<div class="subject">${msg.subject || "(no subject)"}</div><div class="from">${msg.from}</div>`;
    li.onclick = () => loadMessageBody(inboxId, msg.id);
    list.appendChild(li);
  });
}

async function loadMessageBody(inboxId, msgId) {
  selectedMsgId = msgId;
  const detail = await api("GET", `/api/inboxes/${inboxId}/messages/${msgId}`);
  document.getElementById("message-body").innerHTML = `
    <h2>${detail.subject || "(no subject)"}</h2>
    <div class="meta">From: ${detail.from}</div>
    <pre>${detail.text || "(no plain text body)"}</pre>
  `;
}

document.getElementById("btn-new").onclick = async () => {
  await api("POST", "/api/inboxes");
  await loadInboxes();
};

loadInboxes();
setInterval(() => {
  loadInboxes();
  if (selectedInboxId) loadMessages(selectedInboxId);
}, 3000);
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/
git commit -m "feat: web UI"
```

---

### Task 7: Entry Point + npm Setup

**Files:**
- Modify: `src/index.ts`
- Create: `README.md`

**Interfaces:**
- Consumes: `createMcpServer` from `./mcp-server.js`, `createHttpServer` from `./http-server.js`

- [ ] **Step 1: Implement src/index.ts**

```typescript
#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcp-server.js";
import { createHttpServer } from "./http-server.js";

const PORT = parseInt(process.env.TEMPY_PORT ?? "3000", 10);

const httpApp = createHttpServer();
httpApp.listen(PORT, () => {
  process.stderr.write(`tempy UI → http://localhost:${PORT}\n`);
});

const mcpServer = createMcpServer();
const transport = new StdioServerTransport();
await mcpServer.connect(transport);
```

- [ ] **Step 2: Build**

```bash
npm run build
```
Expected: `dist/` contains `index.js`, `mcp-server.js`, `http-server.js`, `inbox-store.js`, `mailtm.js`, and `ui/`.

- [ ] **Step 3: Smoke test — verify both surfaces start**

In one terminal:
```bash
node dist/index.js
```
Expected on stderr: `tempy UI → http://localhost:3000`

Open `http://localhost:3000` in a browser. Expected: dark UI with "No inboxes yet." and a `+ New Inbox` button.

Press Ctrl+C to stop.

- [ ] **Step 4: Smoke test — MCP protocol responds**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js 2>/dev/null
```
Expected: JSON with `"tools"` array listing `create_inbox`, `list_inboxes`, `list_messages`, `get_message`, `delete_inbox`.

- [ ] **Step 5: Write README.md**

```markdown
# tempy-mcp

Disposable email inboxes via [mail.tm](https://mail.tm), accessible through Claude as an MCP server and in the browser at `http://localhost:3000`.

## Setup

Add to your Claude MCP config:

\```json
{
  "mcpServers": {
    "tempy": {
      "command": "npx",
      "args": ["tempy-mcp"]
    }
  }
}
\```

Restart Claude. Ask:
- *"Create a temp inbox"*
- *"Check if the verification email arrived"*
- *"Delete the inbox"*

The web UI at **http://localhost:3000** shows inboxes and emails in real time.

## Automated testing example

> "Sign up on example.com using a temp email, verify the account, confirm it's active."

Claude: creates inbox → fills form → polls for email → extracts link → visits link → deletes inbox.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `TEMPY_PORT` | `3000` | Web UI port |

## Notes

- Inboxes are lost when the process restarts (in-memory only)
- mail.tm addresses are semi-public — for testing only, not production secrets

## License

MIT
```

- [ ] **Step 6: Run full test suite**

```bash
npm test
```
Expected: all tests pass (30 total: 6 mailtm + 7 inbox-store + 8 mcp-server + 9 http-server).

- [ ] **Step 7: Final commit**

```bash
git add src/index.ts README.md
git commit -m "feat: entry point and README"
```
