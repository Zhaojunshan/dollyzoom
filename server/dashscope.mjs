import { playableVideoUrl } from "../src/lib/playableVideoUrl.mjs";
import { hmacSha256Hex, safeEqualHex, sessionConfigured } from "./session.mjs";

/**
 * Paid HD image-to-video through Alibaba Cloud Model Studio (DashScope / Bailian).
 *
 * Checked against the Wan first-frame image-to-video reference:
 * https://help.aliyun.com/en/model-studio/legacy-image-to-video-api-reference/
 * https://help.aliyun.com/en/model-studio/image-to-video-guide
 *
 * wan2.6-i2v-flash is asynchronous. Create with X-DashScope-Async: enable,
 * then poll GET /api/v1/tasks/{task_id}. A China (Beijing) Bailian key uses
 * https://dashscope.aliyuncs.com. The workspace domain
 * https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com also works; set
 * DASHSCOPE_BASE_URL when that host is required. The key is DASHSCOPE_API_KEY.
 * Never log it or put it in the repo.
 *
 * Defaults are 720P, 5 seconds, and audio false. wan2.6-i2v-flash bills a
 * silent clip only when parameters.audio is explicitly false. Resolution,
 * duration, and audio can be changed with WAN_RESOLUTION, WAN_DURATION, and
 * WAN_AUDIO. The model name stays wan2.6-i2v-flash.
 *
 * The returned video_url is a temporary OSS link, valid for about 24 hours.
 */
export const WAN_MODEL = "wan2.6-i2v-flash";
export const BEIJING_BASE_URL = "https://dashscope.aliyuncs.com";
export const SINGAPORE_BASE_URL = "https://dashscope-intl.aliyuncs.com";
export const VIDEO_TICKET_TTL_MS = 24 * 60 * 60 * 1000;

const REGION_BASE = {
  beijing: BEIJING_BASE_URL,
  "cn-beijing": BEIJING_BASE_URL,
  china: BEIJING_BASE_URL,
  singapore: SINGAPORE_BASE_URL,
  intl: SINGAPORE_BASE_URL,
  "ap-southeast-1": SINGAPORE_BASE_URL,
};

const RESOLUTIONS = new Set(["480P", "720P", "1080P"]);
const TASK_ID = /^[A-Za-z0-9_-]{1,128}$/;
const TX_ID = /^cct_[A-Za-z0-9]+$/;
const ACCOUNT_ID = /^cca_[A-Za-z0-9]+$/;
const GENERATION_ID = /^[A-Za-z0-9._:-]{8,80}$/;
const DATA_URL = /^data:image\/(jpeg|jpg|png|webp);base64,([a-z0-9+/=\s]+)$/i;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const textEncoder = new TextEncoder();

export function dashscopeConfigured(apiKey) {
  return typeof apiKey === "string" && apiKey.trim().length > 0;
}

function generationFailed() {
  const error = new Error("generation_failed");
  error.code = "generation_failed";
  return error;
}

function asTaskId(value) {
  if (typeof value === "number" && Number.isSafeInteger(value)) value = String(value);
  if (typeof value === "string" && TASK_ID.test(value)) return value;
  return "";
}

/** HTTPS origin only. A bad override stays on the Beijing host. */
export function resolveDashscopeBaseUrl({ baseUrl, region } = {}) {
  const explicit = typeof baseUrl === "string" ? baseUrl.trim() : "";
  if (explicit) {
    try {
      const url = new URL(explicit);
      if (url.protocol === "https:" && !url.username && !url.password) {
        return url.origin;
      }
    } catch {
      // Fall through to the region default.
    }
  }
  const name = typeof region === "string" ? region.trim().toLowerCase() : "";
  return REGION_BASE[name] || BEIJING_BASE_URL;
}

