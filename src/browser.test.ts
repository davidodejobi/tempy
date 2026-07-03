import { describe, it, expect, vi, beforeEach } from "vitest";

const spawn = vi.fn();
vi.mock("child_process", () => ({ spawn: (...args: unknown[]) => spawn(...args) }));

import { openInBrowser } from "./browser.js";

beforeEach(() => vi.clearAllMocks());

describe("openInBrowser", () => {
  it("spawns a detached launcher and returns true", () => {
    const child = { on: vi.fn(), unref: vi.fn() };
    spawn.mockReturnValue(child);
    const ok = openInBrowser("http://localhost:3000");
    expect(ok).toBe(true);
    expect(spawn).toHaveBeenCalledTimes(1);
    const [, args, opts] = spawn.mock.calls[0];
    expect(args).toEqual(["http://localhost:3000"]);
    expect(opts.detached).toBe(true);
    expect(child.unref).toHaveBeenCalled();
  });

  it("returns false when spawn throws", () => {
    spawn.mockImplementation(() => { throw new Error("no launcher"); });
    expect(openInBrowser("http://localhost:3000")).toBe(false);
  });
});
