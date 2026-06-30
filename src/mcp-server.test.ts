import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./mailtm.js", () => ({
  createMailTmInbox: vi.fn(),
  fetchMessages: vi.fn(),
  fetchMessage: vi.fn(),
  deleteMailTmAccount: vi.fn(),
}));

vi.mock("./inbox-store.js", () => ({
  addInbox: vi.fn(),
  getInbox: vi.fn(),
  listInboxes: vi.fn(),
  updateMessages: vi.fn(),
  removeInbox: vi.fn(),
  clearAll: vi.fn(),
}));

import * as mailtm from "./mailtm.js";
import * as store from "./inbox-store.js";
import {
  handleCreateInbox,
  handleListInboxes,
  handleListMessages,
  handleGetMessage,
  handleDeleteInbox,
} from "./mcp-server.js";

function parse(result: { content: { text: string }[] }) {
  return JSON.parse(result.content[0].text);
}

beforeEach(() => vi.clearAllMocks());

describe("handleCreateInbox", () => {
  it("creates inbox and returns address and id", async () => {
    vi.mocked(mailtm.createMailTmInbox).mockResolvedValue({ id: "i1", address: "a@b.com", token: "tok" });
    vi.mocked(store.getInbox).mockReturnValue({ id: "i1", address: "a@b.com", token: "tok", messages: [] });

    const result = parse(await handleCreateInbox());
    expect(result.address).toBe("a@b.com");
    expect(result.id).toBe("i1");
    expect(store.addInbox).toHaveBeenCalledWith({ id: "i1", address: "a@b.com", token: "tok", messages: [] });
  });
});

describe("handleListInboxes", () => {
  it("returns all inboxes with message counts", async () => {
    vi.mocked(store.listInboxes).mockReturnValue([
      { id: "i1", address: "a@b.com", token: "tok", messages: [] },
    ]);
    const result = parse(await handleListInboxes());
    expect(result).toHaveLength(1);
    expect(result[0].messageCount).toBe(0);
  });
});

describe("handleListMessages", () => {
  it("fetches, maps, caches, and returns messages", async () => {
    vi.mocked(store.getInbox).mockReturnValue({ id: "i1", address: "a@b.com", token: "tok", messages: [] });
    vi.mocked(mailtm.fetchMessages).mockResolvedValue([
      { id: "m1", subject: "Hi", from: { address: "x@y.com", name: "X" }, intro: "...", createdAt: "2024-01-01", seen: false },
    ]);

    const result = parse(await handleListMessages({ inboxId: "i1" }));
    expect(result).toHaveLength(1);
    expect(result[0].from).toBe("x@y.com");
    expect(store.updateMessages).toHaveBeenCalledWith("i1", [
      { id: "m1", subject: "Hi", from: "x@y.com", intro: "...", createdAt: "2024-01-01" },
    ]);
  });

  it("throws if inbox not found", async () => {
    vi.mocked(store.getInbox).mockReturnValue(undefined);
    await expect(handleListMessages({ inboxId: "bad" })).rejects.toThrow("Inbox bad not found");
  });
});

describe("handleGetMessage", () => {
  it("returns message detail", async () => {
    vi.mocked(store.getInbox).mockReturnValue({ id: "i1", address: "a@b.com", token: "tok", messages: [] });
    vi.mocked(mailtm.fetchMessage).mockResolvedValue({
      id: "m1", subject: "Hi", from: { address: "x@y.com", name: "X" },
      intro: "...", createdAt: "2024-01-01", seen: false, text: "Hello!", html: ["<p>Hello!</p>"],
    });

    const result = parse(await handleGetMessage({ inboxId: "i1", messageId: "m1" }));
    expect(result.text).toBe("Hello!");
    expect(result.from).toBe("x@y.com");
  });

  it("throws if inbox not found", async () => {
    vi.mocked(store.getInbox).mockReturnValue(undefined);
    await expect(handleGetMessage({ inboxId: "bad", messageId: "m1" })).rejects.toThrow("Inbox bad not found");
  });
});

describe("handleDeleteInbox", () => {
  it("deletes from mailtm and store, returns success", async () => {
    vi.mocked(store.getInbox).mockReturnValue({ id: "i1", address: "a@b.com", token: "tok", messages: [] });
    vi.mocked(mailtm.deleteMailTmAccount).mockResolvedValue(undefined);

    const result = parse(await handleDeleteInbox({ inboxId: "i1" }));
    expect(result.success).toBe(true);
    expect(mailtm.deleteMailTmAccount).toHaveBeenCalledWith("tok", "i1");
    expect(store.removeInbox).toHaveBeenCalledWith("i1");
  });

  it("throws if inbox not found", async () => {
    vi.mocked(store.getInbox).mockReturnValue(undefined);
    await expect(handleDeleteInbox({ inboxId: "bad" })).rejects.toThrow("Inbox bad not found");
  });
});
