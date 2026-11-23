import { playableVideoUrl } from "../src/lib/playableVideoUrl.mjs";
import { hmacSha256Hex, safeEqualHex, sessionConfigured } from "./session.mjs";

/**
 * Paid HD image-to-video.
 *
 * MiniMax video generation V2 (Hailuo / H3), checked against
 * https://platform.minimax.io/docs/api-reference/video-generation-v2-create
 * and https://platform.minimax.io/docs/api-reference/video-generation-v2-query.
 *
 * MiniMax-H3 is the current Hailuo image-to-video model. 768P for 5 seconds
 * is the paid HD setting. Published H3 768P output is $0.08 per second, so
 * 5 seconds is $0.40 before tax. The first input images on a task are inside
 * the free image quota. 2K is $0.13 per second and is not requested.
 * Hailuo 2.3 cannot do 5 seconds (only 6 or 10), so this path does not use it.
 *
 * The key is MINIMAX_API_KEY. Never log it or put it in the repo.
 */
export const MINIMAX_API_BASE = "https://api.minimax.io";
export const HAILUO_MODEL = "MiniMax-H3";
export const HAILUO_RESOLUTION = "768P";
export const HAILUO_DURATION = 5;
export const VIDEO_TICKET_TTL_MS = 24 * 60 * 60 * 1000;

const TASK_ID = /^[A-Za-z0-9_-]{1,128}$/;
const TX_ID = /^cct_[A-Za-z0-9]+$/;
const ACCOUNT_ID = /^cca_[A-Za-z0-9]+$/;
const GENERATION_ID = /^[A-Za-z0-9._:-]{8,80}$/;
const DATA_URL = /^data:image\/(jpeg|jpg|png|webp);base64,([a-z0-9+/=\s]+)$/i;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const textEncoder = new TextEncoder();

export function minimaxConfigured(apiKey) {
  return typeof apiKey === "string" && apiKey.trim().length > 0;
}

function generationFailed() {
  const error = new Error("generation_failed");
  error.code = "generation_failed";
  return error;
}

function asTaskId(value) {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    value = String(value);
  }
  if (typeof value === "string" && TASK_ID.test(value)) return value;
  return "";
}

/** JPG, PNG, or WEBP data URL only. Remote URLs are rejected. */
export function parsePortraitDataUrl(value) {
  if (typeof value !== "string") return { error: "image_required" };
  const trimmed = value.trim();
  if (!trimmed) return { error: "image_required" };
  if (trimmed.length > 18 * 1024 * 1024) return { error: "image_too_large" };
  const match = DATA_URL.exec(trimmed);
  if (!match) return { error: "image_required" };
  let mime = match[1].toLowerCase();
  if (mime === "jpg") mime = "jpeg";
  const b64 = match[2].replace(/\s+/g, "");
  if (b64.length < 32 || b64.length % 4 !== 0) return { error: "image_required" };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { error: "image_required" };
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  const bytes = Math.floor((b64.length * 3) / 4) - padding;
  if (bytes < 32) return { error: "image_required" };
  if (bytes > MAX_IMAGE_BYTES) return { error: "image_too_large" };
  return { dataUrl: `data:image/${mime};base64,${b64}` };
}

/** Request body for one paid dolly zoom. Resolution and duration are fixed. */
export function buildHailuoImageRequest({ prompt, image }) {
  return {
    model: HAILUO_MODEL,
    content: [
      { type: "text", text: typeof prompt === "string" ? prompt : "" },
      {
        type: "image_url",
        image_url: { url: image },
        role: "first_frame",
      },
    ],
    resolution: HAILUO_RESOLUTION,
    duration: HAILUO_DURATION,
    ratio: "adaptive",
    generate_audio: false,
  };
}

export function taskIdFromCreate(data) {
  if (!data || typeof data !== "object") return "";
  const nested = asTaskId(data.task_id) || asTaskId(data.task && data.task.id);
  if (nested) return nested;
  const flatId = asTaskId(data.id);
  if (!flatId) return "";
  if (data.status === "queued" || data.status === "running" || data.status === "succeeded") {
    return flatId;
  }
  if (data.model === HAILUO_MODEL) return flatId;
  return "";
}

function hasProviderError(data) {
  if (!data || typeof data !== "object") return true;
  if (data.type === "error") return true;
  if (data.error && typeof data.error === "object") return true;
  const base = data.base_resp;
  if (base && typeof base.status_code === "number" && base.status_code !== 0) return true;
  return false;
}

export function interpretHailuoTask(data) {
  const task =
    data && typeof data === "object" && data.task && typeof data.task === "object"
      ? data.task
      : data;
  if (!task || typeof task !== "object") return { outcome: "retry" };
  const status = typeof task.status === "string" ? task.status : "";
  const taskId = asTaskId(task.id) || asTaskId(task.task_id);
  if (status === "queued" || status === "running") {
    return { outcome: "processing", status, taskId };
  }
  if (status === "succeeded") {
    const videoUrl = playableVideoUrl(task.content && task.content.url);
    if (!videoUrl) return { outcome: "processing", status, taskId };
    return { outcome: "succeeded", status, taskId, videoUrl };
  }
  if (status === "failed" || status === "cancelled") {
    return { outcome: "failed", status, taskId };
  }
  return { outcome: "retry" };
}

