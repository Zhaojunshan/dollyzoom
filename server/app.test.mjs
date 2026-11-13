import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { generationPermitted } from "../src/lib/moderationGate.mjs";
import {
  CREEM_PRODUCTION_MODERATION_URL,
  CREEM_SANDBOX_MODERATION_URL,
  FIXED_DOLLY_ZOOM_PROMPT,
  classifyKey,
  handleRequest,
  interpretDecision,
  moderationUrlForKey,
  resetRateLimit,
  screenWithCreem,
  selectPrompt,
} from "./app.mjs";
import { createProxyServer } from "./index.mjs";

/** Prefix fixture only. Not a credential and not sent to Creem in these tests. */
const LIVE = "creem_unit_test_not_a_real_key";
const TEST_KEY = "creem_test_unit_only";

function post(body, { origin = "https://dollyzoom.top", ip = "203.0.113.10" } = {}) {
  return new Request("https://proxy.example/v1/generate", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetRateLimit();
});

test("production moderation URL is the live Creem host", () => {
  assert.equal(
    CREEM_PRODUCTION_MODERATION_URL,
    "https://api.creem.io/v1/moderation/prompt",
  );
  assert.equal(moderationUrlForKey(LIVE), CREEM_PRODUCTION_MODERATION_URL);
  assert.equal(moderationUrlForKey(TEST_KEY), CREEM_SANDBOX_MODERATION_URL);
  assert.equal(classifyKey(""), "missing");
  assert.equal(classifyKey(TEST_KEY), "test");
  assert.equal(classifyKey(LIVE), "live");
  assert.equal(classifyKey("sk_live_other"), "invalid");
});

test("upload-only generations screen the fixed dolly-zoom prompt", () => {
  assert.deepEqual(selectPrompt({ effect: "dolly_zoom" }), {
    prompt: FIXED_DOLLY_ZOOM_PROMPT,
  });
  assert.deepEqual(selectPrompt({ effect: "dolly_zoom", userPrompt: "   " }), {
    prompt: FIXED_DOLLY_ZOOM_PROMPT,
  });
});

test("user text is screened on its own, without the template", () => {
  const selected = selectPrompt({
    effect: "dolly_zoom",
    userPrompt: "a traveler in a red coat",
  });
  assert.equal(selected.prompt, "a traveler in a red coat");
  assert.equal(selected.prompt.includes("Hitchcock"), false);
});

test("allow is the only decision that permits a preview", () => {
  assert.equal(
    generationPermitted({ ok: true, decision: "allow", moderationId: "mod_123" }),
    true,
  );
  for (const decision of ["deny", "flag", "allow"]) {
    const interpreted = interpretDecision(
      decision === "allow"
        ? { decision, id: "" }
        : { decision, id: "mod_should_not_leak" },
    );
    assert.equal(interpreted.ok, false);
    assert.equal(generationPermitted(interpreted), false);
    assert.equal("moderationId" in interpreted, false);
  }
  assert.equal(generationPermitted({ ok: true, decision: "flag", moderationId: "mod_1" }), false);
  assert.equal(generationPermitted({ ok: true, decision: "deny", moderationId: "mod_1" }), false);
  assert.equal(generationPermitted(null), false);
});

test("missing, invalid, and test keys fail closed before Creem is called", async () => {
  let calls = 0;
  const screenImpl = async () => {
    calls += 1;
    return { decision: "allow", id: "mod_123" };
  };
  for (const apiKey of ["", "not-a-creem-key", TEST_KEY]) {
    const response = await handleRequest(post({ effect: "dolly_zoom" }, { ip: `198.51.100.${apiKey.length}` }), {
      apiKey,
      screenImpl,
    });
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, "moderation_unavailable");
  }
  assert.equal(calls, 0);
});

test("deny and flag block generation and do not return a moderation id", async () => {
  for (const decision of ["deny", "flag"]) {
    const response = await handleRequest(post({ effect: "dolly_zoom" }, { ip: `198.51.100.${decision.length}` }), {
      apiKey: LIVE,
      screenImpl: async () => ({ decision, id: "mod_secret_result" }),
    });
    assert.equal(response.status, 400);
    const text = await response.text();
    assert.equal(text.includes("mod_secret_result"), false);
    assert.equal(text.includes(LIVE), false);
    const body = JSON.parse(text);
    assert.equal(body.error, "prompt_rejected");
    assert.equal(generationPermitted(body), false);
  }
});

