import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { after, beforeEach, test } from "node:test";

import { handleRequest, resetRateLimit } from "./app.mjs";
import { HD_PRODUCT_ID, STATIC_CHECKOUT_URL } from "./creemHost.mjs";
import { classifyModeration, externalIdFor } from "./credits.mjs";
import { createProxyServer } from "./index.mjs";
import {
  SESSION_TTL_MS,
  hmacSha256Hex,
  issueSession,
  readSession,
  sha256Hex,
  verifyRedirectSignature,
} from "./session.mjs";

const LIVE = "creem_unit_test_not_a_real_key";
const TEST_KEY = "creem_test_unit_only";
const SESSION = "session_secret_0123456789";
const WEBHOOK = "whsec_unit_test_value";
const CUSTOMER = "cust_abc";
const ACCOUNT = "cca_wallet";
const USER = "dzu_cust_abc";

function creditGrant(calls) {
  return calls.filter((call) => /\/credit$/.test(call.path));
}

function mockCreem(handler) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const parsed = new URL(url);
    const call = {
      method: init.method || "GET",
      path: parsed.pathname,
      search: parsed.search,
      host: parsed.host,
      body: init.body ? JSON.parse(init.body) : null,
      apiKey: init.headers?.["x-api-key"],
    };
    calls.push(call);
    const result = await handler(call);
    return new Response(JSON.stringify(result?.body ?? {}), {
      status: result?.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetchImpl, calls };
}

function router(state = {}) {
  const externalId = state.externalId ?? null;
  const accounts = state.accounts ?? [];
  const balance = state.balance ?? "4";
  return async (call) => {
    if (call.method === "GET" && call.path === "/v1/customers") {
      return {
        body: {
          id: CUSTOMER,
          email: "buyer@example.com",
          external_id: state.externalId ?? externalId,
        },
      };
    }
    if (call.method === "PATCH" && call.path === "/v1/customers") {
      state.externalId = call.body.external_id;
      return { body: { id: CUSTOMER, external_id: call.body.external_id } };
    }
    if (call.method === "GET" && call.path === "/v1/customer-credits/accounts") {
      return { body: { object: "list", data: state.accounts ?? accounts, has_more: false } };
    }
    if (call.method === "POST" && call.path === "/v1/customer-credits/accounts") {
      const created = {
        id: ACCOUNT,
        customer_id: CUSTOMER,
        name: "generation",
        unit_label: "credits",
        status: "active",
      };
      state.accounts = [created];
      return { status: 201, body: created };
    }
    if (call.path === `/v1/customer-credits/accounts/${ACCOUNT}/balance`) {
      return { body: { balance: state.balance ?? balance } };
    }
    if (call.method === "POST" && call.path === "/v1/checkouts") {
      if (state.checkoutFails) {
        return { status: 500, body: { error: { code: "checkout_down", message: "no" } } };
      }
      return {
        body: { id: "ch_new", checkout_url: "https://checkout.creem.io/ch_new" },
      };
    }
    if (call.method === "POST" && call.path.endsWith("/debit")) {
      if (state.debitCode) {
        return {
          status: 422,
          body: { error: { code: state.debitCode, message: "no", type: "invalid_request_error", request_id: "req_1" } },
        };
      }
      return {
        status: 201,
        body: { id: "cct_debit", moderation_id: call.body.moderation_id, idempotency_key: call.body.idempotency_key },
      };
    }
    if (call.method === "POST" && call.path.endsWith("/reverse")) {
      if (state.reverseFails) {
        return { status: 500, body: { error: { code: "reverse_down", message: "no" } } };
      }
      return { status: 201, body: { id: "cct_reverse", reversal_of: call.body.transaction_id } };
    }
    return { status: 500, body: { error: { code: "unexpected", message: `${call.method} ${call.path}` } } };
  };
}

function baseOptions(extra = {}) {
  return {
    apiKey: LIVE,
    sessionSecret: SESSION,
    webhookSecret: WEBHOOK,
    ...extra,
  };
}

