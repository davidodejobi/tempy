import { loadInboxes, saveInboxes } from "./persistence.js";

export interface StoredMessage {
  id: string;
  subject: string;
  from: string;
  intro: string;
  createdAt: string;
  seen: boolean;
}

export interface StoredInbox {
  id: string;
  address: string;
  token: string;
  password: string;
  messages: StoredMessage[];
}

const inboxes = new Map<string, StoredInbox>();
let storePath: string | null = null;

function persist(): void {
  if (storePath) saveInboxes(storePath, Array.from(inboxes.values()));
}

export function initStore(path: string): void {
  storePath = path;
  inboxes.clear();
  for (const inbox of loadInboxes(path)) inboxes.set(inbox.id, inbox);
}

export function addInbox(inbox: StoredInbox): void {
  inboxes.set(inbox.id, { ...inbox, messages: [...inbox.messages] });
  persist();
}

export function getInbox(id: string): StoredInbox | undefined {
  return inboxes.get(id);
}

export function listInboxes(): StoredInbox[] {
  return Array.from(inboxes.values());
}

export function updateMessages(inboxId: string, messages: StoredMessage[]): void {
  const inbox = inboxes.get(inboxId);
  if (inbox) { inbox.messages = messages; persist(); }
}

export function setToken(inboxId: string, token: string): void {
  const inbox = inboxes.get(inboxId);
  if (inbox) { inbox.token = token; persist(); }
}

export function removeInbox(id: string): boolean {
  const existed = inboxes.delete(id);
  if (existed) persist();
  return existed;
}

export function clearAll(): void {
  inboxes.clear();
  storePath = null;
}