test("moderation errors and timeouts fail closed", async () => {
  const response = await handleRequest(post({ effect: "dolly_zoom" }, { ip: "198.51.100.8" }), {
    apiKey: LIVE,
    screenImpl: async () => {
      throw new Error("timeout");
    },
  });
  assert.equal(response.status, 503);
  assert.equal(generationPermitted(await response.json()), false);
});

test("allow returns only ok, decision, and the moderation id", async () => {
  let seen = null;
  const response = await handleRequest(post({ effect: "dolly_zoom" }, { ip: "198.51.100.9" }), {
    apiKey: LIVE,
    screenImpl: async (args) => {
      seen = args;
      return {
        id: "mod_ok_1",
        object: "moderation_result",
        decision: "allow",
        prompt: args.prompt,
        usage: { units: 1 },
      };
    },
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    ok: true,
    decision: "allow",
    moderationId: "mod_ok_1",
  });
  assert.equal(seen.prompt, FIXED_DOLLY_ZOOM_PROMPT);
  assert.equal(seen.apiKey, LIVE);
  assert.equal(generationPermitted(body), true);
});

test("a foreign origin cannot spend the moderation key", async () => {
  let calls = 0;
  const response = await handleRequest(
    post({ effect: "dolly_zoom" }, { origin: "https://evil.example", ip: "198.51.100.20" }),
    {
      apiKey: LIVE,
      screenImpl: async () => {
        calls += 1;
        return { decision: "allow", id: "mod_ok_1" };
      },
    },
  );
  assert.equal(response.status, 403);
  assert.equal(calls, 0);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("the site origin is echoed and wildcard CORS is not used", async () => {
  const response = await handleRequest(post({ effect: "dolly_zoom" }, { ip: "198.51.100.21" }), {
    apiKey: LIVE,
    screenImpl: async () => ({ decision: "allow", id: "mod_ok_2" }),
  });
  assert.equal(response.headers.get("access-control-allow-origin"), "https://dollyzoom.top");
  assert.notEqual(response.headers.get("access-control-allow-origin"), "*");
});

test("live screen posts to api.creem.io with the key header and a 5s timeout", async () => {
  let seen;
  const data = await screenWithCreem({
    apiKey: LIVE,
    prompt: "a watercolor lighthouse",
    externalId: "dz_test",
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return new Response(
        JSON.stringify({
          id: "mod_live",
          decision: "allow",
          object: "moderation_result",
          usage: { units: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });
  assert.equal(seen.url, "https://api.creem.io/v1/moderation/prompt");
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.headers["x-api-key"], LIVE);
  assert.equal(seen.init.signal.aborted, false);
  assert.deepEqual(JSON.parse(seen.init.body), {
    prompt: "a watercolor lighthouse",
    external_id: "dz_test",
  });
  assert.equal(data.id, "mod_live");
});

test("a non-200 from Creem fails closed inside the screener", async () => {
  await assert.rejects(
    screenWithCreem({
      apiKey: LIVE,
      prompt: "hello",
      externalId: "dz_test",
      fetchImpl: async () => new Response("nope", { status: 500 }),
    }),
  );
});

test("the HTTP server hides the key and blocks until allow", async () => {
  let calls = 0;
  const server = createProxyServer({
    apiKey: LIVE,
    port: 0,
    screenImpl: async () => {
      calls += 1;
      return { id: "mod_http", decision: "allow" };
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  try {
    const denied = await fetch(`http://127.0.0.1:${port}/v1/generate`, {
      method: "POST",
      headers: {
        origin: "http://127.0.0.1:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({ effect: "other" }),
    });
    assert.equal(denied.status, 400);
    assert.equal(calls, 0);

    const allowed = await fetch(`http://127.0.0.1:${port}/v1/generate`, {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({ effect: "dolly_zoom" }),
    });
    const text = await allowed.text();
    assert.equal(allowed.status, 200);
    assert.equal(text.includes(LIVE), false);
    assert.equal(JSON.parse(text).moderationId, "mod_http");
    assert.equal(calls, 1);

    const health = await fetch(`http://127.0.0.1:${port}/health`);
    const healthText = await health.text();
    assert.equal(healthText.includes(LIVE), false);
    assert.deepEqual(JSON.parse(healthText), { ok: true, key: "live" });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

after(() => {
  resetRateLimit();
});
