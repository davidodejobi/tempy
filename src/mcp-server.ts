import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createInbox, listInboxSummaries, getMessages, getMessageDetail, deleteInbox, deleteMessage,
} from "./inbox-service.js";
import { openInBrowser } from "./browser.js";

type ToolResult = { content: [{ type: "text"; text: string }] };

function text(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

export async function handleCreateInbox(): Promise<ToolResult> {
  return text(await createInbox());
}

export async function handleListInboxes(): Promise<ToolResult> {
  return text(listInboxSummaries());
}

export async function handleListMessages({ inboxId }: { inboxId: string }): Promise<ToolResult> {
  return text(await getMessages(inboxId));
}

export async function handleGetMessage({ inboxId, messageId }: { inboxId: string; messageId: string }): Promise<ToolResult> {
  return text(await getMessageDetail(inboxId, messageId));
}

export async function handleDeleteInbox({ inboxId }: { inboxId: string }): Promise<ToolResult> {
  await deleteInbox(inboxId);
  return text({ success: true });
}

export async function handleDeleteMessage({ inboxId, messageId }: { inboxId: string; messageId: string }): Promise<ToolResult> {
  await deleteMessage(inboxId, messageId);
  return text({ success: true });
}

// Builds the open_dashboard handler. The opener is injected so tests can run
// without actually launching a browser.
export function makeOpenDashboardHandler(
  uiUrl: string,
  open: (url: string) => boolean = openInBrowser
) {
  return async ({ inboxId, messageId }: { inboxId?: string; messageId?: string }): Promise<ToolResult> => {
    const params = new URLSearchParams();
    if (inboxId) params.set("inbox", inboxId);
    // A message only makes sense within its inbox, so ignore it without one.
    if (inboxId && messageId) params.set("msg", messageId);
    const query = params.toString();
    const url = query ? `${uiUrl}/?${query}` : uiUrl;
    const opened = open(url);
    return text({ url, opened });
  };
}

export function createMcpServer({ uiUrl = "http://localhost:3000" }: { uiUrl?: string } = {}): McpServer {
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
    { inboxId: z.string().describe("Inbox ID"), messageId: z.string().describe("Message ID from list_messages") },
    handleGetMessage
  );
  server.tool(
    "delete_inbox",
    "Deletes an inbox from mail.tm and removes it from this session",
    { inboxId: z.string().describe("Inbox ID to delete") },
    handleDeleteInbox
  );
  server.tool(
    "delete_message",
    "Deletes a single message from an inbox",
    { inboxId: z.string().describe("Inbox ID"), messageId: z.string().describe("Message ID from list_messages") },
    handleDeleteMessage
  );
  server.tool(
    "open_dashboard",
    "Opens the Tempy web dashboard in the user's browser so they can visually see inboxes and messages. Use when the user asks to see the emails, view the inbox visually, or open the dashboard. With no arguments it shows the whole dashboard. Pass inboxId to open focused on a specific inbox, and messageId (together with its inboxId) to open that specific message.",
    {
      inboxId: z.string().optional().describe("Optional inbox ID to open the dashboard focused on"),
      messageId: z.string().optional().describe("Optional message ID to open directly; requires inboxId"),
    },
    makeOpenDashboardHandler(uiUrl)
  );
  return server;
}
