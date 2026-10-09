import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
// After the app/ refactor, ipcMain.handle registrations live in the dedicated
// IPC registration module plus the updater module, not in index.ts.
const indexSrc = ["src/main/ipc/register.ts", "src/main/app/updater.ts"]
  .map((p) => readFileSync(join(ROOT, p), "utf-8"))
  .join("\n");
const preloadSrc = readFileSync(join(ROOT, "src/preload/index.ts"), "utf-8");

/**
 * Extract all IPC channel names registered in main/index.ts.
 */
function extractIpcHandleChannels(src: string): string[] {
  const channels: string[] = [];
  const re = /ipcMain\.handle\(\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    channels.push(m[1]);
  }
  return [...new Set(channels)];
}

/**
 * Extract all ipcRenderer.invoke channel names from preload.
 */
function extractPreloadInvokeChannels(src: string): string[] {
  const channels: string[] = [];
  const re = /ipcRenderer\.invoke\(\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    channels.push(m[1]);
  }
  return [...new Set(channels)];
}

const mainChannels = extractIpcHandleChannels(indexSrc);
const preloadChannels = extractPreloadInvokeChannels(preloadSrc);

describe("IPC Handler ↔ Preload Consistency", () => {
  it("main process registers IPC handlers", () => {
    expect(mainChannels.length).toBeGreaterThan(30);
  });

  it("preload invokes IPC channels", () => {
    expect(preloadChannels.length).toBeGreaterThan(30);
  });

  it("every preload invoke has a matching main handler", () => {
    const missing = preloadChannels.filter((ch) => !mainChannels.includes(ch));
    expect(missing).toEqual([]);
  });

  it("every main handler has a matching preload invoke", () => {
    const missing = mainChannels.filter((ch) => !preloadChannels.includes(ch));
    expect(missing).toEqual([]);
  });
});

// ─── New feature handlers registered ────────────────────

describe("New IPC handlers from v0.8/v0.9 features", () => {
  const newChannels = [
    "run-hermes-backup",
    "run-hermes-import",
    "read-logs",
    "run-hermes-dump",
    "list-mcp-servers",
    "add-mcp-server",
    "remove-mcp-server",
    "set-mcp-server-enabled",
    "test-mcp-server",
    "list-mcp-catalog",
    "install-mcp-catalog-entry",
    "discover-memory-providers",
  ];

  for (const ch of newChannels) {
    it(`main has handler: ${ch}`, () => {
      expect(mainChannels).toContain(ch);
    });

    it(`preload invokes: ${ch}`, () => {
      expect(preloadChannels).toContain(ch);
    });
  }
});

// ─── Legacy handlers still present ──────────────────────

describe("Legacy IPC handlers preserved", () => {
  const legacyChannels = [
    "check-install",
    "start-install",
    "get-hermes-version",
    "run-hermes-doctor",
    "run-hermes-update",
    "get-env",
    "set-env",
    "get-config",
    "set-config",
    "get-model-config",
    "set-model-config",
    "send-message",
    "abort-chat",
    "start-gateway",
    "stop-gateway",
    "restart-gateway",
    "gateway-status",
    "get-platform-enabled",
    "set-platform-enabled",
    "list-sessions",
    "get-session-messages",
    "list-profiles",
    "create-profile",
    "list-cron-jobs",
    "create-cron-job",
    "open-external",
    "open-terminal",
  ];

  for (const ch of legacyChannels) {
    it(`${ch} handler still registered`, () => {
      expect(mainChannels).toContain(ch);
    });
  }
});

// ─── Remote safety ──────────────────────────────────────

/** Source of one `ipcMain.handle("<channel>", ...)` registration. */
function handlerSource(channel: string): string {
  const start = indexSrc.indexOf(`"${channel}"`);
  expect(start, `handler ${channel} not found`).toBeGreaterThan(-1);
  const next = indexSrc.indexOf("ipcMain.handle(", start);
  return indexSrc.slice(start, next === -1 ? undefined : next);
}

describe("Remote mode never falls through to local files", () => {
  // These handlers write the LOCAL ~/.hermes while the Memory screen shows the
  // server. Each must branch on remote mode before touching local state.
  const writers = [
    "add-memory-entry",
    "update-memory-entry",
    "remove-memory-entry",
    "write-user-profile",
    "set-config",
  ];
  for (const channel of writers) {
    it(`${channel} has an explicit remote branch`, () => {
      expect(handlerSource(channel)).toMatch(/mode === "remote"/);
    });
  }

  it("registry-install refuses in remote instead of installing locally", () => {
    expect(handlerSource("registry-install")).toMatch(
      /remote[\s\S]*remoteInstallRegistryItem/,
    );
  });

  it("start-gateway never spawns a local gateway in remote mode", () => {
    const src = handlerSource("start-gateway");
    expect(src.indexOf('mode === "remote"')).toBeGreaterThan(-1);
    expect(src.indexOf('mode === "remote"')).toBeLessThan(
      src.indexOf("startGatewayDetailed()"),
    );
  });
});
