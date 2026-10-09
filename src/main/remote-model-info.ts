import type { ConnectionConfig } from "./config";
import { remoteDashboardRequestJson } from "./remote-api";

// The context window the SERVER's agent actually uses for its configured model
// (GET /api/model/info -> effective_context_length: config override, else
// auto-detected). In Remote mode the desktop has neither the server's config
// nor its provider key, so asking locally falls through to a name-based
// heuristic that can be far off (e.g. 32k for a model that really has 128k+).

function sameModel(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Null when the server has no value, or reports a different model than the one
 * asked about (a per-chat model override must not inherit the default's size).
 */
export async function remoteGetModelContextWindow(
  conn: ConnectionConfig,
  model: string,
  profile?: string,
): Promise<number | null> {
  if (!model.trim()) return null;
  try {
    const info = await remoteDashboardRequestJson<{
      model?: string;
      effective_context_length?: number | null;
    }>(conn, "/api/model/info", {}, profile);
    const size = info?.effective_context_length;
    if (
      typeof size === "number" &&
      Number.isFinite(size) &&
      size > 0 &&
      typeof info.model === "string" &&
      sameModel(info.model, model)
    ) {
      return size;
    }
    return null;
  } catch {
    return null;
  }
}
