import { generationPermitted } from "../src/lib/moderationGate.mjs";
import { CreemRequestError, createCreem } from "./creemApi.mjs";
import {
  GENERATION_WALLET_NAME,
  HD_PRODUCT_ID,
  MODERATION_MAX_AGE_MS,
  STATIC_CHECKOUT_URL,
  keyAllowed,
  parseCreditCost,
  publicSuccessUrl,
} from "./creemHost.mjs";
import {
  bearerToken,
  issueSession,
  readSession,
  sessionConfigured,
  verifyRedirectSignature,
  verifyWebhookSignature,
  webhookConfigured,
} from "./session.mjs";

const OUR_USER_ID = /^dzu_[A-Za-z0-9._:-]{8,80}$/;
const EXTERNAL_ID = /^[A-Za-z0-9._:-]{1,255}$/;
const CUSTOMER_ID = /^cust_[A-Za-z0-9]+$/;
const FUTURE_SKEW_MS = 5 * 60 * 1000;

/**
 * This site has no accounts. Creem checkout collects the email and creates the
 * customer. We then set external_id (our user id) and make sure a generation
 * wallet exists. Purchased credits are applied by Creem, never by this code.
 */
export function externalIdFor(customerId, requestId) {
  if (typeof requestId === "string" && OUR_USER_ID.test(requestId.trim())) {
    return requestId.trim();
  }
  const fallback = `dzu_${customerId}`;
  return OUR_USER_ID.test(fallback) ? fallback : "";
}

export function normalizeGenerationId(value) {
  if (typeof value === "string" && /^[A-Za-z0-9._:-]{8,80}$/.test(value)) return value;
  return `gen_${crypto.randomUUID()}`;
}

