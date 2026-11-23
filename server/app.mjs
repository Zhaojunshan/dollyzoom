import { generationPermitted } from "../src/lib/moderationGate.mjs";
import { creditsHealth, dispatchCredits } from "./credits.mjs";
import { dashscopeConfigured, wanSettings } from "./dashscope.mjs";
import {
  CREEM_PRODUCTION_MODERATION_URL,
  CREEM_SANDBOX_MODERATION_URL,
  classifyKey,
  moderationUrlForKey,
} from "./creemHost.mjs";

export {
  CREEM_PRODUCTION_MODERATION_URL,
  CREEM_SANDBOX_MODERATION_URL,
  classifyKey,
  moderationUrlForKey,
};

/** Plain-text Worker var. Only the exact string "1" opens the temporary grant. */
export function testGrantFlag(value) {
  return value === "1";
}

/**
 * Prompt used when a generation has no user-written text (upload-only
 * dolly zoom). Creem bills repeated identical prompts at 0 units.
 * Do not prepend policy instructions; that can itself change the decision.
 *
 * Wan image-to-video reads motion and camera words, not a still description.
 * The prompt guide uses "camera pushes in" and "quickly" to set speed and
 * intensity. wan2.6-i2v-flash has no
 * motion-strength parameter. Resolution, duration, and audio stay on the
 * billing defaults. prompt_extend stays false so this screened sentence is
 * what the model sees; shot_type applies only when prompt_extend is true.
 */
export const FIXED_DOLLY_ZOOM_PROMPT =
  "Hitchcock dolly zoom, one continuous moving shot. The camera quickly pushes in for the whole shot while the lens zooms wider: the person stays the same size, with the same face, clothing, and pose, and the background perspective stretches and recedes strongly toward the edges of the frame. The push is obvious from the first moment. Everyday clothing, natural light, no text.";

const DEFAULT_ORIGINS = ["https://dollyzoom.top", "https://www.dollyzoom.top"];

const hits = new Map();

export function resetRateLimit() {
  hits.clear();
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
    "access-control-allow-headers": "content-type, authorization",
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

function rateLimit(ip, limit, bucket = "generate") {
  const now = Date.now();
  const key = `${bucket}:${ip}`;
  const recent = (hits.get(key) || []).filter((stamp) => now - stamp < 60_000);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
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
 * The free preview route does not read or debit a generation wallet.
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
    const health = {
      ok: true,
      key: classifyKey(apiKey),
      credits: creditsHealth({
        apiKey,
        allowTestKey,
        webhookSecret: options.webhookSecret || "",
        sessionSecret: options.sessionSecret || "",
      }),
      video: dashscopeConfigured(options.dashscopeApiKey || "") ? "ready" : "unconfigured",
    };
    if (options.testGrantEnabled === true) health.testGrant = true;
    return json(health, 200, origin);
  }

  const creditsResponse = await dispatchCredits(request, {
    apiKey,
    allowTestKey,
    webhookSecret: options.webhookSecret || "",
    sessionSecret: options.sessionSecret || "",
    creditCost: options.creditCost,
    successUrl: options.successUrl,
    creemFetch: options.creemFetch,
    generateImpl: options.generateImpl,
    dashscopeApiKey: options.dashscopeApiKey || "",
    dashscopeFetch: options.dashscopeFetch,
    videoFetch: options.videoFetch,
    wan: options.wan || wanSettings({
      resolution: options.wanResolution,
      duration: options.wanDuration,
      audio: options.wanAudio,
      baseUrl: options.dashscopeBaseUrl,
      region: options.dashscopeRegion,
    }),
    now: options.now,
    testGrantEnabled: options.testGrantEnabled === true,
    originAllowed: isAllowedOrigin,
    takeRateLimit: (ipAddress, bucket, cap) => rateLimit(ipAddress, cap ?? limit, bucket),
    selectPrompt,
    screen: (args) => {
      if (options.screenImpl) return options.screenImpl({ apiKey, ...args });
      return screenWithCreem({
        apiKey,
        fetchImpl: options.creemFetch || fetch,
        ...args,
      });
    },
    json: (body, status) => json(body, status, origin),
  });
  if (creditsResponse) return creditsResponse;

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
