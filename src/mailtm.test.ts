import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMailTmInbox, fetchMessages, fetchMessage, deleteMailTmAccount, loginMailTm, fetchAccount, markSeen } from "./mailtm.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => mockFetch.mockReset());

describe("createMailTmInbox", () => {
  it("returns address, id, and token", async () => {
    mockFetch
      .mockReturnValueOnce(makeResponse({ "hydra:member": [{ domain: "mail.tm" }] }))
      .mockReturnValueOnce(makeResponse({ id: "acc-1", address: "test@mail.tm" }))
      .mockReturnValueOnce(makeResponse({ token: "jwt-abc" }));

    const inbox = await createMailTmInbox();
    expect(inbox.id).toBe("acc-1");
    expect(inbox.address).toMatch(/@mail\.tm$/);
    expect(inbox.token).toBe("jwt-abc");
  });

  it("throws if domains fetch fails", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}, 500));
    await expect(createMailTmInbox()).rejects.toThrow("Failed to fetch domains");
  });

  it("throws if account creation fails", async () => {
    mockFetch
      .mockReturnValueOnce(makeResponse({ "hydra:member": [{ domain: "mail.tm" }] }))
      .mockReturnValueOnce(makeResponse({}, 422));
    await expect(createMailTmInbox()).rejects.toThrow("Failed to create account");
  });
});

describe("fetchMessages", () => {
  it("returns message list", async () => {
    const messages = [{ id: "m1", subject: "Hello", from: { address: "a@b.com", name: "A" }, intro: "Hi", createdAt: "2024-01-01", seen: false }];
    mockFetch.mockReturnValueOnce(makeResponse({ "hydra:member": messages }));
    const result = await fetchMessages("token-123");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m1");
  });

  it("throws on failure", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}, 401));
    await expect(fetchMessages("bad-token")).rejects.toThrow();
  });
});

describe("fetchMessage", () => {
  it("returns full message detail", async () => {
    const detail = { id: "m1", subject: "Hello", from: { address: "a@b.com", name: "A" }, intro: "Hi", createdAt: "2024-01-01", seen: false, text: "body text", html: ["<p>body</p>"] };
    mockFetch.mockReturnValueOnce(makeResponse(detail));
    const result = await fetchMessage("token-123", "m1");
    expect(result.text).toBe("body text");
    expect(result.html).toEqual(["<p>body</p>"]);
  });
});

describe("deleteMailTmAccount", () => {
  it("resolves on 204", async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve({}) }));
    await expect(deleteMailTmAccount("token-123", "acc-1")).resolves.toBeUndefined();
  });

  it("throws on error status", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}, 500));
    await expect(deleteMailTmAccount("token-123", "acc-1")).rejects.toThrow("Failed to delete account");
  });
});

describe("createMailTmInbox returns password", () => {
  it("includes the generated password", async () => {
    mockFetch
      .mockReturnValueOnce(makeResponse({ "hydra:member": [{ domain: "mail.tm" }] }))
      .mockReturnValueOnce(makeResponse({ id: "acc-1", address: "test@mail.tm" }))
      .mockReturnValueOnce(makeResponse({ token: "jwt-abc" }));
    const inbox = await createMailTmInbox();
    expect(typeof inbox.password).toBe("string");
    expect(inbox.password.length).toBeGreaterThan(0);
  });
});

describe("loginMailTm", () => {
  it("returns a fresh token", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ token: "fresh-jwt" }));
    const token = await loginMailTm("a@b.com", "pw");
    expect(token).toBe("fresh-jwt");
  });
  it("throws on failure", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}, 401));
    await expect(loginMailTm("a@b.com", "pw")).rejects.toThrow();
  });
});

describe("fetchAccount", () => {
  it("returns used and quota", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ used: 16000, quota: 40000000 }));
    const acc = await fetchAccount("tok");
    expect(acc).toEqual({ used: 16000, quota: 40000000 });
  });
  it("throws 401 on auth failure", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}, 401));
    await expect(fetchAccount("tok")).rejects.toThrow(/^401/);
  });
});

describe("markSeen", () => {
  it("resolves on success", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ id: "m1", seen: true }));
    await expect(markSeen("tok", "m1")).resolves.toBeUndefined();
  });
  it("throws 401 on auth failure", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}, 401));
    await expect(markSeen("tok", "m1")).rejects.toThrow(/^401/);
  });
});

describe("fetchMessages auth error", () => {
  it("throws a 401-prefixed error on 401", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}, 401));
    await expect(fetchMessages("bad")).rejects.toThrow(/^401/);
  });
});
