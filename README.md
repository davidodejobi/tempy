# Tempy

Throwaway email addresses you can create and read from Claude, or from a small web page on your own machine. It's an [MCP](https://modelcontextprotocol.io) server that talks to [mail.tm](https://mail.tm).

Use it when you want an email address you don't care about. Signing up for something you don't trust, testing your own signup flow, grabbing a one-time verification code. Make an address, read what lands in it, throw it away.

What you get:

- Six tools Claude can call: make an inbox, list inboxes, read messages, delete a message, delete an inbox.
- A web dashboard at `http://localhost:3000` that looks like a normal mail client.
- Inboxes that survive a restart. They're saved to a file in your home folder.
- Readable addresses like `lekki-anchor42@...`, not random junk.

## Quickest setup: let your agent do it

If you already use an AI coding agent (Claude Code, opencode, Gemini CLI), you don't have to run the manual steps below. Paste this and let it install Tempy for you:

> Set up the Tempy MCP server for me. Clone https://github.com/davidodejobi/tempy, run `npm install` then `npm run build` inside it, and register the built `dist/index.js` as an MCP server named `tempy` at user scope so every project can use it. When you're done, confirm it's connected and create one test inbox so I know it works.

It clones, builds, wires up the config, and proves the connection in one pass. If you'd rather do it by hand, or you're on Claude Desktop, keep reading.

## Before you start

You need Node.js 18 or newer. Check with:

```bash
node --version
```

If that prints anything lower than 18, update Node first. Tempy relies on the built-in `fetch`, which older versions don't have.

You also need Claude Code or Claude Desktop, depending on how you want to use it.

## Get it running

The easy way is npx. Nothing to clone, nothing to build, npm fetches Tempy and runs it:

```bash
npx -y tempy-mcp
```

You'll see `tempy UI → http://localhost:3000` and it will sit there waiting for a client to connect. Most of the time you won't run this by hand, your MCP client starts it for you (next section). This is just to prove it works.

### Build from source (only if you want to change the code)

If you'd rather hack on Tempy, clone and build it:

```bash
git clone https://github.com/davidodejobi/tempy.git
cd tempy
npm install
npm run build
```

That creates `dist/index.js`, which is the server. Print its full path so you can point a client at it:

```bash
echo "$(pwd)/dist/index.js"
```

## Hook it up to Claude

### Claude Code

One command. The `--scope user` part makes Tempy available in every project, not just the current one:

```bash
claude mcp add tempy --scope user -- npx -y tempy-mcp
```

Built it from source instead? Point Claude at your file rather than npx:

```bash
claude mcp add tempy --scope user -- node /paste/your/path/to/dist/index.js
```

Now open a new Claude Code session and run `/mcp`. You should see tempy in the list, connected, with its tools under it. That's it.

Want it gone later? `claude mcp remove tempy -s user`.

### Claude Desktop

Open the config file for your system:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add Tempy under `mcpServers`:

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

Built it from source? Use `node` and the path to your file instead:

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

Quit Claude Desktop completely, then open it again. Tempy's tools show up in the tools menu.

## Other MCP clients

Tempy talks over stdio, so anything that speaks MCP can run it. The configs below all use npx, so no clone needed. If you built from source, swap `npx -y tempy-mcp` for `node /paste/your/path/to/dist/index.js`. Only the config file and its syntax change.

One thing to know first. Each client starts its own copy of Tempy, and every copy wants the web page on port 3000. The first one to start gets it. If the port is already taken, that copy quietly skips the web page and the tools keep working. To give each client its own dashboard, set a different `TEMPY_PORT` per client, as below.

### opencode

In `~/.config/opencode/opencode.json`, under `mcp`:

```json
{
  "mcp": {
    "tempy": {
      "type": "local",
      "command": ["npx", "-y", "tempy-mcp"],
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
      "command": "npx",
      "args": ["-y", "tempy-mcp"],
      "env": { "TEMPY_PORT": "3002" }
    }
  }
}
```

### Codex CLI

In `~/.codex/config.toml`:

```toml
[mcp_servers.tempy]
command = "npx"
args = ["-y", "tempy-mcp"]
env = { TEMPY_PORT = "3003" }
```

### Antigravity

Antigravity adds MCP servers through its settings, using the same shape as Claude Desktop:

```json
{
  "mcpServers": {
    "tempy": {
      "command": "npx",
      "args": ["-y", "tempy-mcp"],
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

The same process serves a dashboard. While the server is running, open:

```
http://localhost:3000
```

This is your window into the inboxes, and it works two ways:

- **Watch the AI work.** When Claude makes an inbox and a verification email lands in it, you see it happen. The page refreshes every few seconds, so mail shows up on its own without you reloading. Handy when you're testing a flow and want to confirm the AI actually got the email it claims it got.
- **Do it yourself.** Make addresses, copy them, read mail, and delete inboxes right from the page, no AI involved. Grab an address, paste it into whatever you're testing by hand, and watch the message arrive.

Either way it's the same data. An inbox Claude makes in chat shows up in the browser, and an address you create in the browser is one Claude can read. HTML emails render inside a locked-down iframe, so nothing in them can run, and there's a toggle to switch between the HTML and plain-text view.

Running Tempy in more than one app at once? Each app gets its own dashboard:

- Claude → `localhost:3000`
- opencode → `localhost:3001`
- and so on (full list of ports further down)

Open the page for the app you want to watch. If you only use Tempy in one place, none of this matters.

If Claude is connected, the server is already up. To run it on its own:

```bash
npx -y tempy-mcp
```

From source, use `npm start`, or point node straight at the built file:

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

MIT. See [LICENSE](LICENSE) for the full text.
