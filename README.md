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

## Notes

- Inboxes are lost when the process restarts (in-memory only)
- mail.tm addresses are semi-public — for testing only, not production secrets

## License

MIT
