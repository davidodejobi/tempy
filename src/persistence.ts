import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
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
  mkdirSync(path.dirname(storePath), { recursive: true });
  const tmp = `${storePath}.tmp`;
  writeFileSync(tmp, JSON.stringify({ version: FILE_VERSION, inboxes }, null, 2), "utf8");
  renameSync(tmp, storePath);
}