function timestampMs(stamp) {
  if (typeof stamp === "number" && Number.isFinite(stamp)) {
    return stamp < 1e12 ? stamp * 1000 : stamp;
  }
  if (typeof stamp === "string" && /^[0-9]+$/.test(stamp)) {
    const numeric = Number(stamp);
    return numeric < 1e12 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(String(stamp));
  return parsed;
}

/**
 * allow + a store result id, at most 24 hours old when the payload is dated.
 * An undated allow still has to pass Creem's debit check.
 */
export function classifyModeration(data, now) {
  const decision = data && typeof data.decision === "string" ? data.decision : "";
  const id = data && typeof data.id === "string" ? data.id : "";
  if (decision === "deny" || decision === "flag") {
    return { ok: false, error: "prompt_rejected" };
  }
  if (decision !== "allow" || !/^[A-Za-z0-9._:-]{1,64}$/.test(id)) {
    return { ok: false, error: "moderation_unavailable" };
  }
  if (!generationPermitted({ ok: true, decision: "allow", moderationId: id })) {
    return { ok: false, error: "moderation_unavailable" };
  }
  const stamp = data.created_at ?? data.createdAt;
  if (stamp != null) {
    const ms = timestampMs(stamp);
    if (!Number.isFinite(ms) || now - ms > MODERATION_MAX_AGE_MS || ms - now > FUTURE_SKEW_MS) {
      return { ok: false, error: "moderation_unavailable" };
    }
  }
  return { ok: true, id };
}

export async function unimplementedGeneration() {
  const error = new Error("generation_not_implemented");
  error.code = "generation_not_implemented";
  throw error;
}

async function ensureGenerationWallet(creem, customerId) {
  let startingAfter = "";
  for (let page = 0; page < 5; page += 1) {
    const query = new URLSearchParams({ customer_id: customerId, limit: "100" });
    if (startingAfter) query.set("starting_after", startingAfter);
    const list = await creem.get(`/v1/customer-credits/accounts?${query}`);
    const rows = Array.isArray(list?.data) ? list.data : [];
    const found = rows.find((row) => {
      const name = String(row?.name || "").trim().toLowerCase();
      if (name !== GENERATION_WALLET_NAME) return false;
      if (row.customer_id && row.customer_id !== customerId) return false;
      return true;
    });
    if (found) {
      if (found.status !== "active" || typeof found.id !== "string" || !found.id.startsWith("cca_")) {
        throw new CreemRequestError(409, "credits_unavailable");
      }
      return found;
    }
    if (!list?.has_more || rows.length === 0) break;
    const last = rows[rows.length - 1];
    if (!last?.id) break;
    startingAfter = last.id;
  }

  try {
    const created = await creem.post("/v1/customer-credits/accounts", {
      customer_id: customerId,
      name: GENERATION_WALLET_NAME,
      unit_label: "credits",
    });
    if (!created?.id || created.status !== "active") {
      throw new CreemRequestError(502, "credits_unavailable");
    }
    return created;
  } catch (error) {
    if (error instanceof CreemRequestError && (error.status === 409 || error.status === 422)) {
      const list = await creem.get(
        `/v1/customer-credits/accounts?customer_id=${encodeURIComponent(customerId)}&limit=100`,
      );
      const found = (Array.isArray(list?.data) ? list.data : []).find(
        (row) => String(row?.name || "").trim().toLowerCase() === GENERATION_WALLET_NAME,
      );
      if (found?.status === "active" && typeof found.id === "string") return found;
    }
    throw error;
  }
}

export async function ensureGenerationCustomer(creem, customerId, requestId) {
  if (!CUSTOMER_ID.test(customerId)) throw new CreemRequestError(400, "bad_customer");
  const customer = await creem.get(`/v1/customers?customer_id=${encodeURIComponent(customerId)}`);
  if (!customer || customer.id !== customerId) {
    throw new CreemRequestError(502, "credits_unavailable");
  }
  let externalId = typeof customer.external_id === "string" ? customer.external_id.trim() : "";
  if (!externalId) {
    externalId = externalIdFor(customerId, requestId);
    if (!externalId) throw new CreemRequestError(400, "bad_customer");
    const updated = await creem.patch("/v1/customers", {
      customer_id: customerId,
      external_id: externalId,
    });
    const confirmed = typeof updated?.external_id === "string" ? updated.external_id.trim() : "";
    externalId = confirmed || externalId;
  }
  if (!EXTERNAL_ID.test(externalId)) throw new CreemRequestError(502, "credits_unavailable");
  const account = await ensureGenerationWallet(creem, customerId);
  const unit =
    typeof account.unit_label === "string" && account.unit_label.trim()
      ? account.unit_label.trim()
      : "credits";
  return { externalId, customerId, accountId: account.id, unit };
}

export async function readBalance(creem, accountId) {
  const data = await creem.get(
    `/v1/customer-credits/accounts/${encodeURIComponent(accountId)}/balance`,
  );
  if (!data || typeof data.balance !== "string" || !/^[0-9]+$/.test(data.balance)) {
    throw new CreemRequestError(502, "credits_unavailable");
  }
  return data.balance;
}

async function balanceForSession(creem, session) {
  try {
    return { balance: await readBalance(creem, session.aid), accountId: session.aid };
  } catch (error) {
    if (error instanceof CreemRequestError && error.status === 404) {
      const account = await ensureGenerationWallet(creem, session.cid);
      return { balance: await readBalance(creem, account.id), accountId: account.id };
    }
    throw error;
  }
}

export async function createProductCheckout(creem, { customerId, externalId, successUrl }) {
  const data = await creem.post("/v1/checkouts", {
    product_id: HD_PRODUCT_ID,
    customer: { id: customerId },
    request_id: externalId,
    success_url: successUrl,
    metadata: { external_id: externalId },
  });
  const url = data?.checkout_url;
  if (typeof url !== "string" || !url.startsWith("https://")) {
    throw new CreemRequestError(502, "credits_unavailable");
  }
  return url;
}

async function debitGeneration(creem, { accountId, amount, generationId, moderationId }) {
  const data = await creem.post(
    `/v1/customer-credits/accounts/${encodeURIComponent(accountId)}/debit`,
    {
      amount,
      reference: `gen:${generationId}`,
      idempotency_key: `debit_${generationId}`,
      moderation_id: moderationId,
    },
  );
  if (!data || typeof data.id !== "string" || !data.id.startsWith("cct_")) {
    throw new CreemRequestError(502, "credits_unavailable");
  }
  return data;
}

async function reverseDebit(creem, accountId, transactionId) {
  const data = await creem.post(
    `/v1/customer-credits/accounts/${encodeURIComponent(accountId)}/reverse`,
    { transaction_id: transactionId },
  );
  if (!data || typeof data.id !== "string") {
    throw new CreemRequestError(502, "refund_pending");
  }
  return data;
}

function debitFailure(error) {
  if (!(error instanceof CreemRequestError)) return { outcome: "credits_unavailable" };
  if (error.code === "insufficient_balance") return { outcome: "insufficient" };
  if (error.code === "moderation_denied" || error.code === "moderation_flagged") {
    return { outcome: "prompt_rejected" };
  }
  return { outcome: "credits_unavailable" };
}

/**
 * Balance, then screen, then debit with the moderation id, then the model hook.
 * The hook failing reverses that debit. A failed screen or debit never generates.
 */
export async function runPaidGeneration({
  creem,
  session,
  prompt,
  generationId,
  cost,
  now,
  screen,
  generate,
}) {
  let balance;
  try {
    balance = await readBalance(creem, session.aid);
  } catch (error) {
    if (error instanceof CreemRequestError && error.status === 404) {
      return { outcome: "credits_unavailable" };
    }
    return { outcome: "credits_unavailable" };
  }
  if (BigInt(balance) < BigInt(cost)) {
    return { outcome: "insufficient", balance };
  }

  let moderated;
  try {
    moderated = await screen({
      prompt,
      externalId: `user_${session.uid}:gen_${generationId}`,
    });
  } catch {
    return { outcome: "moderation_unavailable" };
  }
  const decision = classifyModeration(moderated, now);
  if (!decision.ok) return { outcome: decision.error === "prompt_rejected" ? "prompt_rejected" : "moderation_unavailable" };

  let debit;
  try {
    debit = await debitGeneration(creem, {
      accountId: session.aid,
      amount: cost,
      generationId,
      moderationId: decision.id,
    });
  } catch (error) {
    const failed = debitFailure(error);
    if (failed.outcome === "insufficient") return { outcome: "insufficient", balance };
    return failed;
  }

  try {
    const raw = await generate({
      prompt,
      generationId,
      moderationId: decision.id,
    });
    const generation = raw === undefined ? null : raw;
    JSON.stringify(generation);
    return {
      outcome: "generated",
      moderationId: decision.id,
      transactionId: debit.id,
      generation,
    };
  } catch (error) {
    try {
      await reverseDebit(creem, session.aid, debit.id);
    } catch {
      return {
        outcome: "refund_pending",
        moderationId: decision.id,
        transactionId: debit.id,
      };
    }
    const code = error && error.code === "generation_not_implemented"
      ? "generation_not_implemented"
      : "generation_failed";
    return { outcome: "reversed", error: code, moderationId: decision.id };
  }
}

function customerIdOf(checkout) {
  const customer = checkout?.customer;
  if (typeof customer === "string") return customer;
  if (customer && typeof customer.id === "string") return customer.id;
  if (typeof checkout?.order?.customer === "string") return checkout.order.customer;
  return "";
}

function productIdOf(checkout) {
  const product = checkout?.product;
  if (typeof product === "string") return product;
  if (product && typeof product.id === "string") return product.id;
  const orderProduct = checkout?.order?.product;
  if (typeof orderProduct === "string") return orderProduct;
  if (orderProduct && typeof orderProduct.id === "string") return orderProduct.id;
  return "";
}

export function creditsHealth({ apiKey, allowTestKey, webhookSecret, sessionSecret }) {
  const ready =
    keyAllowed(apiKey, allowTestKey) &&
    sessionConfigured(sessionSecret) &&
    webhookConfigured(webhookSecret);
  return ready ? "ready" : "unconfigured";
}

function creemFor(ctx) {
  return createCreem({ apiKey: ctx.apiKey, fetchImpl: ctx.creemFetch || fetch });
}

function nowOf(ctx) {
  if (typeof ctx.now === "function") return ctx.now();
  if (typeof ctx.now === "number") return ctx.now;
  return Date.now();
}

async function readJsonBody(request, limit) {
  const raw = await request.text();
  if (raw.length > limit) return { error: "too_large", raw };
  if (!raw) return { body: {}, raw };
  try {
    return { body: JSON.parse(raw), raw };
  } catch {
    return { error: "bad_request", raw };
  }
}

function clientIp(request) {
  return (request.headers.get("x-forwarded-for") || "local").split(",")[0].trim() || "local";
}

async function checkoutUrlFor(ctx, session) {
  try {
    return await createProductCheckout(creemFor(ctx), {
      customerId: session.cid,
      externalId: session.uid,
      successUrl: publicSuccessUrl(ctx.successUrl),
    });
  } catch {
    return STATIC_CHECKOUT_URL;
  }
}

function neededBody() {
  return {
    ok: false,
    error: "credits_needed",
    checkoutUrl: STATIC_CHECKOUT_URL,
  };
}

export async function dispatchCredits(request, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const known =
    path === "/v1/credits" ||
    path === "/v1/credits/claim" ||
    path === "/v1/credits/checkout" ||
    path === "/v1/generations" ||
    path === "/v1/creem/webhook";
  if (!known) return null;

  const { json } = ctx;
  const method = request.method;
  if (path === "/v1/creem/webhook") {
    if (method !== "POST") return json({ ok: false, error: "not_found" }, 404);
    return handleWebhook(request, ctx);
  }

  const origin = request.headers.get("origin");
  if (origin && !ctx.originAllowed(origin)) {
    return json({ ok: false, error: "origin_not_allowed" }, 403);
  }
  if (!ctx.takeRateLimit(clientIp(request), "credits")) {
    return json({ ok: false, error: "credits_unavailable" }, 429);
  }

  if (path === "/v1/credits" && method === "GET") return handleBalance(request, ctx);
  if (path === "/v1/credits/claim" && method === "POST") return handleClaim(request, ctx);
  if (path === "/v1/credits/checkout" && method === "POST") return handleCheckout(request, ctx);
  if (path === "/v1/generations" && method === "POST") return handlePaid(request, ctx);
  return json({ ok: false, error: "not_found" }, 404);
}

async function requireReady(ctx, request) {
  const cost = parseCreditCost(ctx.creditCost);
  if (!keyAllowed(ctx.apiKey, ctx.allowTestKey) || !sessionConfigured(ctx.sessionSecret) || !cost) {
    return { error: ctx.json({ ok: false, error: "credits_unavailable" }, 503) };
  }
  const session = await readSession(
    ctx.sessionSecret,
    bearerToken(request.headers.get("authorization")),
    nowOf(ctx),
  );
  if (!session) {
    return { error: ctx.json(neededBody(), 401), cost };
  }
  return { session, cost };
}

async function handleBalance(request, ctx) {
  const ready = await requireReady(ctx, request);
  if (ready.error && !ready.session) return ready.error;
  try {
    const creem = creemFor(ctx);
    const { balance, accountId } = await balanceForSession(creem, ready.session);
    const session = await issueSession(
      ctx.sessionSecret,
      { uid: ready.session.uid, cid: ready.session.cid, aid: accountId },
      nowOf(ctx),
    );
    return ctx.json(
      {
        ok: true,
        session,
        balance,
        cost: ready.cost,
        unit: "credits",
      },
      200,
    );
  } catch {
    return ctx.json({ ok: false, error: "credits_unavailable" }, 503);
  }
}

async function handleClaim(request, ctx) {
  const parsed = await readJsonBody(request, 8000);
  if (parsed.error) return ctx.json({ ok: false, error: "bad_request" }, 400);
  const query = parsed.body && typeof parsed.body.query === "string" ? parsed.body.query : "";
  const verified = await verifyRedirectSignature(query, ctx.apiKey);
  if (!verified.ok) return ctx.json({ ok: false, error: "payment_not_verified" }, 401);

  const customerId = verified.params.get("customer_id") || "";
  const productId = verified.params.get("product_id") || "";
  const requestId = verified.params.get("request_id") || "";
  if (productId !== HD_PRODUCT_ID) {
    return ctx.json({ ok: false, error: "product_not_allowed" }, 400);
  }
  if (!CUSTOMER_ID.test(customerId)) return ctx.json({ ok: false, error: "bad_request" }, 400);

  const cost = parseCreditCost(ctx.creditCost);
  if (!keyAllowed(ctx.apiKey, ctx.allowTestKey) || !sessionConfigured(ctx.sessionSecret) || !cost) {
    return ctx.json({ ok: false, error: "credits_unavailable" }, 503);
  }

  try {
    const creem = creemFor(ctx);
    const bound = await ensureGenerationCustomer(creem, customerId, requestId);
    const balance = await readBalance(creem, bound.accountId);
    const session = await issueSession(
      ctx.sessionSecret,
      { uid: bound.externalId, cid: bound.customerId, aid: bound.accountId },
      nowOf(ctx),
    );
    return ctx.json(
      {
        ok: true,
        session,
        balance,
        cost,
        unit: bound.unit,
        externalId: bound.externalId,
        customerId: bound.customerId,
        accountId: bound.accountId,
      },
      200,
    );
  } catch {
    return ctx.json({ ok: false, error: "credits_unavailable" }, 503);
  }
}

async function handleCheckout(request, ctx) {
  const header = bearerToken(request.headers.get("authorization"));
  if (!header) return ctx.json({ ok: true, checkoutUrl: STATIC_CHECKOUT_URL }, 200);
  const ready = await requireReady(ctx, request);
  if (!ready.session) return ready.error;
  const checkoutUrl = await checkoutUrlFor(ctx, ready.session);
  return ctx.json({ ok: true, checkoutUrl }, 200);
}

async function handlePaid(request, ctx) {
  const header = bearerToken(request.headers.get("authorization"));
  if (!header) return ctx.json(neededBody(), 401);
  const ready = await requireReady(ctx, request);
  if (!ready.session) return ready.error;

  const parsed = await readJsonBody(request, 4000);
  if (parsed.error === "too_large") return ctx.json({ ok: false, error: "prompt_too_long" }, 400);
  if (parsed.error) return ctx.json({ ok: false, error: "bad_request" }, 400);
  const selected = ctx.selectPrompt(parsed.body || {});
  if (selected.error) return ctx.json({ ok: false, error: selected.error }, 400);

  const generationId = normalizeGenerationId(parsed.body?.generationId);
  const creem = creemFor(ctx);
  const result = await runPaidGeneration({
    creem,
    session: ready.session,
    prompt: selected.prompt,
    generationId,
    cost: ready.cost,
    now: nowOf(ctx),
    screen: ctx.screen,
    generate: ctx.generateImpl || unimplementedGeneration,
  });

  if (result.outcome === "insufficient") {
    const checkoutUrl = await checkoutUrlFor(ctx, ready.session);
    return ctx.json(
      {
        ok: false,
        error: "insufficient_credits",
        balance: result.balance,
        cost: ready.cost,
        checkoutUrl,
      },
      402,
    );
  }
  if (result.outcome === "prompt_rejected") {
    return ctx.json({ ok: false, error: "prompt_rejected" }, 400);
  }
  if (result.outcome === "moderation_unavailable") {
    return ctx.json({ ok: false, error: "moderation_unavailable" }, 503);
  }
  if (result.outcome === "credits_unavailable") {
    return ctx.json({ ok: false, error: "credits_unavailable" }, 503);
  }
  if (result.outcome === "refund_pending") {
    return ctx.json(
      {
        ok: false,
        error: "refund_pending",
        moderationId: result.moderationId,
        transactionId: result.transactionId,
      },
      502,
    );
  }
  if (result.outcome === "reversed") {
    return ctx.json(
      {
        ok: false,
        error: result.error,
        refunded: true,
        moderationId: result.moderationId,
      },
      result.error === "generation_not_implemented" ? 501 : 502,
    );
  }
  return ctx.json(
    {
      ok: true,
      decision: "allow",
      moderationId: result.moderationId,
      transactionId: result.transactionId,
      generation: result.generation,
    },
    200,
  );
}

async function handleWebhook(request, ctx) {
  if (!webhookConfigured(ctx.webhookSecret)) {
    return ctx.json({ ok: false, error: "credits_unavailable" }, 503);
  }
  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return ctx.json({ ok: false, error: "bad_request" }, 400);
  }
  if (raw.length > 262144) return ctx.json({ ok: false, error: "bad_request" }, 413);
  const header = request.headers.get("creem-signature") || "";
  const valid = await verifyWebhookSignature(raw, header, ctx.webhookSecret);
  if (!valid) return ctx.json({ ok: false, error: "payment_not_verified" }, 401);

  let event;
  try {
    event = raw ? JSON.parse(raw) : null;
  } catch {
    return ctx.json({ ok: false, error: "bad_request" }, 400);
  }
  const eventType = event && typeof event.eventType === "string" ? event.eventType : "";
  if (eventType !== "checkout.completed") {
    // credits.granted and every other event are acknowledged only.
    // Creem already added purchased credits. Do not credit them again.
    return ctx.json({ ok: true }, 200);
  }

  const checkout = event.object;
  if (productIdOf(checkout) !== HD_PRODUCT_ID) return ctx.json({ ok: true }, 200);
  const customerId = customerIdOf(checkout);
  if (!CUSTOMER_ID.test(customerId)) {
    return ctx.json({ ok: false, error: "credits_unavailable" }, 500);
  }
  if (!keyAllowed(ctx.apiKey, ctx.allowTestKey)) {
    return ctx.json({ ok: false, error: "credits_unavailable" }, 503);
  }
  try {
    await ensureGenerationCustomer(creemFor(ctx), customerId, checkout?.request_id || "");
  } catch (error) {
    const code = error instanceof CreemRequestError ? error.code : "credits_unavailable";
    console.error("creem_webhook_bind_failed", code);
    return ctx.json({ ok: false, error: "credits_unavailable" }, 500);
  }
  return ctx.json({ ok: true }, 200);
}
