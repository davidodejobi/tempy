import {
  createMailTmInbox, fetchMessages, fetchMessage, deleteMailTmAccount,
  deleteMessage as deleteMailTmMessage, loginMailTm, fetchAccount, markSeen,
} from "./mailtm.js";
import { addInbox, getInbox, listInboxes, updateMessages, removeInbox, setToken } from "./inbox-store.js";
import type { StoredInbox, StoredMessage } from "./inbox-store.js";

function requireInbox(inboxId: string): StoredInbox {
  const inbox = getInbox(inboxId);
  if (!inbox) throw new Error(`Inbox ${inboxId} not found`);
  return inbox;
}

function isAuthError(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith("401");
}

// Runs fn with the inbox's token; on a 401, re-logs-in once, persists the new token, retries.
async function withFreshToken<T>(inbox: StoredInbox, fn: (token: string) => Promise<T>): Promise<T> {
  try {
    return await fn(inbox.token);
  } catch (e) {
    if (!isAuthError(e)) throw e;
    const token = await loginMailTm(inbox.address, inbox.password);
    setToken(inbox.id, token);
    return fn(token);
  }
}

export async function createInbox(): Promise<{ id: string; address: string }> {
  const created = await createMailTmInbox();
  addInbox({ ...created, messages: [] });
  return { id: created.id, address: created.address };
}

export function listInboxSummaries(): { id: string; address: string; messageCount: number; unreadCount: number }[] {
  return listInboxes().map(({ id, address, messages }) => ({
    id,
    address,
    messageCount: messages.length,
    unreadCount: messages.filter((m) => !m.seen).length,
  }));
}

export async function getMessages(inboxId: string): Promise<StoredMessage[]> {
  const inbox = requireInbox(inboxId);
  const raw = await withFreshToken(inbox, (t) => fetchMessages(t));
  const messages: StoredMessage[] = raw.map((m) => ({
    id: m.id, subject: m.subject, from: m.from.address, intro: m.intro, createdAt: m.createdAt, seen: m.seen,
  }));
  updateMessages(inboxId, messages);
  return messages;
}

export async function getMessageDetail(inboxId: string, messageId: string) {
  const inbox = requireInbox(inboxId);
  const detail = await withFreshToken(inbox, (t) => fetchMessage(t, messageId));
  await withFreshToken(inbox, (t) => markSeen(t, messageId).then(() => undefined)).catch(() => undefined);
  return { subject: detail.subject, from: detail.from.address, text: detail.text, html: detail.html, createdAt: detail.createdAt };
}

export async function deleteInbox(inboxId: string): Promise<void> {
  const inbox = requireInbox(inboxId);
  await deleteMailTmAccount(inbox.token, inbox.id);
  removeInbox(inboxId);
}

export async function deleteMessage(inboxId: string, messageId: string): Promise<void> {
  const inbox = requireInbox(inboxId);
  await withFreshToken(inbox, (t) => deleteMailTmMessage(t, messageId));
  updateMessages(inboxId, inbox.messages.filter((m) => m.id !== messageId));
}

export async function getQuota(inboxId: string): Promise<{ used: number; quota: number }> {
  const inbox = requireInbox(inboxId);
  return withFreshToken(inbox, (t) => fetchAccount(t));
}

export function getCredentials(inboxId: string): { address: string; password: string } {
  const inbox = requireInbox(inboxId);
  return { address: inbox.address, password: inbox.password };
}
