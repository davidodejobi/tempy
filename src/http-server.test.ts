import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

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
}));

import * as mailtm from "./mailtm.js";
import * as store from "./inbox-store.js";
import { createHttpServer } from "./http-server.js";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/inboxes", () => {
  it("returns inbox list with message counts", async () => {
    vi.mocked(store.listInboxes).mockReturnValue([
      { id: "i1", address: "a@b.com", token: "tok", messages: [{ id: "m1", subject: "Hi", from: "x@y.com", intro: "...", createdAt: "2024-01-01" }] },
    ]);
    const res = await request(createHttpServer()).get("/api/inboxes");
    expect(res.status).toBe(200);
    expect(res.body[0].messageCount).toBe(1);
  });
});

describe("POST /api/inboxes", () => {
  it("creates and returns new inbox", async () => {
    vi.mocked(mailtm.createMailTmInbox).mockResolvedValue({ id: "i1", address: "a@b.com", token: "tok" });
    vi.mocked(store.getInbox).mockReturnValue({ id: "i1", address: "a@b.com", token: "tok", messages: [] });

    const res = await request(createHttpServer()).post("/api/inboxes");
    expect(res.status).toBe(201);
    expect(res.body.address).toBe("a@b.com");
    expect(store.addInbox).toHaveBeenCalledWith({ id: "i1", address: "a@b.com", token: "tok", messages: [] });
  });

  it("returns 500 on mailtm failure", async () => {
    vi.mocked(mailtm.createMailTmInbox).mockRejectedValue(new Error("API down"));
    const res = await request(createHttpServer()).post("/api/inboxes");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/inboxes/:id/messages", () => {
  it("fetches and returns messages", async () => {
    vi.mocked(store.getInbox).mockReturnValue({ id: "i1", address: "a@b.com", token: "tok", messages: [] });
    vi.mocked(mailtm.fetchMessages).mockResolvedValue([
      { id: "m1", subject: "Hi", from: { address: "x@y.com", name: "X" }, intro: "...", createdAt: "2024-01-01", seen: false },
    ]);
    const res = await request(createHttpServer()).get("/api/inboxes/i1/messages");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].from).toBe("x@y.com");
  });

  it("returns 404 for unknown inbox", async () => {
    vi.mocked(store.getInbox).mockReturnValue(undefined);
    const res = await request(createHttpServer()).get("/api/inboxes/bad/messages");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/inboxes/:id/messages/:msgId", () => {
  it("returns full message detail", async () => {
    vi.mocked(store.getInbox).mockReturnValue({ id: "i1", address: "a@b.com", token: "tok", messages: [] });
    vi.mocked(mailtm.fetchMessage).mockResolvedValue({
      id: "m1", subject: "Hi", from: { address: "x@y.com", name: "X" },
      intro: "...", createdAt: "2024-01-01", seen: false, text: "Hello!", html: ["<p>Hello!</p>"],
    });
    const res = await request(createHttpServer()).get("/api/inboxes/i1/messages/m1");
    expect(res.status).toBe(200);
    expect(res.body.text).toBe("Hello!");
    expect(res.body.from).toBe("x@y.com");
  });

  it("returns 404 for unknown inbox", async () => {
    vi.mocked(store.getInbox).mockReturnValue(undefined);
    const res = await request(createHttpServer()).get("/api/inboxes/bad/messages/m1");
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/inboxes/:id", () => {
  it("deletes inbox and returns 204", async () => {
    vi.mocked(store.getInbox).mockReturnValue({ id: "i1", address: "a@b.com", token: "tok", messages: [] });
    vi.mocked(mailtm.deleteMailTmAccount).mockResolvedValue(undefined);

    const res = await request(createHttpServer()).delete("/api/inboxes/i1");
    expect(res.status).toBe(204);
    expect(store.removeInbox).toHaveBeenCalledWith("i1");
  });

  it("returns 404 for unknown inbox", async () => {
    vi.mocked(store.getInbox).mockReturnValue(undefined);
    const res = await request(createHttpServer()).delete("/api/inboxes/bad");
    expect(res.status).toBe(404);
  });
});