async function minimaxFetchJson({ apiKey, fetchImpl, url, method, body, timeoutMs }) {
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!key) throw generationFailed();
  const headers = { authorization: `Bearer ${key}` };
  const init = { method, headers, signal: AbortSignal.timeout(timeoutMs) };
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetchImpl(url, init);
  } catch {
    throw generationFailed();
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { response, data };
}

/**
 * Create one image-to-video task. Throws generation_failed when the task
 * was not accepted. The caller reverses the Creem debit in that case.
 */
export async function startHailuoImageToVideo({
  apiKey,
  fetchImpl = fetch,
  prompt,
  image,
  timeoutMs = 45_000,
}) {
  const portrait = parsePortraitDataUrl(image);
  if (portrait.error || typeof prompt !== "string" || !prompt.trim()) throw generationFailed();
  const payload = buildHailuoImageRequest({ prompt, image: portrait.dataUrl });
  if (payload.model !== HAILUO_MODEL || payload.resolution !== "768P" || payload.duration !== 5) {
    throw generationFailed();
  }
  const { response, data } = await minimaxFetchJson({
    apiKey,
    fetchImpl,
    url: `${MINIMAX_API_BASE}/v2/video_generation`,
    method: "POST",
    body: payload,
    timeoutMs,
  });
  const taskId = taskIdFromCreate(data);
  if (!response.ok || !taskId || hasProviderError(data)) throw generationFailed();
  return {
    provider: "minimax",
    model: HAILUO_MODEL,
    status: "processing",
    taskId,
    resolution: HAILUO_RESOLUTION,
    duration: HAILUO_DURATION,
  };
}

/** Query one task. Transport errors stay retryable and do not mean the video failed. */
export async function queryHailuoTask({
  apiKey,
  fetchImpl = fetch,
  taskId,
  timeoutMs = 15_000,
}) {
  const id = asTaskId(taskId);
  if (!id) return { outcome: "retry" };
  try {
    const { response, data } = await minimaxFetchJson({
      apiKey,
      fetchImpl,
      url: `${MINIMAX_API_BASE}/v2/query/video_generation/${encodeURIComponent(id)}`,
      method: "GET",
      timeoutMs,
    });
    if (!response.ok) return { outcome: "retry" };
    return interpretHailuoTask(data);
  } catch {
    return { outcome: "retry" };
  }
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

/** Signed pointer from a paid task back to the Creem debit. The API key is not in it. */
export async function issueVideoTicket(secret, fields, now = Date.now()) {
  if (!sessionConfigured(secret)) throw generationFailed();
  const taskId = asTaskId(fields && fields.taskId);
  const transactionId = fields && fields.transactionId;
  const accountId = fields && fields.accountId;
  const generationId = fields && fields.generationId;
  if (!taskId || typeof transactionId !== "string" || !TX_ID.test(transactionId)) {
    throw generationFailed();
  }
  if (typeof accountId !== "string" || !ACCOUNT_ID.test(accountId)) throw generationFailed();
  if (typeof generationId !== "string" || !GENERATION_ID.test(generationId)) throw generationFailed();
  const payload = {
    v: 1,
    tid: taskId,
    tx: transactionId,
    aid: accountId,
    gid: generationId,
    exp: now + VIDEO_TICKET_TTL_MS,
  };
  const body = toBase64Url(JSON.stringify(payload));
  const signature = await hmacSha256Hex(secret.trim(), `video.${body}`);
  return `${body}.${signature}`;
}

export async function readVideoTicket(secret, token, now = Date.now()) {
  if (!sessionConfigured(secret) || typeof token !== "string" || token.length > 4000) return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = await hmacSha256Hex(secret.trim(), `video.${body}`);
  if (!safeEqualHex(signature, expected)) return null;
  let payload;
  try {
    payload = JSON.parse(fromBase64Url(body));
  } catch {
    return null;
  }
  if (!payload || payload.v !== 1) return null;
  const taskId = asTaskId(payload.tid);
  if (!taskId || typeof payload.tx !== "string" || !TX_ID.test(payload.tx)) return null;
  if (typeof payload.aid !== "string" || !ACCOUNT_ID.test(payload.aid)) return null;
  if (typeof payload.gid !== "string" || !GENERATION_ID.test(payload.gid)) return null;
  if (typeof payload.exp !== "number" || !(payload.exp > now)) return null;
  return {
    taskId,
    transactionId: payload.tx,
    aid: payload.aid,
    generationId: payload.gid,
    exp: payload.exp,
  };
}
