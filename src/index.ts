#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcp-server.js";
import { createHttpServer } from "./http-server.js";
import { initStore } from "./inbox-store.js";
import { defaultStorePath } from "./persistence.js";

const PORT = parseInt(process.env.TEMPY_PORT ?? "3000", 10);

const storePath = defaultStorePath();
initStore(storePath);
process.stderr.write(`tempy store → ${storePath}\n`);

const httpApp = createHttpServer();
const server = httpApp.listen(PORT, () => {
  process.stderr.write(`tempy UI → http://localhost:${PORT}\n`);
});
// A busy port (e.g. another client already running Tempy) must not crash the
// MCP server — just skip the web UI for this instance.
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    process.stderr.write(`tempy UI disabled: port ${PORT} in use (set TEMPY_PORT to change)\n`);
  } else {
    process.stderr.write(`tempy UI error: ${err.message}\n`);
  }
});

const mcpServer = createMcpServer();
const transport = new StdioServerTransport();
await mcpServer.connect(transport);
