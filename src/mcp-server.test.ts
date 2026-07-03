import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./inbox-service.js", () => ({
  createInbox: vi.fn(),
  listInboxSummaries: vi.fn(),
  getMessages: vi.fn(),
  getMessageDetail: vi.fn(),
  deleteInbox: vi.fn(),
  deleteMessage: vi.fn(),
}));

import * as service from "./inbox-service.js";
import {
  handleCreateInbox, handleListInboxes, handleListMessages, handleGetMessage, handleDeleteInbox, handleDeleteMessage,
  makeOpenDashboardHandler,
} from "./mcp-server.js";

function parse(result: { content: { text: string }[] }) {
  return JSON.parse(result.content[0].text);
}
beforeEach(() => vi.clearAllMocks());

describe("handleCreateInbox", () => {
  it("returns address and id", async () => {
    vi.mocked(service.createInbox).mockResolvedValue({ id: "i1", address: "a@b.com" });
    const result = parse(await handleCreateInbox());
    expect(result).toEqual({ id: "i1", address: "a@b.com" });
  });
});

describe("handleListInboxes", () => {
  it("returns summaries", async () => {
    vi.mocked(service.listInboxSummaries).mockReturnValue([{ id: "i1", address: "a@b.com", messageCount: 0, unreadCount: 0 }]);
    const result = parse(await handleListInboxes());
    expect(result[0].unreadCount).toBe(0);
  });
});

describe("handleListMessages", () => {
  it("returns messages", async () => {
    vi.mocked(service.getMessages).mockResolvedValue([
      { id: "m1", subject: "Hi", from: "x@y.com", intro: "...", createdAt: "2024-01-01", seen: false },
    ]);
    const result = parse(await handleListMessages({ inboxId: "i1" }));
    expect(result[0].from).toBe("x@y.com");
    expect(service.getMessages).toHaveBeenCalledWith("i1");
  });

  it("propagates not-found errors", async () => {
    vi.mocked(service.getMessages).mockRejectedValue(new Error("Inbox bad not found"));
    await expect(handleListMessages({ inboxId: "bad" })).rejects.toThrow("Inbox bad not found");
  });
});

describe("handleGetMessage", () => {
  it("returns detail", async () => {
    vi.mocked(service.getMessageDetail).mockResolvedValue({ subject: "Hi", from: "x@y.com", text: "Hello!", html: ["<p>Hello!</p>"], createdAt: "2024-01-01" });
    const result = parse(await handleGetMessage({ inboxId: "i1", messageId: "m1" }));
    expect(result.text).toBe("Hello!");
    expect(service.getMessageDetail).toHaveBeenCalledWith("i1", "m1");
  });
});

describe("handleDeleteInbox", () => {
  it("returns success", async () => {
    vi.mocked(service.deleteInbox).mockResolvedValue(undefined);
    const result = parse(await handleDeleteInbox({ inboxId: "i1" }));
    expect(result.success).toBe(true);
    expect(service.deleteInbox).toHaveBeenCalledWith("i1");
  });
});

describe("handleDeleteMessage", () => {
  it("returns success", async () => {
    vi.mocked(service.deleteMessage).mockResolvedValue(undefined);
    const result = parse(await handleDeleteMessage({ inboxId: "i1", messageId: "m1" }));
    expect(result.success).toBe(true);
    expect(service.deleteMessage).toHaveBeenCalledWith("i1", "m1");
  });
});

describe("makeOpenDashboardHandler", () => {
  it("opens the base URL when no inbox is given", async () => {
    const open = vi.fn().mockReturnValue(true);
    const handler = makeOpenDashboardHandler("http://localhost:3000", open);
    const result = parse(await handler({}));
    expect(open).toHaveBeenCalledWith("http://localhost:3000");
    expect(result).toEqual({ url: "http://localhost:3000", opened: true });
  });

  it("deep-links to a specific inbox with an encoded id", async () => {
    const open = vi.fn().mockReturnValue(true);
    const handler = makeOpenDashboardHandler("http://localhost:3000", open);
    const result = parse(await handler({ inboxId: "a b/c" }));
    expect(result.url).toBe("http://localhost:3000/?inbox=a+b%2Fc");
    expect(open).toHaveBeenCalledWith("http://localhost:3000/?inbox=a+b%2Fc");
  });

  it("deep-links to a specific message within its inbox", async () => {
    const open = vi.fn().mockReturnValue(true);
    const handler = makeOpenDashboardHandler("http://localhost:3000", open);
    const result = parse(await handler({ inboxId: "i1", messageId: "m1" }));
    expect(result.url).toBe("http://localhost:3000/?inbox=i1&msg=m1");
  });

  it("ignores a message id when no inbox id is given", async () => {
    const open = vi.fn().mockReturnValue(true);
    const handler = makeOpenDashboardHandler("http://localhost:3000", open);
    const result = parse(await handler({ messageId: "m1" }));
    expect(result.url).toBe("http://localhost:3000");
  });

  it("still returns the URL when the browser cannot open", async () => {
    const open = vi.fn().mockReturnValue(false);
    const handler = makeOpenDashboardHandler("http://localhost:3001", open);
    const result = parse(await handler({}));
    expect(result).toEqual({ url: "http://localhost:3001", opened: false });
  });
});
