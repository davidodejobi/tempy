export interface StoredMessage {
  id: string;
  subject: string;
  from: string;
  intro: string;
  createdAt: string;
}

export interface StoredInbox {
  id: string;
  address: string;
  token: string;
  messages: StoredMessage[];
}

const inboxes = new Map<string, StoredInbox>();

export function addInbox(inbox: StoredInbox): void {
  inboxes.set(inbox.id, { ...inbox, messages: [...inbox.messages] });
}

export function getInbox(id: string): StoredInbox | undefined {
  return inboxes.get(id);
}

export function listInboxes(): StoredInbox[] {
  return Array.from(inboxes.values());
}

export function updateMessages(inboxId: string, messages: StoredMessage[]): void {
  const inbox = inboxes.get(inboxId);
  if (inbox) inbox.messages = messages;
}

export function removeInbox(id: string): boolean {
  return inboxes.delete(id);
}

export function clearAll(): void {
  inboxes.clear();
}
