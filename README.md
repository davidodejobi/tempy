# tempy-mcp

Disposable email inboxes via [mail.tm](https://mail.tm), accessible through Claude as an MCP server and in the browser at `http://localhost:3000`.

## Setup

Add to your Claude MCP config:

```json
{
  "mcpServers": {
    "tempy": {
      "command": "npx",
      "args": ["tempy-mcp"]
    }
  }
}
```

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
| `TEMPY_DATA_DIR` | `~/.tempy` | Directory for the persisted inbox store |

## Notes

- Inboxes are **persisted** to `~/.tempy/inboxes.json` and survive restarts. Delete that file to wipe all inboxes.
- The store file contains each inbox's mail.tm **password in plaintext** — it's a localhost testing tool, not a secrets vault. Don't use these inboxes for anything sensitive.
- mail.tm tokens expire; Tempy re-authenticates automatically using the stored password.
- HTML emails render inside a sandboxed iframe (no script execution). Use the HTML/Text toggle to switch views.
- mail.tm addresses are semi-public — for testing only, not production secrets

## License

MIT