/** Defaults: 720P, 5 seconds, silent. Unknown values stay on those defaults. */
export function wanSettings(env = {}) {
  const resolutionRaw = String(env.resolution ?? "720P").trim().toUpperCase();
  const resolution = RESOLUTIONS.has(resolutionRaw) ? resolutionRaw : "720P";
  const durationRaw = Number(env.duration ?? 5);
  const duration = Number.isInteger(durationRaw) && durationRaw >= 2 && durationRaw <= 15 ? durationRaw : 5;
  const audioRaw = String(env.audio ?? "false").trim().toLowerCase();
  const audio = audioRaw === "1" || audioRaw === "true";
  return {
    model: WAN_MODEL,
    resolution,
    duration,
    audio,
    baseUrl: resolveDashscopeBaseUrl({ baseUrl: env.baseUrl, region: env.region }),
  };
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

export function buildWanImageRequest({ prompt, image, settings }) {
  const chosen = settings || wanSettings();
  return {
    model: WAN_MODEL,
    input: {
      prompt: typeof prompt === "string" ? prompt : "",
      img_url: image,
    },
    parameters: {
      resolution: chosen.resolution,
      duration: chosen.duration,
      audio: chosen.audio === true,
      prompt_extend: false,
      watermark: false,
    },
  };
}

export function taskIdFromCreate(data) {
  if (!data || typeof data !== "object") return "";
  if (typeof data.code === "string" && data.code && !data.output) return "";
  return asTaskId(data.output && data.output.task_id) || asTaskId(data.task_id);
}

/** OSS signed URLs put the expiry in Expires as unix seconds. */
export function videoExpiresAt(url) {
  const playable = playableVideoUrl(url);
  if (!playable) return null;
  const value = new URL(playable).searchParams.get("Expires");
  if (!value || !/^[0-9]+$/.test(value)) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric < 1e12 ? numeric * 1000 : numeric;
}

export function interpretWanTask(data) {
  if (!data || typeof data !== "object") return { outcome: "retry" };
  const output = data.output && typeof data.output === "object" ? data.output : null;
  if (!output) return { outcome: "retry" };
  const status = typeof output.task_status === "string" ? output.task_status : "";
  const taskId = asTaskId(output.task_id);
  if (status === "PENDING") return { outcome: "processing", status: "queued", taskId };
  if (status === "RUNNING") return { outcome: "processing", status: "running", taskId };
  if (status === "SUCCEEDED") {
    const videoUrl = playableVideoUrl(output.video_url);
    if (!videoUrl) return { outcome: "processing", status: "running", taskId };
    return {
      outcome: "succeeded",
      status: "succeeded",
      taskId,
      videoUrl,
      expiresAt: videoExpiresAt(videoUrl),
    };
  }
  if (status === "FAILED" || status === "CANCELED") {
    return { outcome: "failed", status: status.toLowerCase(), taskId };
  }
  if (status === "UNKNOWN") return { outcome: "expired", status: "unknown", taskId };
  return { outcome: "retry" };
}

async function dashscopeFetchJson({ apiKey, fetchImpl, url, method, body, timeoutMs, asyncCall }) {
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!key) throw generationFailed();
  const headers = { authorization: `Bearer ${key}` };
  if (asyncCall) headers["X-DashScope-Async"] = "enable";
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
export async function startWanImageToVideo({
  apiKey,
  fetchImpl = fetch,
  prompt,
  image,
  settings,
  timeoutMs = 45_000,
}) {
  const portrait = parsePortraitDataUrl(image);
  if (portrait.error || typeof prompt !== "string" || !prompt.trim()) throw generationFailed();
  const chosen = settings || wanSettings();
  const payload = buildWanImageRequest({ prompt, image: portrait.dataUrl, settings: chosen });
  if (payload.model !== WAN_MODEL || payload.parameters.audio !== chosen.audio) throw generationFailed();
  const { response, data } = await dashscopeFetchJson({
    apiKey,
    fetchImpl,
    url: `${chosen.baseUrl}/api/v1/services/aigc/video-generation/video-synthesis`,
    method: "POST",
    body: payload,
    timeoutMs,
    asyncCall: true,
  });
  const taskId = taskIdFromCreate(data);
  if (!response.ok || !taskId || (data && typeof data.code === "string" && data.code)) {
    throw generationFailed();
  }
  return {
    provider: "dashscope",
    model: WAN_MODEL,
    status: "processing",
    taskId,
    resolution: chosen.resolution,
    duration: chosen.duration,
    audio: chosen.audio,
  };
}

/** Query one task. Transport errors stay retryable and do not mean the video failed. */
export async function queryWanTask({
  apiKey,
  fetchImpl = fetch,
  taskId,
  settings,
  timeoutMs = 15_000,
}) {
  const id = asTaskId(taskId);
  if (!id) return { outcome: "retry" };
  const chosen = settings || wanSettings();
  try {
    const { response, data } = await dashscopeFetchJson({
      apiKey,
      fetchImpl,
      url: `${chosen.baseUrl}/api/v1/tasks/${encodeURIComponent(id)}`,
      method: "GET",
      timeoutMs,
    });
    if (!response.ok) return { outcome: "retry" };
    return interpretWanTask(data);
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
