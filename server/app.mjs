import { generationPermitted } from "../src/lib/moderationGate.mjs";

/** Production Creem host. Sandbox is selected only for an explicit test key. */
export const CREEM_PRODUCTION_MODERATION_URL =
  "https://api.creem.io/v1/moderation/prompt";
export const CREEM_SANDBOX_MODERATION_URL =
  "https://test-api.creem.io/v1/moderation/prompt";

/**
 * Prompt used when a generation has no user-written text (upload-only
 * dolly zoom). Creem bills repeated identical prompts at 0 units.
 * Do not prepend policy instructions; that can itself change the decision.
 */
export const FIXED_DOLLY_ZOOM_PROMPT =
  "Cinematic Hitchcock dolly zoom of one portrait photo: the subject stays the same size while the background perspective widens. Everyday clothing, natural light, no text.";

const DEFAULT_ORIGINS = ["https://dollyzoom.top", "https://www.dollyzoom.top"];

const hits = new Map();

export function resetRateLimit() {
  hits.clear();
}

export function classifyKey(apiKey) {
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!key) return "missing";
  if (key.startsWith("creem_test_")) return "test";
  if (key.startsWith("creem_")) return "live";
  return "invalid";
}

export function moderationUrlForKey(apiKey) {
  return classifyKey(apiKey) === "test"
    ? CREEM_SANDBOX_MODERATION_URL
    : CREEM_PRODUCTION_MODERATION_URL;
}

export function selectPrompt(body) {
  const effect = body && typeof body.effect === "string" ? body.effect : "";
  const userPrompt =
    body && typeof body.userPrompt === "string" ? body.userPrompt.trim() : "";
  if (effect !== "dolly_zoom") {
    return { error: "unsupported_effect" };
  }
  if (userPrompt.length > 1000) {
    return { error: "prompt_too_long" };
  }
  // Screen the words the user controls. With no user text, screen the
  // fixed prompt that actually drives the upload-only generation.
  if (userPrompt) return { prompt: userPrompt };
  return { prompt: FIXED_DOLLY_ZOOM_PROMPT };
}

export function interpretDecision(data) {
  const decision = data && typeof data.decision === "string" ? data.decision : "";
  const id = data && typeof data.id === "string" ? data.id : "";
  if (decision === "allow" && id) {
    const payload = { ok: true, decision: "allow", moderationId: id };
    if (!generationPermitted(payload)) {
      return { ok: false, error: "moderation_unavailable", status: 503 };
    }
    return { ...payload, status: 200 };
  }
  if (decision === "deny" || decision === "flag") {
    return { ok: false, error: "prompt_rejected", status: 400 };
  }
  return { ok: false, error: "moderation_unavailable", status: 503 };
}

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (DEFAULT_ORIGINS.includes(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function corsHeaders(origin) {
  const headers = {
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    "cache-control": "no-store",
    vary: "Origin",
  };
  if (origin && isAllowedOrigin(origin)) {
    headers["access-control-allow-origin"] = origin;
  }
  return headers;
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(origin),
    },
  });
}

function rateLimit(ip, limit) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((stamp) => now - stamp < 60_000);
  if (recent.length >= limit) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

export async function screenWithCreem({
  apiKey,
  prompt,
  externalId,
  fetchImpl = fetch,
  timeoutMs = 5000,
}) {
  const kind = classifyKey(apiKey);
  if (kind !== "live" && kind !== "test") {
    throw Object.assign(new Error("moderation_unavailable"), {
      code: "moderation_unavailable",
    });
  }
  const response = await fetchImpl(moderationUrlForKey(apiKey), {
    method: "POST",
    headers: {
      "x-api-key": apiKey.trim(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      external_id: externalId,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw Object.assign(new Error("moderation_unavailable"), {
      code: "moderation_unavailable",
    });
  }
  const data = await response.json();
  return data;
}

/**
 * Screen a dolly-zoom generation before any preview is returned.
 * Missing keys, test keys (unless explicitly allowed), deny, flag,
 * timeouts, and malformed responses all fail closed.
 */
export async function handleRequest(request, options = {}) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const apiKey = options.apiKey || "";
  const allowTestKey = options.allowTestKey === true;
  const limit = options.rateLimitPerMinute ?? 30;

  if (request.method === "OPTIONS") {
    if (origin && !isAllowedOrigin(origin)) {
      return json({ ok: false, error: "origin_not_allowed" }, 403, origin);
    }
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return json({ ok: true, key: classifyKey(apiKey) }, 200, origin);
  }

  if (request.method !== "POST" || url.pathname !== "/v1/generate") {
    return json({ ok: false, error: "not_found" }, 404, origin);
  }

  if (origin && !isAllowedOrigin(origin)) {
    return json({ ok: false, error: "origin_not_allowed" }, 403, origin);
  }

  const ip = (request.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (!rateLimit(ip || "local", limit)) {
    return json({ ok: false, error: "moderation_unavailable" }, 429, origin);
  }

  const kind = classifyKey(apiKey);
  if (kind !== "live" && !(kind === "test" && allowTestKey)) {
    return json({ ok: false, error: "moderation_unavailable" }, 503, origin);
  }

  let body = {};
  try {
    const raw = await request.text();
    if (raw.length > 4000) {
      return json({ ok: false, error: "prompt_too_long" }, 400, origin);
    }
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return json({ ok: false, error: "bad_request" }, 400, origin);
  }

  const selected = selectPrompt(body);
  if (selected.error) {
    return json({ ok: false, error: selected.error }, 400, origin);
  }

  const externalId = `dz_${crypto.randomUUID()}`;
  let moderated;
  try {
    const screen = options.screenImpl || screenWithCreem;
    moderated = await screen({
      apiKey,
      prompt: selected.prompt,
      externalId,
    });
  } catch {
    return json({ ok: false, error: "moderation_unavailable" }, 503, origin);
  }

  const decision = interpretDecision(moderated);
  if (!decision.ok) {
    return json({ ok: false, error: decision.error }, decision.status, origin);
  }
  return json(
    {
      ok: true,
      decision: "allow",
      moderationId: decision.moderationId,
    },
    200,
    origin,
  );
}
