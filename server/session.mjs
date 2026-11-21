const textEncoder = new TextEncoder();

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const EXTERNAL_ID = /^[A-Za-z0-9._:-]{1,255}$/;
const CUSTOMER_ID = /^cust_[A-Za-z0-9]+$/;
const ACCOUNT_ID = /^cca_[A-Za-z0-9]+$/;

function bytesToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function sessionConfigured(secret) {
  return typeof secret === "string" && secret.trim().length >= 16;
}

export function webhookConfigured(secret) {
  return typeof secret === "string" && secret.trim().length > 0;
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return bytesToHex(digest);
}

export async function hmacSha256Hex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return bytesToHex(signature);
}

/** Constant-time compare for hex signatures. Rejects non-hex input. */
export function safeEqualHex(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(a) || !/^[0-9a-f]+$/.test(b) || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toBase64Url(value) {
  const bytes = textEncoder.encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value) {
  const padded = value.length % 4 === 0 ? value : value + "=".repeat(4 - (value.length % 4));
  const binary = atob(padded.replaceAll("-", "+").replaceAll("_", "/"));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function issueSession(secret, fields, now = Date.now()) {
  const payload = {
    v: 1,
    uid: fields.uid,
    cid: fields.cid,
    aid: fields.aid,
    exp: now + SESSION_TTL_MS,
  };
  const body = toBase64Url(JSON.stringify(payload));
  const signature = await hmacSha256Hex(secret.trim(), body);
  return `${body}.${signature}`;
}

export async function readSession(secret, token, now = Date.now()) {
  if (!sessionConfigured(secret) || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expected = await hmacSha256Hex(secret.trim(), body);
  if (!safeEqualHex(signature, expected)) return null;
  let payload;
  try {
    payload = JSON.parse(fromBase64Url(body));
  } catch {
    return null;
  }
  if (!payload || payload.v !== 1) return null;
  if (!EXTERNAL_ID.test(payload.uid)) return null;
  if (!CUSTOMER_ID.test(payload.cid)) return null;
  if (!ACCOUNT_ID.test(payload.aid)) return null;
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp < now) {
    return null;
  }
  return { uid: payload.uid, cid: payload.cid, aid: payload.aid, exp: payload.exp };
}

export function bearerToken(header) {
  if (typeof header !== "string") return "";
  const match = /^Bearer\s+([A-Za-z0-9_-]+\.[0-9a-fA-F]+)$/.exec(header.trim());
  return match ? match[1] : "";
}

/**
 * Creem signs the redirect with SHA-256 over `key=value|...|salt=<api key>`.
 * Docs show both URL order and a fixed field order; either digest is accepted.
 * Both are keyed with the API key, so accepting either does not trust the client.
 */
export async function verifyRedirectSignature(query, apiKey) {
  const raw = typeof query === "string" ? query : "";
  const params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  const signature = params.get("signature") || "";
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!signature || !key) return { ok: false, params };

  const urlOrdered = [];
  for (const [name, value] of params.entries()) {
    if (name === "signature" || value === "") continue;
    urlOrdered.push(`${name}=${value}`);
  }

  const preferred = [
    "request_id",
    "checkout_id",
    "order_id",
    "customer_id",
    "subscription_id",
    "product_id",
  ];
  const seen = new Set();
  const fieldOrdered = [];
  for (const name of preferred) {
    const value = params.get(name);
    if (!value) continue;
    fieldOrdered.push(`${name}=${value}`);
    seen.add(name);
  }
  for (const [name, value] of params.entries()) {
    if (name === "signature" || value === "" || seen.has(name)) continue;
    fieldOrdered.push(`${name}=${value}`);
  }

  const salt = `salt=${key}`;
  const urlOk = safeEqualHex(signature, await sha256Hex(`${urlOrdered.join("|")}|${salt}`));
  const fieldOk = safeEqualHex(signature, await sha256Hex(`${fieldOrdered.join("|")}|${salt}`));
  return { ok: urlOk || fieldOk, params };
}

export async function verifyWebhookSignature(rawBody, header, secret) {
  if (!webhookConfigured(secret) || typeof header !== "string" || typeof rawBody !== "string") {
    return false;
  }
  const expected = await hmacSha256Hex(secret.trim(), rawBody);
  return safeEqualHex(header, expected);
}
