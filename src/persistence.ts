import { readFileSync, writeFileSync, mkdirSync, renameSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { StoredInbox } from "./inbox-store.js";

const FILE_VERSION = 1;

export function defaultStorePath(): string {
  const dir = process.env.TEMPY_DATA_DIR ?? path.join(homedir(), ".tempy");
  return path.join(dir, "inboxes.json");
}

export function loadInboxes(storePath: string): StoredInbox[] {
  try {
    const raw = readFileSync(storePath, "utf8");
    const data = JSON.parse(raw) as { version: number; inboxes: StoredInbox[] };
    if (!Array.isArray(data.inboxes)) return [];
    return data.inboxes;
  } catch {
    return [];
  }
}

export function saveInboxes(storePath: string, inboxes: StoredInbox[]): void {
  // The store holds plaintext mail.tm passwords — keep it owner-only.
  mkdirSync(path.dirname(storePath), { recursive: true, mode: 0o700 });
  const tmp = `${storePath}.tmp`;
  writeFileSync(tmp, JSON.stringify({ version: FILE_VERSION, inboxes }, null, 2), { encoding: "utf8", mode: 0o600 });
  chmodSync(tmp, 0o600); // enforce 0o600 even if the tmp file pre-existed with looser perms
  renameSync(tmp, storePath);
}
