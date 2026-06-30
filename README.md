# Tempy

Disposable email inboxes for AI agents and humans — an [MCP](https://modelcontextprotocol.io) server backed by [mail.tm](https://mail.tm), with a built-in web UI.

Create throwaway email addresses on demand, read the messages they receive, and delete them when you're done — all from Claude (or any MCP client), or from a local browser dashboard. Handy for signing up to things you don't want in your real inbox, testing email flows, and grabbing one-time verification codes.

- **6 MCP tools** — create inboxes, list them, read messages, delete messages or whole inboxes
- **Web UI** — a three-pane mail client at `http://localhost:3000`
- **Persistent** — inboxes survive restarts (stored locally in `~/.tempy/inboxes.json`)
- **Readable addresses** — names like `lekki-anchor42@…` instead of random gibberish

---

## Requirements

- **Node.js 18 or newer** (`node --version` to check — needs the built-in `fetch`)
- For the Claude integration: [Claude Code](https://claude.com/claude-code) or Claude Desktop

---

## Setup

> Tempy isn't published to npm yet, so the supported path today is **from source**. The `npx` path below will work once it's published.

### Option A — from source (works today)

```bash
git clone https://github.com/davidodejobi/tempy.git
cd tempy
npm install
npm run build
```

That produces `dist/index.js` (the server). Print its absolute path — you'll need it below:

```bash
echo "$(pwd)/dist/index.js"
```

### Option B — via npx (once published)

```bash
npx tempy-mcp
```

No clone or build required; npm fetches and runs it.

---

## Connect it to Claude

### Claude Code (CLI)

Register Tempy as an MCP server. `--scope user` makes it available in every project:

**From source:**
```bash
claude mcp add tempy --scope user -- node /absolute/path/to/tempy/dist/index.js
```

**Once published:**
```bash
claude mcp add tempy --scope user -- npx -y tempy-mcp
```

Then start a new Claude Code session and run `/mcp` — you should see **tempy · connected** with its tools. To remove it later: `claude mcp remove tempy -s user`.

### Claude Desktop

Edit your config file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add a `tempy` entry under `mcpServers`:

**From source:**
```json
{
  "mcpServers": {
    "tempy": {
      "command": "node",
      "args": ["/absolute/path/to/tempy/dist/index.js"]
    }
  }
}
```

**Once published:**
```json
{
  "mcpServers": {
    "tempy": {
      "command": "npx",
      "args": ["-y", "tempy-mcp"]
    }
  }
}
```

Fully quit and reopen Claude Desktop. Tempy's tools appear under the tools (🔌) menu.

---

## Using it

Just ask Claude in plain language:

- *"Create a disposable email inbox."* → returns an address you can use
- *"List my inboxes."*
- *"Show me the messages for that inbox."* (send a test email to the address first)
- *"Open the latest message."* → returns subject, sender, and the body
- *"Delete that message."* / *"Delete that inbox."*

### End-to-end agent example

> "Sign up on example.com with a disposable email, confirm the verification link, then delete the inbox."

Claude creates an inbox → uses the address in the signup form → polls `list_messages` until the email arrives → reads it with `get_message` → follows the link → deletes the inbox.

### Tools reference

| Tool | What it does |
|------|--------------|
| `create_inbox` | Create a new disposable address and return its id + address |
| `list_inboxes` | List your inboxes with message and unread counts |
| `list_messages` | List the messages in an inbox |
| `get_message` | Read one message (subject, sender, text + HTML body) |
| `delete_message` | Delete a single message |
| `delete_inbox` | Delete an inbox (and its mail.tm account) |

---

## Web UI

The same process also serves a browser dashboard. With the server running, open:

```
http://localhost:3000
```

Create addresses, copy them, read mail, and delete inboxes from there. It shares the same storage as the MCP tools, so anything created via Claude shows up in the browser and vice-versa. HTML emails render inside a sandboxed iframe (no script execution); use the HTML/Text toggle to switch views.

While Claude is connected, Tempy is already running. To run it standalone:

```bash
npm start          # from source
# or
node /absolute/path/to/tempy/dist/index.js
```

---

## Configuration

Set these as environment variables when launching the server:

| Variable | Default | Description |
|----------|---------|-------------|
| `TEMPY_PORT` | `3000` | Port for the web UI |
| `TEMPY_DATA_DIR` | `~/.tempy` | Directory for the persisted inbox store |

---

## Where your data lives

Inboxes are saved to `~/.tempy/inboxes.json` (or `$TEMPY_DATA_DIR`) so they survive restarts. The file stores each inbox's mail.tm password in plaintext so Tempy can re-authenticate when a session token expires; it's written with owner-only permissions (`0600`). Delete an inbox to remove it from both mail.tm and the local store, or delete the file to wipe everything.

This is a localhost tool for **disposable** mail — mail.tm addresses are semi-public, so don't use these inboxes for anything sensitive or long-term.

---

## Development

```bash
npm install
npm run build      # compile TypeScript + copy the UI into dist/
npm test           # run the vitest suite
npm run dev        # tsc --watch
```

After changing code, rebuild and restart your Claude session so it picks up the new build.

---

## License

MIT
