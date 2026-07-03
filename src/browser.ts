import { spawn } from "child_process";

// Opens a URL in the user's default browser. Best-effort: returns true if the
// launch was attempted, false if it couldn't run (e.g. a headless or remote
// host with no display). Never throws — callers still hand back the URL either
// way, so the user always has a clickable link.
export function openInBrowser(url: string): boolean {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  try {
    const child = spawn(cmd, [url], {
      stdio: "ignore",
      detached: true,
      shell: platform === "win32",
    });
    // Async spawn failures (no display, missing launcher) must not crash us.
    child.on("error", () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}
