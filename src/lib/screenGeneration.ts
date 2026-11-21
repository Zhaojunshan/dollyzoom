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

/** Public proxy URL from moderation.json. Empty when the site must fail closed. */
export async function loadModerationEndpoint(): Promise<string> {
  try {
    const config = await fetch(publicPath("/moderation.json"), {
      cache: "no-store",
    });
    if (!config.ok) return "";
    const data = (await config.json()) as { endpoint?: unknown };
    const endpoint = typeof data.endpoint === "string" ? data.endpoint.trim() : "";
    if (!endpoint || !endpointAllowed(endpoint)) return "";
    return endpoint;
  } catch {
    return "";
  }
}

/** Origin of the moderation proxy, derived from its /v1/generate URL. */
export function workerOrigin(endpoint: string): string {
  if (!endpoint.endsWith("/v1/generate")) return "";
  return endpoint.slice(0, -"/v1/generate".length);
}

/**
 * Ask the server proxy to screen this generation before any preview.
 * The Creem API key stays on that server. Empty config, network errors,
 * deny, and flag all throw and must not start a preview.
 * This call does not debit generation credits.
 */
export async function screenGeneration(): Promise<{ moderationId: string }> {
  const endpoint = await loadModerationEndpoint();
  if (!endpoint) {
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
