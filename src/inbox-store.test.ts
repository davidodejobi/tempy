import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { addInbox, getInbox, listInboxes, updateMessages, removeInbox, clearAll, initStore, setToken } from "./inbox-store.js";
import { loadInboxes } from "./persistence.js";

const sample = { id: "abc", address: "abc@mail.tm", token: "tok", password: "pw", messages: [] };

beforeEach(() => clearAll());

describe("addInbox / getInbox", () => {
  it("stores and retrieves an inbox", () => {
    addInbox(sample);
    expect(getInbox("abc")).toEqual(sample);
  });

  it("returns undefined for unknown id", () => {
    expect(getInbox("nope")).toBeUndefined();
  });
});

describe("listInboxes", () => {
  it("returns empty array initially", () => {
    expect(listInboxes()).toEqual([]);
  });

  it("returns all added inboxes", () => {
    addInbox(sample);
    addInbox({ id: "xyz", address: "xyz@mail.tm", token: "tok2", messages: [] });
    expect(listInboxes()).toHaveLength(2);
  });
});

describe("updateMessages", () => {
  it("replaces the message list for an inbox", () => {
    addInbox(sample);
    const msgs = [{ id: "m1", subject: "Hi", from: "a@b.com", intro: "...", createdAt: "2024-01-01", seen: false }];
    updateMessages("abc", msgs);
    expect(getInbox("abc")?.messages).toEqual(msgs);
  });

  it("does nothing for unknown inboxId", () => {
    expect(() => updateMessages("nope", [])).not.toThrow();
  });
});

describe("removeInbox", () => {
  it("removes inbox and returns true", () => {
    addInbox(sample);
    expect(removeInbox("abc")).toBe(true);
    expect(getInbox("abc")).toBeUndefined();
  });

  it("returns false for unknown id", () => {
    expect(removeInbox("nope")).toBe(false);
  });
});

describe("initStore + write-through", () => {
  let dir: string; let file: string;
  beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), "tempy-store-")); file = path.join(dir, "inboxes.json"); clearAll(); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("persists added inboxes to disk", () => {
    initStore(file);
    addInbox(sample);
    expect(loadInboxes(file)).toEqual([sample]);
  });

  it("loads existing inboxes on init", () => {
    initStore(file);
    addInbox(sample);
    clearAll();
    initStore(file);
    expect(getInbox("abc")).toEqual(sample);
  });

  it("setToken updates token and persists", () => {
    initStore(file);
    addInbox(sample);
    setToken("abc", "new-token");
    expect(getInbox("abc")?.token).toBe("new-token");
    expect(loadInboxes(file)[0].token).toBe("new-token");
  });
});
