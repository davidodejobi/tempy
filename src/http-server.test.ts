import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("./inbox-service.js", () => ({
  createInbox: vi.fn(),
  listInboxSummaries: vi.fn(),
  getMessages: vi.fn(),
  getMessageDetail: vi.fn(),
  deleteInbox: vi.fn(),
  deleteMessage: vi.fn(),
  getQuota: vi.fn(),
  getCredentials: vi.fn(),
}));

import * as service from "./inbox-service.js";
import { createHttpServer } from "./http-server.js";

const NOT_FOUND = (id: string) => new Error(`Inbox ${id} not found`);
beforeEach(() => vi.clearAllMocks());

describe("GET /api/inboxes", () => {
  it("returns summaries with unread counts", async () => {
    vi.mocked(service.listInboxSummaries).mockReturnValue([{ id: "i1", address: "a@b.com", messageCount: 2, unreadCount: 1 }]);
    const res = await request(createHttpServer()).get("/api/inboxes");
    expect(res.status).toBe(200);
    expect(res.body[0].unreadCount).toBe(1);
  });
});

describe("POST /api/inboxes", () => {
  it("creates and returns id+address", async () => {
    vi.mocked(service.createInbox).mockResolvedValue({ id: "i1", address: "a@b.com" });
    const res = await request(createHttpServer()).post("/api/inboxes");
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: "i1", address: "a@b.com" });
  });
  it("returns 500 on failure", async () => {
    vi.mocked(service.createInbox).mockRejectedValue(new Error("API down"));
    const res = await request(createHttpServer()).post("/api/inboxes");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/inboxes/:id/messages", () => {
  it("returns messages", async () => {
    vi.mocked(service.getMessages).mockResolvedValue([
      { id: "m1", subject: "Hi", from: "x@y.com", intro: "...", createdAt: "2024-01-01", seen: false },
    ]);
    const res = await request(createHttpServer()).get("/api/inboxes/i1/messages");
    expect(res.status).toBe(200);
    expect(res.body[0].from).toBe("x@y.com");
  });
  it("returns 404 for unknown inbox", async () => {
    vi.mocked(service.getMessages).mockRejectedValue(NOT_FOUND("bad"));
    const res = await request(createHttpServer()).get("/api/inboxes/bad/messages");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/inboxes/:id/messages/:msgId", () => {
  it("returns detail", async () => {
    vi.mocked(service.getMessageDetail).mockResolvedValue({ subject: "Hi", from: "x@y.com", text: "Hello!", html: ["<p>Hello!</p>"], createdAt: "2024-01-01" });
    const res = await request(createHttpServer()).get("/api/inboxes/i1/messages/m1");
    expect(res.status).toBe(200);
    expect(res.body.text).toBe("Hello!");
  });
  it("returns 404 for unknown inbox", async () => {
    vi.mocked(service.getMessageDetail).mockRejectedValue(NOT_FOUND("bad"));
    const res = await request(createHttpServer()).get("/api/inboxes/bad/messages/m1");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/inboxes/:id/quota", () => {
  it("returns quota", async () => {
    vi.mocked(service.getQuota).mockResolvedValue({ used: 16000, quota: 40000000 });
    const res = await request(createHttpServer()).get("/api/inboxes/i1/quota");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ used: 16000, quota: 40000000 });
  });
  it("returns 404 for unknown inbox", async () => {
    vi.mocked(service.getQuota).mockRejectedValue(NOT_FOUND("bad"));
    const res = await request(createHttpServer()).get("/api/inboxes/bad/quota");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/inboxes/:id/credentials", () => {
  it("returns address and password", async () => {
    vi.mocked(service.getCredentials).mockReturnValue({ address: "a@b.com", password: "pw" });
    const res = await request(createHttpServer()).get("/api/inboxes/i1/credentials");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ address: "a@b.com", password: "pw" });
  });
  it("returns 404 for unknown inbox", async () => {
    vi.mocked(service.getCredentials).mockImplementation(() => { throw NOT_FOUND("bad"); });
    const res = await request(createHttpServer()).get("/api/inboxes/bad/credentials");
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/inboxes/:id/messages/:msgId", () => {
  it("returns 204", async () => {
    vi.mocked(service.deleteMessage).mockResolvedValue(undefined);
    const res = await request(createHttpServer()).delete("/api/inboxes/i1/messages/m1");
    expect(res.status).toBe(204);
    expect(service.deleteMessage).toHaveBeenCalledWith("i1", "m1");
  });
  it("returns 404 for unknown inbox", async () => {
    vi.mocked(service.deleteMessage).mockRejectedValue(NOT_FOUND("bad"));
    const res = await request(createHttpServer()).delete("/api/inboxes/bad/messages/m1");
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/inboxes/:id", () => {
  it("returns 204", async () => {
    vi.mocked(service.deleteInbox).mockResolvedValue(undefined);
    const res = await request(createHttpServer()).delete("/api/inboxes/i1");
    expect(res.status).toBe(204);
  });
  it("returns 404 for unknown inbox", async () => {
    vi.mocked(service.deleteInbox).mockRejectedValue(NOT_FOUND("bad"));
    const res = await request(createHttpServer()).delete("/api/inboxes/bad");
    expect(res.status).toBe(404);
  });
});
