import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadInboxes, saveInboxes, defaultStorePath } from "./persistence.js";

let dir: string;
let file: string;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), "tempy-")); file = path.join(dir, "inboxes.json"); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const sample = { id: "a", address: "a@mail.tm", token: "t", password: "p", messages: [] };

describe("saveInboxes / loadInboxes", () => {
  it("round-trips inboxes", () => {
    saveInboxes(file, [sample]);
    expect(existsSync(file)).toBe(true);
    expect(loadInboxes(file)).toEqual([sample]);
  });

  it("returns [] when the file does not exist", () => {
    expect(loadInboxes(path.join(dir, "nope.json"))).toEqual([]);
  });

  it("returns [] on corrupt JSON", () => {
    writeFileSync(file, "{not json");
    expect(loadInboxes(file)).toEqual([]);
  });

  it("creates the parent directory when missing", () => {
    const nested = path.join(dir, "sub", "inboxes.json");
    saveInboxes(nested, [sample]);
    expect(loadInboxes(nested)).toEqual([sample]);
  });

  it("writes the store file owner-only (0o600)", () => {
    saveInboxes(file, [sample]);
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });
});

describe("defaultStorePath", () => {
  it("honors TEMPY_DATA_DIR", () => {
    const prev = process.env.TEMPY_DATA_DIR;
    process.env.TEMPY_DATA_DIR = dir;
    expect(defaultStorePath()).toBe(path.join(dir, "inboxes.json"));
    if (prev === undefined) delete process.env.TEMPY_DATA_DIR; else process.env.TEMPY_DATA_DIR = prev;
  });
});
