import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./mailtm.js", () => ({
  createMailTmInbox: vi.fn(),
  fetchMessages: vi.fn(),
  fetchMessage: vi.fn(),
  deleteMailTmAccount: vi.fn(),
  deleteMessage: vi.fn(),
  loginMailTm: vi.fn(),
  fetchAccount: vi.fn(),
  markSeen: vi.fn(),
}));
vi.mock("./inbox-store.js", () => ({
  addInbox: vi.fn(),
  getInbox: vi.fn(),
  listInboxes: vi.fn(),
  updateMessages: vi.fn(),
  removeInbox: vi.fn(),
  setToken: vi.fn(),
}));

import * as mailtm from "./mailtm.js";
import * as store from "./inbox-store.js";
import {
  createInbox, listInboxSummaries, getMessages, getMessageDetail,
  deleteInbox, deleteMessage, getQuota, getCredentials,
} from "./inbox-service.js";

const inbox = { id: "i1", address: "a@b.com", token: "tok", password: "pw", messages: [] };
beforeEach(() => vi.clearAllMocks());

describe("createInbox", () => {
  it("creates, stores, returns id and address", async () => {
    vi.mocked(mailtm.createMailTmInbox).mockResolvedValue({ id: "i1", address: "a@b.com", token: "tok", password: "pw" });
    const result = await createInbox();
    expect(result).toEqual({ id: "i1", address: "a@b.com" });
    expect(store.addInbox).toHaveBeenCalledWith({ id: "i1", address: "a@b.com", token: "tok", password: "pw", messages: [] });
  });
});

describe("listInboxSummaries", () => {
  it("computes message and unread counts", () => {
    vi.mocked(store.listInboxes).mockReturnValue([
      { ...inbox, messages: [
        { id: "m1", subject: "a", from: "x", intro: "", createdAt: "", seen: false },
        { id: "m2", subject: "b", from: "y", intro: "", createdAt: "", seen: true },
      ] },
    ]);
    expect(listInboxSummaries()).toEqual([{ id: "i1", address: "a@b.com", messageCount: 2, unreadCount: 1 }]);
  });
});

describe("getMessages", () => {
  it("maps, caches, returns messages", async () => {
    vi.mocked(store.getInbox).mockReturnValue(inbox);
    vi.mocked(mailtm.fetchMessages).mockResolvedValue([
      { id: "m1", subject: "Hi", from: { address: "x@y.com", name: "X" }, intro: "...", createdAt: "2024-01-01", seen: false },
    ]);
    const result = await getMessages("i1");
    expect(result).toEqual([{ id: "m1", subject: "Hi", from: "x@y.com", intro: "...", createdAt: "2024-01-01", seen: false }]);
    expect(store.updateMessages).toHaveBeenCalledWith("i1", result);
  });

  it("throws if inbox not found", async () => {
    vi.mocked(store.getInbox).mockReturnValue(undefined);
    await expect(getMessages("bad")).rejects.toThrow("Inbox bad not found");
  });

  it("refreshes token once on 401 then succeeds", async () => {
    vi.mocked(store.getInbox).mockReturnValue(inbox);
    vi.mocked(mailtm.fetchMessages)
      .mockRejectedValueOnce(new Error("401 Unauthorized"))
      .mockResolvedValueOnce([]);
    vi.mocked(mailtm.loginMailTm).mockResolvedValue("new-tok");
    const result = await getMessages("i1");
    expect(result).toEqual([]);
    expect(mailtm.loginMailTm).toHaveBeenCalledWith("a@b.com", "pw");
    expect(store.setToken).toHaveBeenCalledWith("i1", "new-tok");
    expect(mailtm.fetchMessages).toHaveBeenCalledTimes(2);
  });

  it("propagates a second 401", async () => {
    vi.mocked(store.getInbox).mockReturnValue(inbox);
    vi.mocked(mailtm.fetchMessages).mockRejectedValue(new Error("401 Unauthorized"));
    vi.mocked(mailtm.loginMailTm).mockResolvedValue("new-tok");
    await expect(getMessages("i1")).rejects.toThrow(/^401/);
    expect(mailtm.fetchMessages).toHaveBeenCalledTimes(2);
  });
});

describe("getMessageDetail", () => {
  it("returns detail and marks seen", async () => {
    vi.mocked(store.getInbox).mockReturnValue(inbox);
    vi.mocked(mailtm.fetchMessage).mockResolvedValue({
      id: "m1", subject: "Hi", from: { address: "x@y.com", name: "X" },
      intro: "...", createdAt: "2024-01-01", seen: false, text: "Hello!", html: ["<p>Hello!</p>"],
    });
    const result = await getMessageDetail("i1", "m1");
    expect(result).toEqual({ subject: "Hi", from: "x@y.com", text: "Hello!", html: ["<p>Hello!</p>"], createdAt: "2024-01-01" });
    expect(mailtm.markSeen).toHaveBeenCalledWith("tok", "m1");
  });

  it("throws if inbox not found", async () => {
    vi.mocked(store.getInbox).mockReturnValue(undefined);
    await expect(getMessageDetail("bad", "m1")).rejects.toThrow("Inbox bad not found");
  });
});

describe("deleteInbox", () => {
  it("deletes from mailtm and store", async () => {
    vi.mocked(store.getInbox).mockReturnValue(inbox);
    await deleteInbox("i1");
    expect(mailtm.deleteMailTmAccount).toHaveBeenCalledWith("tok", "i1");
    expect(store.removeInbox).toHaveBeenCalledWith("i1");
  });
  it("throws if inbox not found", async () => {
    vi.mocked(store.getInbox).mockReturnValue(undefined);
    await expect(deleteInbox("bad")).rejects.toThrow("Inbox bad not found");
  });
});

describe("deleteMessage", () => {
  it("deletes from mailtm and updates the cached list", async () => {
    const withMsgs = { ...inbox, messages: [
      { id: "m1", subject: "a", from: "x", intro: "", createdAt: "", seen: false },
      { id: "m2", subject: "b", from: "y", intro: "", createdAt: "", seen: true },
    ] };
    vi.mocked(store.getInbox).mockReturnValue(withMsgs);
    await deleteMessage("i1", "m1");
    expect(mailtm.deleteMessage).toHaveBeenCalledWith("tok", "m1");
    expect(store.updateMessages).toHaveBeenCalledWith("i1", [
      { id: "m2", subject: "b", from: "y", intro: "", createdAt: "", seen: true },
    ]);
  });

  it("throws if inbox not found", async () => {
    vi.mocked(store.getInbox).mockReturnValue(undefined);
    await expect(deleteMessage("bad", "m1")).rejects.toThrow("Inbox bad not found");
  });
});

describe("getQuota", () => {
  it("returns used and quota", async () => {
    vi.mocked(store.getInbox).mockReturnValue(inbox);
    vi.mocked(mailtm.fetchAccount).mockResolvedValue({ used: 1, quota: 2 });
    expect(await getQuota("i1")).toEqual({ used: 1, quota: 2 });
  });
  it("throws if inbox not found", async () => {
    vi.mocked(store.getInbox).mockReturnValue(undefined);
    await expect(getQuota("bad")).rejects.toThrow("Inbox bad not found");
  });
});

describe("getCredentials", () => {
  it("returns address and password", () => {
    vi.mocked(store.getInbox).mockReturnValue(inbox);
    expect(getCredentials("i1")).toEqual({ address: "a@b.com", password: "pw" });
  });
  it("throws if inbox not found", () => {
    vi.mocked(store.getInbox).mockReturnValue(undefined);
    expect(() => getCredentials("bad")).toThrow("Inbox bad not found");
  });
});
