import { describe, it, expect, beforeEach } from "vitest";
import { addInbox, getInbox, listInboxes, updateMessages, removeInbox, clearAll } from "./inbox-store.js";

const sample = { id: "abc", address: "abc@mail.tm", token: "tok", messages: [] };

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
    const msgs = [{ id: "m1", subject: "Hi", from: "a@b.com", intro: "...", createdAt: "2024-01-01" }];
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
