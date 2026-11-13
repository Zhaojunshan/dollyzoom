import { generationPermitted } from "@/lib/moderationGate.mjs";
import { publicPath } from "@/lib/site";

export type ScreeningCode = "prompt_rejected" | "moderation_unavailable";

export class ScreeningError extends Error {
  code: ScreeningCode;

  constructor(code: ScreeningCode) {
    super(code);
    this.name = "ScreeningError";
    this.code = code;
  }
}

function endpointAllowed(endpoint: string): boolean {
  if (endpoint.startsWith("https://")) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(endpoint);
}

/**
 * Ask the server proxy to screen this generation before any preview.
 * The Creem API key stays on that server. Empty config, network errors,
 * deny, and flag all throw and must not start a preview.
 */
export async function screenGeneration(): Promise<{ moderationId: string }> {
  let endpoint = "";
  try {
    const config = await fetch(publicPath("/moderation.json"), {
      cache: "no-store",
    });
    if (!config.ok) throw new Error("config");
    const data = (await config.json()) as { endpoint?: unknown };
    endpoint = typeof data.endpoint === "string" ? data.endpoint.trim() : "";
  } catch {
    throw new ScreeningError("moderation_unavailable");
  }

  if (!endpoint || !endpointAllowed(endpoint)) {
    throw new ScreeningError("moderation_unavailable");
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ effect: "dolly_zoom" }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new ScreeningError("moderation_unavailable");
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    throw new ScreeningError("moderation_unavailable");
  }

  if (generationPermitted(body)) {
    return { moderationId: body.moderationId };
  }

  const error =
    body && typeof body === "object" && "error" in body
      ? String((body as { error?: unknown }).error)
      : "";
  if (response.status === 400 || error === "prompt_rejected") {
    throw new ScreeningError("prompt_rejected");
  }
  throw new ScreeningError("moderation_unavailable");
}