async function signedQuery(pairs, apiKey = LIVE) {
  const canonical = `${pairs.map(([key, value]) => `${key}=${value}`).join("|")}|salt=${apiKey}`;
  const signature = createHash("sha256").update(canonical).digest("hex");
  return new URLSearchParams([...pairs, ["signature", signature]]).toString();
}

function request(path, { method = "POST", origin = "https://dollyzoom.top", ip = "203.0.113.40", body, headers = {} } = {}) {
  return new Request(`https://proxy.example${path}`, {
    method,
    headers: {
      origin,
      "content-type": "application/json",
      "x-forwarded-for": ip,
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function sessionToken(now = Date.now()) {
  return issueSession(SESSION, { uid: USER, cid: CUSTOMER, aid: ACCOUNT }, now);
}

beforeEach(() => {
  resetRateLimit();
});

test("redirect signatures match an independent SHA-256 and reject tampering", async () => {
  const pairs = [
    ["checkout_id", "ch_1"],
    ["order_id", "ord_1"],
    ["customer_id", CUSTOMER],
    ["product_id", HD_PRODUCT_ID],
  ];
  const query = await signedQuery(pairs);
  const verified = await verifyRedirectSignature(query, LIVE);
  assert.equal(verified.ok, true);
  assert.equal(await sha256Hex("abc"), createHash("sha256").update("abc").digest("hex"));

  const tampered = query.replace(CUSTOMER, "cust_evil");
  assert.equal((await verifyRedirectSignature(tampered, LIVE)).ok, false);
  assert.equal((await verifyRedirectSignature(query, "creem_other_key_value")).ok, false);

  const requestId = "dzu_fromrequest1234";
  const fieldPairs = [
    ["request_id", requestId],
    ["checkout_id", "ch_1"],
    ["order_id", "ord_1"],
    ["customer_id", CUSTOMER],
    ["product_id", HD_PRODUCT_ID],
  ];
  const fieldCanonical = `${fieldPairs.map(([key, value]) => `${key}=${value}`).join("|")}|salt=${LIVE}`;
  const fieldSignature = createHash("sha256").update(fieldCanonical).digest("hex");
  const reordered = new URLSearchParams([
    ["checkout_id", "ch_1"],
    ["order_id", "ord_1"],
    ["customer_id", CUSTOMER],
    ["product_id", HD_PRODUCT_ID],
    ["request_id", requestId],
    ["signature", fieldSignature],
  ]).toString();
  assert.equal((await verifyRedirectSignature(reordered, LIVE)).ok, true);
});

test("webhook signatures match node hmac and sessions expire", async () => {
  const mac = createHmac("sha256", WEBHOOK).update("payload").digest("hex");
  assert.equal(await hmacSha256Hex(WEBHOOK, "payload"), mac);
  const token = await sessionToken(0);
  assert.ok(await readSession(SESSION, token, SESSION_TTL_MS));
  assert.equal(await readSession(SESSION, token, SESSION_TTL_MS + 1), null);
  assert.equal(await readSession(SESSION, `${token.slice(0, -1)}0`, 0), null);
});

test("our user id prefers a dzu request id and otherwise uses the customer id", () => {
  assert.equal(externalIdFor(CUSTOMER, "dzu_fromrequest1234"), "dzu_fromrequest1234");
  assert.equal(externalIdFor(CUSTOMER, "order_123"), USER);
  assert.equal(externalIdFor(CUSTOMER, ""), USER);
});

test("stale or non-allow moderation cannot debit", () => {
  const now = Date.now();
  assert.equal(classifyModeration({ decision: "deny", id: "mod_1" }, now).ok, false);
  assert.equal(classifyModeration({ decision: "flag", id: "mod_1" }, now).ok, false);
  assert.equal(classifyModeration({ decision: "allow", id: "" }, now).ok, false);
  assert.equal(
    classifyModeration(
      { decision: "allow", id: "mod_old", created_at: new Date(now - 25 * 60 * 60 * 1000).toISOString() },
      now,
    ).ok,
    false,
  );
  assert.equal(
    classifyModeration(
      { decision: "allow", id: "mod_future", created_at: new Date(now + 60 * 60 * 1000).toISOString() },
      now,
    ).ok,
    false,
  );
  assert.equal(classifyModeration({ decision: "allow", id: "mod_ok" }, now).ok, true);
});

test("claim binds external id and a generation wallet without granting credits", async () => {
  const state = {};
  const creem = mockCreem(router(state));
  const query = await signedQuery([
    ["checkout_id", "ch_1"],
    ["order_id", "ord_1"],
    ["customer_id", CUSTOMER],
    ["product_id", HD_PRODUCT_ID],
  ]);
  const response = await handleRequest(
    request("/v1/credits/claim", { body: { query }, ip: "203.0.113.41" }),
    baseOptions({ creemFetch: creem.fetchImpl }),
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.externalId, USER);
  assert.equal(body.customerId, CUSTOMER);
  assert.equal(body.accountId, ACCOUNT);
  assert.equal(body.balance, "4");
  assert.equal(JSON.stringify(body).includes(LIVE), false);
  assert.deepEqual(
    creem.calls.map((call) => `${call.method} ${call.path}`),
    [
      "GET /v1/customers",
      "PATCH /v1/customers",
      "GET /v1/customer-credits/accounts",
      "POST /v1/customer-credits/accounts",
      `GET /v1/customer-credits/accounts/${ACCOUNT}/balance`,
    ],
  );
  assert.equal(creem.calls[1].body.external_id, USER);
  assert.equal(creem.calls[1].body.customer_id, CUSTOMER);
  assert.deepEqual(creem.calls[3].body, {
    customer_id: CUSTOMER,
    name: "generation",
    unit_label: "credits",
  });
  assert.equal("initial_balance" in creem.calls[3].body, false);
  assert.equal(creem.calls[0].host, "api.creem.io");
  assert.equal(creem.calls[0].apiKey, LIVE);
  assert.equal(creditGrant(creem.calls).length, 0);
  assert.ok(await readSession(SESSION, body.session));
});

test("claim keeps an existing external id and generation wallet", async () => {
  const creem = mockCreem(
    router({
      externalId: "dzu_keep_this_id",
      accounts: [
        {
          id: ACCOUNT,
          name: "generation",
          status: "active",
          customer_id: CUSTOMER,
          unit_label: "credits",
        },
      ],
    }),
  );
  const query = await signedQuery([
    ["checkout_id", "ch_1"],
    ["order_id", "ord_1"],
    ["customer_id", CUSTOMER],
    ["product_id", HD_PRODUCT_ID],
    ["request_id", "dzu_fromrequest1234"],
  ]);
  const response = await handleRequest(
    request("/v1/credits/claim", { body: { query }, ip: "203.0.113.42" }),
    baseOptions({ creemFetch: creem.fetchImpl }),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.externalId, "dzu_keep_this_id");
  assert.equal(creem.calls.some((call) => call.method === "PATCH"), false);
  assert.equal(creem.calls.some((call) => call.method === "POST"), false);
  assert.equal(creditGrant(creem.calls).length, 0);
});

test("claim fails closed on a bad signature, wrong product, or missing session secret", async () => {
  const creem = mockCreem(router());
  const good = await signedQuery([
    ["checkout_id", "ch_1"],
    ["order_id", "ord_1"],
    ["customer_id", CUSTOMER],
    ["product_id", HD_PRODUCT_ID],
  ]);
  const badSig = await handleRequest(
    request("/v1/credits/claim", { body: { query: good.replace(HD_PRODUCT_ID, "prod_other") }, ip: "203.0.113.43" }),
    baseOptions({ creemFetch: creem.fetchImpl }),
  );
  assert.equal(badSig.status, 401);

  const wrongProduct = await signedQuery([
    ["checkout_id", "ch_1"],
    ["customer_id", CUSTOMER],
    ["product_id", "prod_other"],
  ]);
  const rejected = await handleRequest(
    request("/v1/credits/claim", { body: { query: wrongProduct }, ip: "203.0.113.44" }),
    baseOptions({ creemFetch: creem.fetchImpl }),
  );
  assert.equal(rejected.status, 400);
  assert.equal((await rejected.json()).error, "product_not_allowed");

  const unconfigured = await handleRequest(
    request("/v1/credits/claim", { body: { query: good }, ip: "203.0.113.45" }),
    { apiKey: LIVE, webhookSecret: WEBHOOK, creemFetch: creem.fetchImpl },
  );
  assert.equal(unconfigured.status, 503);
  assert.equal(creem.calls.length, 0);
});

test("a foreign origin cannot claim or read a wallet", async () => {
  const creem = mockCreem(router());
  const response = await handleRequest(
    request("/v1/credits", {
      method: "GET",
      origin: "https://evil.example",
      ip: "203.0.113.46",
      headers: { authorization: `Bearer ${await sessionToken()}` },
    }),
    baseOptions({ creemFetch: creem.fetchImpl }),
  );
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(creem.calls.length, 0);
});

test("balance is read from Creem and an expired session does not", async () => {
  const creem = mockCreem(router({ balance: "9", externalId: USER, accounts: [{ id: ACCOUNT, name: "generation", status: "active", customer_id: CUSTOMER }] }));
  const ok = await handleRequest(
    request("/v1/credits", {
      method: "GET",
      ip: "203.0.113.47",
      headers: { authorization: `Bearer ${await sessionToken()}` },
    }),
    baseOptions({ creemFetch: creem.fetchImpl }),
  );
  const body = await ok.json();
  assert.equal(ok.status, 200);
  assert.equal(body.balance, "9");
  assert.equal(body.cost, "1");
  assert.equal(creem.calls[0].path, `/v1/customer-credits/accounts/${ACCOUNT}/balance`);
  assert.equal(creditGrant(creem.calls).length, 0);

  const expired = mockCreem(router());
  const denied = await handleRequest(
    request("/v1/credits", {
      method: "GET",
      ip: "203.0.113.48",
      headers: { authorization: `Bearer ${await sessionToken(0)}` },
    }),
    baseOptions({ creemFetch: expired.fetchImpl, now: () => SESSION_TTL_MS + 5 }),
  );
  assert.equal(denied.status, 401);
  assert.equal((await denied.json()).checkoutUrl, STATIC_CHECKOUT_URL);
  assert.equal(expired.calls.length, 0);
});

test("checkout without a session is the existing product link", async () => {
  const creem = mockCreem(router());
  const response = await handleRequest(
    request("/v1/credits/checkout", { body: {}, ip: "203.0.113.49" }),
    baseOptions({ creemFetch: creem.fetchImpl }),
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.checkoutUrl, STATIC_CHECKOUT_URL);
  assert.equal(creem.calls.length, 0);
});

test("a failed customer checkout falls back to the existing product link", async () => {
  const creem = mockCreem(router({ checkoutFails: true }));
  const response = await handleRequest(
    request("/v1/credits/checkout", {
      body: {},
      ip: "203.0.113.80",
      headers: { authorization: `Bearer ${await sessionToken()}` },
    }),
    baseOptions({ creemFetch: creem.fetchImpl }),
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.checkoutUrl, STATIC_CHECKOUT_URL);
  assert.equal(creditGrant(creem.calls).length, 0);
});

test("checkout with a session uses that customer and stays on dollyzoom.top", async () => {
  const creem = mockCreem(router());
  const response = await handleRequest(
    request("/v1/credits/checkout", {
      body: {},
      ip: "203.0.113.50",
      headers: { authorization: `Bearer ${await sessionToken()}` },
    }),
    baseOptions({
      creemFetch: creem.fetchImpl,
      successUrl: "https://evil.example/phish",
    }),
  );
  const body = await response.json();
  assert.equal(body.checkoutUrl, "https://checkout.creem.io/ch_new");
  assert.equal(creem.calls.length, 1);
  assert.equal(creem.calls[0].path, "/v1/checkouts");
  assert.deepEqual(creem.calls[0].body.customer, { id: CUSTOMER });
  assert.equal(creem.calls[0].body.product_id, HD_PRODUCT_ID);
  assert.equal(creem.calls[0].body.success_url, "https://dollyzoom.top/");
  assert.equal(creem.calls[0].body.request_id, USER);
  assert.equal(creditGrant(creem.calls).length, 0);
});

test("the free preview screens and does not debit", async () => {
  const creem = mockCreem(() => {
    throw new Error("credits should not be called");
  });
  const response = await handleRequest(request("/v1/generate", { body: { effect: "dolly_zoom" }, ip: "203.0.113.51" }), {
    apiKey: LIVE,
    sessionSecret: SESSION,
    webhookSecret: WEBHOOK,
    creemFetch: creem.fetchImpl,
    screenImpl: async () => ({ decision: "allow", id: "mod_free" }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    decision: "allow",
    moderationId: "mod_free",
  });
  assert.equal(creem.calls.length, 0);
});

test("paid generation checks balance, screens, debits with the moderation id, then generates", async () => {
  const creem = mockCreem(router({ balance: "5" }));
  const seen = [];
  const response = await handleRequest(
    request("/v1/generations", {
      ip: "203.0.113.52",
      headers: { authorization: `Bearer ${await sessionToken()}` },
      body: { effect: "dolly_zoom", generationId: "gen_test_123456", moderationId: "mod_stolen" },
    }),
    baseOptions({
      creemFetch: creem.fetchImpl,
      screenImpl: async (args) => {
        seen.push(args);
        return { decision: "allow", id: "mod_real", object: "moderation_result" };
      },
      generateImpl: async () => ({ status: "stub" }),
    }),
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.moderationId, "mod_real");
  assert.equal(body.transactionId, "cct_debit");
  assert.deepEqual(body.generation, { status: "stub" });
  assert.equal(seen[0].externalId, `user_${USER}:gen_gen_test_123456`);
  assert.equal(seen[0].prompt.includes("Hitchcock"), true);
  const debit = creem.calls.find((call) => call.path.endsWith("/debit"));
  assert.deepEqual(debit.body, {
    amount: "1",
    reference: "gen:gen_test_123456",
    idempotency_key: "debit_gen_test_123456",
    moderation_id: "mod_real",
  });
  assert.equal(creem.calls.some((call) => call.path.endsWith("/reverse")), false);
  assert.equal(creditGrant(creem.calls).length, 0);
  assert.deepEqual(
    creem.calls.map((call) => call.path.split("/").pop()),
    ["balance", "debit"],
  );
});

test("insufficient balance sends the user to checkout and does not screen or debit", async () => {
  const creem = mockCreem(router({ balance: "0" }));
  let screened = 0;
  const response = await handleRequest(
    request("/v1/generations", {
      ip: "203.0.113.53",
      headers: { authorization: `Bearer ${await sessionToken()}` },
      body: { effect: "dolly_zoom" },
    }),
    baseOptions({
      creemFetch: creem.fetchImpl,
      successUrl: "https://www.dollyzoom.top/return",
      screenImpl: async () => {
        screened += 1;
        return { decision: "allow", id: "mod_should_not_run" };
      },
      generateImpl: async () => ({ status: "stub" }),
    }),
  );
  const body = await response.json();
  assert.equal(response.status, 402);
  assert.equal(body.error, "insufficient_credits");
  assert.equal(body.checkoutUrl, "https://checkout.creem.io/ch_new");
  assert.equal(screened, 0);
  assert.equal(creem.calls.some((call) => call.path.endsWith("/debit")), false);
  assert.equal(creem.calls.at(-1).path, "/v1/checkouts");
  assert.equal(creem.calls.at(-1).body.success_url, "https://www.dollyzoom.top/return");
  assert.equal(creditGrant(creem.calls).length, 0);
});

test("a missing session points at the existing $1.49 checkout", async () => {
  const creem = mockCreem(router());
  const response = await handleRequest(
    request("/v1/generations", { ip: "203.0.113.54", body: { effect: "dolly_zoom" } }),
    baseOptions({ creemFetch: creem.fetchImpl }),
  );
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error, "credits_needed");
  assert.equal(body.checkoutUrl, STATIC_CHECKOUT_URL);
  assert.equal(creem.calls.length, 0);
});

test("deny, flag, moderation errors, and a stale result do not debit", async () => {
  for (const [decision, ip] of [
    ["deny", "203.0.113.55"],
    ["flag", "203.0.113.56"],
  ]) {
    const creem = mockCreem(router({ balance: "5" }));
    const response = await handleRequest(
      request("/v1/generations", {
        ip,
        headers: { authorization: `Bearer ${await sessionToken()}` },
        body: { effect: "dolly_zoom" },
      }),
      baseOptions({
        creemFetch: creem.fetchImpl,
        screenImpl: async () => ({ decision, id: "mod_secret_result" }),
      }),
    );
    const text = await response.text();
    assert.equal(response.status, 400);
    assert.equal(text.includes("mod_secret_result"), false);
    assert.equal(creem.calls.some((call) => call.path.endsWith("/debit")), false);
  }

  const thrown = mockCreem(router({ balance: "5" }));
  const unavailable = await handleRequest(
    request("/v1/generations", {
      ip: "203.0.113.57",
      headers: { authorization: `Bearer ${await sessionToken()}` },
      body: { effect: "dolly_zoom" },
    }),
    baseOptions({
      creemFetch: thrown.fetchImpl,
      screenImpl: async () => {
        throw new Error("timeout");
      },
    }),
  );
  assert.equal(unavailable.status, 503);
  assert.equal(thrown.calls.some((call) => call.path.endsWith("/debit")), false);

  const stale = mockCreem(router({ balance: "5" }));
  const blocked = await handleRequest(
    request("/v1/generations", {
      ip: "203.0.113.58",
      headers: { authorization: `Bearer ${await sessionToken()}` },
      body: { effect: "dolly_zoom" },
    }),
    baseOptions({
      creemFetch: stale.fetchImpl,
      now: () => 1_700_000_000_000,
      screenImpl: async () => ({
        decision: "allow",
        id: "mod_old",
        created_at: new Date(1_700_000_000_000 - 25 * 60 * 60 * 1000).toISOString(),
      }),
    }),
  );
  assert.equal(blocked.status, 503);
  assert.equal(stale.calls.some((call) => call.path.endsWith("/debit")), false);
});

test("a balance or debit failure does not generate", async () => {
  const down = mockCreem(async (call) => {
    if (call.path.endsWith("/balance")) return { status: 500, body: { error: { code: "down" } } };
    return { status: 500, body: { error: { code: "unexpected" } } };
  });
  let generated = 0;
  const balanceDown = await handleRequest(
    request("/v1/generations", {
      ip: "203.0.113.59",
      headers: { authorization: `Bearer ${await sessionToken()}` },
      body: { effect: "dolly_zoom" },
    }),
    baseOptions({
      creemFetch: down.fetchImpl,
      screenImpl: async () => ({ decision: "allow", id: "mod_ok" }),
      generateImpl: async () => {
        generated += 1;
        return { status: "stub" };
      },
    }),
  );
  assert.equal(balanceDown.status, 503);
  assert.equal(generated, 0);
  assert.equal(down.calls.some((call) => call.path.endsWith("/debit")), false);

  const race = mockCreem(router({ balance: "5", debitCode: "insufficient_balance" }));
  const short = await handleRequest(
    request("/v1/generations", {
      ip: "203.0.113.60",
      headers: { authorization: `Bearer ${await sessionToken()}` },
      body: { effect: "dolly_zoom" },
    }),
    baseOptions({
      creemFetch: race.fetchImpl,
      screenImpl: async () => ({ decision: "allow", id: "mod_ok" }),
      generateImpl: async () => {
        generated += 1;
        return { status: "stub" };
      },
    }),
  );
  assert.equal(short.status, 402);
  assert.equal(generated, 0);
  assert.equal(race.calls.some((call) => call.path.endsWith("/reverse")), false);

  const denied = mockCreem(router({ balance: "5", debitCode: "moderation_denied" }));
  const blocked = await handleRequest(
    request("/v1/generations", {
      ip: "203.0.113.61",
      headers: { authorization: `Bearer ${await sessionToken()}` },
      body: { effect: "dolly_zoom" },
    }),
    baseOptions({
      creemFetch: denied.fetchImpl,
      screenImpl: async () => ({ decision: "allow", id: "mod_ok" }),
      generateImpl: async () => {
        generated += 1;
        return { status: "stub" };
      },
    }),
  );
  assert.equal(blocked.status, 400);
  assert.equal(generated, 0);
});

test("the unimplemented model debits and reverses", async () => {
  const creem = mockCreem(router({ balance: "3" }));
  const response = await handleRequest(
    request("/v1/generations", {
      ip: "203.0.113.62",
      headers: { authorization: `Bearer ${await sessionToken()}` },
      body: { effect: "dolly_zoom", generationId: "gen_stub_123456" },
    }),
    baseOptions({
      creemFetch: creem.fetchImpl,
      screenImpl: async () => ({ decision: "allow", id: "mod_stub" }),
    }),
  );
  const body = await response.json();
  assert.equal(response.status, 501);
  assert.equal(body.error, "generation_not_implemented");
  assert.equal(body.refunded, true);
  assert.equal(body.moderationId, "mod_stub");
  const reverse = creem.calls.find((call) => call.path.endsWith("/reverse"));
  assert.equal(reverse.body.transaction_id, "cct_debit");
  assert.equal(creditGrant(creem.calls).length, 0);
});

test("a model failure reverses, and a failed reversal is not reported as refunded", async () => {
  const refunded = mockCreem(router({ balance: "3" }));
  const failed = await handleRequest(
    request("/v1/generations", {
      ip: "203.0.113.63",
      headers: { authorization: `Bearer ${await sessionToken()}` },
      body: { effect: "dolly_zoom" },
    }),
    baseOptions({
      creemFetch: refunded.fetchImpl,
      screenImpl: async () => ({ decision: "allow", id: "mod_fail" }),
      generateImpl: async () => {
        throw new Error("model down");
      },
    }),
  );
  const failedBody = await failed.json();
  assert.equal(failed.status, 502);
  assert.equal(failedBody.error, "generation_failed");
  assert.equal(failedBody.refunded, true);
  assert.equal(refunded.calls.some((call) => call.path.endsWith("/reverse")), true);

  const stuck = mockCreem(router({ balance: "3", reverseFails: true }));
  const pending = await handleRequest(
    request("/v1/generations", {
      ip: "203.0.113.64",
      headers: { authorization: `Bearer ${await sessionToken()}` },
      body: { effect: "dolly_zoom" },
    }),
    baseOptions({
      creemFetch: stuck.fetchImpl,
      screenImpl: async () => ({ decision: "allow", id: "mod_stuck" }),
      generateImpl: async () => {
        throw new Error("model down");
      },
    }),
  );
  const pendingBody = await pending.json();
  assert.equal(pending.status, 502);
  assert.equal(pendingBody.error, "refund_pending");
  assert.equal(pendingBody.refunded, undefined);
  assert.equal(pendingBody.transactionId, "cct_debit");
});

test("checkout.completed binds the wallet and does not grant credits", async () => {
  const state = {};
  const creem = mockCreem(router(state));
  const payload = {
    id: "evt_1",
    eventType: "checkout.completed",
    object: {
      request_id: "dzu_fromrequest1234",
      product: { id: HD_PRODUCT_ID },
      customer: { id: CUSTOMER, email: "buyer@example.com", external_id: null },
    },
  };
  const raw = JSON.stringify(payload);
  const signature = createHmac("sha256", WEBHOOK).update(raw).digest("hex");
  const response = await handleRequest(
    request("/v1/creem/webhook", {
      origin: "https://evil.example",
      ip: "203.0.113.65",
      body: raw,
      headers: { "creem-signature": signature },
    }),
    baseOptions({ creemFetch: creem.fetchImpl }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(creem.calls[1].body.external_id, "dzu_fromrequest1234");
  assert.equal(creem.calls.some((call) => call.method === "POST" && call.path.endsWith("/accounts")), true);
  assert.equal(creditGrant(creem.calls).length, 0);

  const again = await handleRequest(
    request("/v1/creem/webhook", {
      ip: "203.0.113.66",
      body: raw,
      headers: { "creem-signature": signature.toUpperCase() },
    }),
    baseOptions({ creemFetch: creem.fetchImpl }),
  );
  assert.equal(again.status, 200);
  assert.equal(
    creem.calls.filter((call) => call.method === "PATCH").length,
    1,
  );
});

test("credits.granted is acknowledged and does not write credits", async () => {
  const creem = mockCreem(router());
  const raw = JSON.stringify({
    id: "evt_grant",
    eventType: "credits.granted",
    object: { amount_minor_units: "500", customer_id: CUSTOMER, account_id: ACCOUNT },
  });
  const signature = createHmac("sha256", WEBHOOK).update(raw).digest("hex");
  const response = await handleRequest(
    request("/v1/creem/webhook", {
      ip: "203.0.113.67",
      body: raw,
      headers: { "creem-signature": signature },
    }),
    baseOptions({ creemFetch: creem.fetchImpl }),
  );
  assert.equal(response.status, 200);
  assert.equal(creem.calls.length, 0);
});

test("webhooks without a valid signature or secret fail closed", async () => {
  const creem = mockCreem(router());
  const raw = JSON.stringify({ eventType: "checkout.completed", object: { product: { id: HD_PRODUCT_ID } } });
  const bad = await handleRequest(
    request("/v1/creem/webhook", {
      ip: "203.0.113.68",
      body: raw,
      headers: { "creem-signature": "00" },
    }),
    baseOptions({ creemFetch: creem.fetchImpl }),
  );
  assert.equal(bad.status, 401);
  const missing = await handleRequest(
    request("/v1/creem/webhook", { ip: "203.0.113.69", body: raw, headers: { "creem-signature": "00" } }),
    { apiKey: LIVE, sessionSecret: SESSION, creemFetch: creem.fetchImpl },
  );
  assert.equal(missing.status, 503);
  assert.equal(creem.calls.length, 0);
});

test("another product's checkout does not bind a wallet", async () => {
  const creem = mockCreem(router());
  const raw = JSON.stringify({
    eventType: "checkout.completed",
    object: { product: { id: "prod_other" }, customer: { id: CUSTOMER } },
  });
  const signature = createHmac("sha256", WEBHOOK).update(raw).digest("hex");
  const response = await handleRequest(
    request("/v1/creem/webhook", {
      ip: "203.0.113.70",
      body: raw,
      headers: { "creem-signature": signature },
    }),
    baseOptions({ creemFetch: creem.fetchImpl }),
  );
  assert.equal(response.status, 200);
  assert.equal(creem.calls.length, 0);
});

test("an invalid generation cost fails closed before Creem", async () => {
  const creem = mockCreem(router());
  const response = await handleRequest(
    request("/v1/generations", {
      ip: "203.0.113.71",
      headers: { authorization: `Bearer ${await sessionToken()}` },
      body: { effect: "dolly_zoom" },
    }),
    baseOptions({ creemFetch: creem.fetchImpl, creditCost: "0" }),
  );
  assert.equal(response.status, 503);
  assert.equal(creem.calls.length, 0);
});

test("health reports credits readiness without secrets", async () => {
  const missing = await handleRequest(new Request("https://proxy.example/health"), { apiKey: LIVE });
  assert.equal((await missing.json()).credits, "unconfigured");
  const ready = await handleRequest(new Request("https://proxy.example/health"), baseOptions());
  assert.deepEqual(await ready.json(), { ok: true, key: "live", credits: "ready" });
  assert.equal(JSON.stringify(await (await handleRequest(new Request("https://proxy.example/health"), baseOptions())).json()).includes(SESSION), false);
});

test("the HTTP server checks the raw webhook body", async () => {
  const server = createProxyServer({
    apiKey: LIVE,
    webhookSecret: WEBHOOK,
    sessionSecret: SESSION,
    port: 0,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  try {
    const raw = JSON.stringify({ eventType: "credits.granted", object: { amount_minor_units: "1" } });
    const signature = createHmac("sha256", WEBHOOK).update(raw).digest("hex");
    const ok = await fetch(`http://127.0.0.1:${port}/v1/creem/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "creem-signature": signature },
      body: raw,
    });
    assert.equal(ok.status, 200);
    const bad = await fetch(`http://127.0.0.1:${port}/v1/creem/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "creem-signature": "abcd" },
      body: raw,
    });
    assert.equal(bad.status, 401);
    const text = await bad.text();
    assert.equal(text.includes(WEBHOOK), false);
    assert.equal(text.includes(LIVE), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

after(() => {
  resetRateLimit();
});
