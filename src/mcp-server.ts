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
