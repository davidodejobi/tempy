# Tempy

Throwaway email addresses you can create and read from Claude, or from a small web page on your own machine. It's an [MCP](https://modelcontextprotocol.io) server that talks to [mail.tm](https://mail.tm).

Use it when you want an email address you don't care about. Signing up for something you don't trust, testing your own signup flow, grabbing a one-time verification code. Make an address, read what lands in it, throw it away.

What you get:

- Six tools Claude can call: make an inbox, list inboxes, read messages, delete a message, delete an inbox.
- A web dashboard at `http://localhost:3000` that looks like a normal mail client.
- Inboxes that survive a restart. They're saved to a file in your home folder.
- Readable addresses like `lekki-anchor42@...`, not random junk.

## Before you start

You need Node.js 18 or newer. Check with:

```bash
node --version
```

If that prints anything lower than 18, update Node first. Tempy relies on the built-in `fetch`, which older versions don't have.

You also need Claude Code or Claude Desktop, depending on how you want to use it.

## Get it running

Tempy isn't on npm yet, so for now you build it from source. The `npx` shortcut is here too, for when it's published.

### Build from source (this works today)

```bash
git clone https://github.com/davidodejobi/tempy.git
cd tempy
npm install
npm run build
```

That creates `dist/index.js`. That file is the server. You'll need its full path in a second, so print it now and copy what it shows:

```bash
echo "$(pwd)/dist/index.js"
```

### Or use npx (once it's published)

```bash
npx tempy-mcp
```

Nothing to clone or build. npm grabs it and runs it.

## Hook it up to Claude

### Claude Code

Tell Claude Code where the server is, using the path you just copied. The `--scope user` part makes Tempy available in every project instead of just one:

```bash
claude mcp add tempy --scope user -- node /paste/your/path/to/dist/index.js
```

Once it's published you can skip the path:

```bash
claude mcp add tempy --scope user -- npx -y tempy-mcp
```

Now open a new Claude Code session and run `/mcp`. You should see tempy in the list, connected, with its tools under it. That's it.

Want it gone later? `claude mcp remove tempy -s user`.

### Claude Desktop

Open the config file for your system:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add Tempy under `mcpServers`. From source:

```json
{
  "mcpServers": {
    "tempy": {
      "command": "node",
      "args": ["/paste/your/path/to/dist/index.js"]
    }
  }
}
```

Once it's published:

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

Quit Claude Desktop completely, then open it again. Tempy's tools show up in the tools menu.

## Other MCP clients

Tempy talks over stdio, so anything that speaks MCP can run it. Point each client at the same `dist/index.js`. Only the config file and its syntax change.

One thing to know first. Each client starts its own copy of Tempy, and every copy wants the web page on port 3000. The first one to start gets it. If the port is already taken, that copy quietly skips the web page and the tools keep working. To give each client its own dashboard, set a different `TEMPY_PORT` per client, as below.

### opencode

In `~/.config/opencode/opencode.json`, under `mcp`:

```json
{
  "mcp": {
    "tempy": {
      "type": "local",
      "command": ["node", "/paste/your/path/to/dist/index.js"],
      "enabled": true,
      "environment": { "TEMPY_PORT": "3001" }
    }
  }
}
```

### Gemini CLI

In `~/.gemini/settings.json`, add a top-level `mcpServers`:

```json
{
  "mcpServers": {
    "tempy": {
      "command": "node",
      "args": ["/paste/your/path/to/dist/index.js"],
      "env": { "TEMPY_PORT": "3002" }
    }
  }
}
```

### Codex CLI

In `~/.codex/config.toml`:

```toml
[mcp_servers.tempy]
command = "node"
args = ["/paste/your/path/to/dist/index.js"]
env = { TEMPY_PORT = "3003" }
```

### Antigravity

Antigravity adds MCP servers through its settings, using the same shape as Claude Desktop:

```json
{
  "mcpServers": {
    "tempy": {
      "command": "node",
      "args": ["/paste/your/path/to/dist/index.js"],
      "env": { "TEMPY_PORT": "3004" }
    }
  }
}
```

After editing any of these, restart the client. Most list connected MCP servers under `/mcp`.

## Using it

Talk to Claude like you would a person:

- "Create a disposable email inbox."
- "List my inboxes."
- "Did anything land in that inbox yet?"
- "Open the latest message."
- "Delete that inbox."

A fuller example. You ask:

> "Sign up on example.com with a throwaway email, click the verification link, then delete the inbox."

Claude makes an inbox, drops the address into the form, checks for the email every few seconds, reads it, follows the link, and cleans up after itself.

The six tools, plainly:

| Tool | What it does |
|------|--------------|
| `create_inbox` | Makes a new address and hands back its id |
| `list_inboxes` | Shows your inboxes with message and unread counts |
| `list_messages` | Lists what's in an inbox |
| `get_message` | Opens one message: subject, sender, and body |
| `delete_message` | Deletes a single message |
| `delete_inbox` | Deletes the whole inbox |

## The web page

The same process also serves a dashboard. While the server is running, open:

```
http://localhost:3000
```

You can make addresses, copy them, read mail, and delete inboxes there. It's the same data Claude sees, so an inbox you make in chat shows up in the browser, and the other way around. HTML emails render inside a locked-down iframe, so nothing in them can run. There's a toggle to switch between the HTML and plain-text view.

If Claude is connected, the server is already up. To run it on its own:

```bash
npm start
```

Or point node straight at the built file:

```bash
node /paste/your/path/to/dist/index.js
```

## Settings

Pass these as environment variables when you start the server:

| Variable | Default | What it does |
|----------|---------|--------------|
| `TEMPY_PORT` | `3000` | Port for the web page |
| `TEMPY_DATA_DIR` | `~/.tempy` | Where the inbox file is saved |

## Where your stuff is saved

Inboxes live in `~/.tempy/inboxes.json` (or wherever `TEMPY_DATA_DIR` points). That's why they survive a restart. The file also holds each inbox's mail.tm password in plain text, because Tempy needs it to log back in when a session token expires. The file is locked to your user account only (`0600` permissions), but it's still plain text sitting on disk.

Delete an inbox and it's gone from both mail.tm and the file. Delete the file and everything's wiped.

One thing to be clear about: mail.tm addresses are semi-public, and this is built for disposable mail. Don't run anything private or important through it.

## Working on Tempy

```bash
npm install
npm run build      # compile TypeScript, copy the UI into dist/
npm test           # run the tests
npm run dev        # rebuild on every change
```

Change the code, rebuild, then restart your Claude session so it picks up the new build.

## License

MIT
