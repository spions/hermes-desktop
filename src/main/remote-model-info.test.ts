import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionConfig } from "./config";

const request = vi.hoisted(() => vi.fn());
vi.mock("./remote-api", () => ({ remoteDashboardRequestJson: request }));

import { remoteGetModelContextWindow } from "./remote-model-info";

const conn = { mode: "remote", remoteUrl: "http://r:9119" } as ConnectionConfig;

describe("remoteGetModelContextWindow", () => {
  beforeEach(() => {
    request.mockReset();
  });

  it("returns the window the server's agent actually uses", async () => {
    request.mockResolvedValue({
      model: "Qwen3-Coder",
      effective_context_length: 262144,
    });
    expect(await remoteGetModelContextWindow(conn, "qwen3-coder", "w")).toBe(
      262144,
    );
    expect(request).toHaveBeenCalledWith(conn, "/api/model/info", {}, "w");
  });

  it("does not apply the default model's window to a different model", async () => {
    request.mockResolvedValue({ model: "a", effective_context_length: 8192 });
    expect(await remoteGetModelContextWindow(conn, "b")).toBeNull();
  });

  it("returns null for a missing value, an empty model or a failed call", async () => {
    request.mockResolvedValue({ model: "a", effective_context_length: null });
    expect(await remoteGetModelContextWindow(conn, "a")).toBeNull();
    expect(await remoteGetModelContextWindow(conn, "  ")).toBeNull();
    request.mockImplementation(async () => {
      throw new Error("down");
    });
    expect(await remoteGetModelContextWindow(conn, "a")).toBeNull();
  });
});
