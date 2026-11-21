/** Production Creem host. Sandbox is selected only for an explicit test key. */
export const CREEM_PRODUCTION_API = "https://api.creem.io";
export const CREEM_SANDBOX_API = "https://test-api.creem.io";

export const CREEM_PRODUCTION_MODERATION_URL = `${CREEM_PRODUCTION_API}/v1/moderation/prompt`;
export const CREEM_SANDBOX_MODERATION_URL = `${CREEM_SANDBOX_API}/v1/moderation/prompt`;

/** Existing $1.49 product. Do not mint a replacement id. */
export const HD_PRODUCT_ID = "prod_w9pGaP1bfoaF20iNiGXKt";

export const STATIC_CHECKOUT_URL = `https://www.creem.io/payment/${HD_PRODUCT_ID}`;

/** Homepage. Creem appends the signed checkout query here. */
export const DEFAULT_SUCCESS_URL = "https://dollyzoom.top/";

/** Account name Creem treats as the moderated AI generation wallet. */
export const GENERATION_WALLET_NAME = "generation";

export const MODERATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function classifyKey(apiKey) {
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!key) return "missing";
  if (key.startsWith("creem_test_")) return "test";
  if (key.startsWith("creem_")) return "live";
  return "invalid";
}

export function apiBaseForKey(apiKey) {
  return classifyKey(apiKey) === "test" ? CREEM_SANDBOX_API : CREEM_PRODUCTION_API;
}

export function moderationUrlForKey(apiKey) {
  return classifyKey(apiKey) === "test"
    ? CREEM_SANDBOX_MODERATION_URL
    : CREEM_PRODUCTION_MODERATION_URL;
}

export function keyAllowed(apiKey, allowTestKey) {
  const kind = classifyKey(apiKey);
  return kind === "live" || (kind === "test" && allowTestKey === true);
}

/**
 * Success URL we send to Creem. Anything off the registered site falls back
 * to https://dollyzoom.top/ so checkout cannot be pointed at another host.
 */
export function publicSuccessUrl(configured) {
  const candidate =
    typeof configured === "string" && configured.trim()
      ? configured.trim()
      : DEFAULT_SUCCESS_URL;
  try {
    const url = new URL(candidate);
    const site =
      url.protocol === "https:" &&
      (url.hostname === "dollyzoom.top" || url.hostname === "www.dollyzoom.top");
    const local =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if ((!site && !local) || url.username || url.password) return DEFAULT_SUCCESS_URL;
    return url.toString();
  } catch {
    return DEFAULT_SUCCESS_URL;
  }
}

/** Debit size for one paid generation. Empty means the default of 1. Invalid fails closed. */
export function parseCreditCost(value) {
  if (value == null || value === "") return "1";
  const raw = String(value).trim();
  if (!/^[1-9][0-9]{0,8}$/.test(raw)) return null;
  return raw;
}
