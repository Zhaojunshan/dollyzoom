import assert from "node:assert/strict";
import { test } from "node:test";

import { hdPollAction, validHdJob } from "../src/lib/hdPoll.mjs";
import { playableVideoUrl } from "../src/lib/playableVideoUrl.mjs";
import {
  BEIJING_BASE_URL,
  SINGAPORE_BASE_URL,
  buildWanImageRequest,
  interpretWanTask,
  issueVideoTicket,
  parsePortraitDataUrl,
  queryWanTask,
  readVideoTicket,
  resolveDashscopeBaseUrl,
  startWanImageToVideo,
  taskIdFromCreate,
  videoExpiresAt,
  wanSettings,
} from "./dashscope.mjs";
import { issueSession } from "./session.mjs";

const SECRET = "session_secret_0123456789";
const PORTRAIT = `data:image/png;base64,${"A".repeat(80)}`;
const VIDEO = "https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/clip.mp4?Expires=1893456000";

test("defaults are Beijing, wan2.6-i2v-flash, 720P, 5 seconds, and silent", () => {
  const settings = wanSettings();
  assert.equal(settings.baseUrl, BEIJING_BASE_URL);
  assert.equal(settings.model, "wan2.6-i2v-flash");
  assert.equal(settings.resolution, "720P");
  assert.equal(settings.duration, 5);
  assert.equal(settings.audio, false);
  assert.equal(resolveDashscopeBaseUrl({ region: "beijing" }), BEIJING_BASE_URL);
  assert.equal(resolveDashscopeBaseUrl({ region: "singapore" }), SINGAPORE_BASE_URL);
  assert.equal(
    resolveDashscopeBaseUrl({ baseUrl: "https://llm-123.cn-beijing.maas.aliyuncs.com/api/v1", region: "singapore" }),
    "https://llm-123.cn-beijing.maas.aliyuncs.com",
  );
  assert.equal(resolveDashscopeBaseUrl({ baseUrl: "http://evil.example" }), BEIJING_BASE_URL);
  assert.equal(wanSettings({ resolution: "1080p", duration: "8", audio: "true" }).resolution, "1080P");
  assert.equal(wanSettings({ resolution: "2K", duration: 99, audio: "no" }).resolution, "720P");
  assert.equal(wanSettings({ duration: 99 }).duration, 5);
  assert.equal(wanSettings({ audio: "true" }).audio, true);

  const body = buildWanImageRequest({ prompt: "dolly zoom", image: PORTRAIT, settings });
  assert.equal(body.model, "wan2.6-i2v-flash");
  assert.deepEqual(body.input, { prompt: "dolly zoom", img_url: PORTRAIT });
  assert.deepEqual(body.parameters, {
    resolution: "720P",
    duration: 5,
    audio: false,
    prompt_extend: false,
    watermark: false,
  });
  assert.equal(JSON.stringify(body).includes("1080P"), false);
});

test("portraits are data URLs and remote or non-image values are refused", () => {
  assert.equal(parsePortraitDataUrl(PORTRAIT).dataUrl, PORTRAIT);
  assert.equal(parsePortraitDataUrl(`data:image/jpg;base64,${"B".repeat(80)}`).dataUrl.startsWith("data:image/jpeg;base64,"), true);
  assert.equal(parsePortraitDataUrl("https://example.com/photo.jpg").error, "image_required");
  assert.equal(parsePortraitDataUrl("data:image/svg+xml;base64,AAAA").error, "image_required");
  const oversized = `data:image/png;base64,${"A".repeat(13981016)}`;
  assert.equal(parsePortraitDataUrl(oversized).error, "image_too_large");
});

test("create responses accept output.task_id and reject an API error", () => {
  assert.equal(taskIdFromCreate({ output: { task_id: "0385dc79-5ff8-4d82-bcb6-abcdef12", task_status: "PENDING" } }), "0385dc79-5ff8-4d82-bcb6-abcdef12");
  assert.equal(taskIdFromCreate({ code: "InvalidApiKey", message: "No API-key provided." }), "");
});

test("starting a task posts to Beijing and refuses a missing key before fetch", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      startWanImageToVideo({
        apiKey: " ",
        prompt: "dolly",
        image: PORTRAIT,
        fetchImpl: async () => {
          calls += 1;
          throw new Error("should not fetch");
        },
      }),
    (error) => error.code === "generation_failed",
  );
  assert.equal(calls, 0);

  const seen = [];
  const started = await startWanImageToVideo({
    apiKey: "sk-test",
    prompt: "dolly zoom",
    image: PORTRAIT,
    settings: wanSettings({ region: "cn-beijing", resolution: "720P", duration: 5, audio: "false" }),
    fetchImpl: async (url, init) => {
      seen.push({ url, body: JSON.parse(init.body), authorization: init.headers.authorization, asyncHeader: init.headers["X-DashScope-Async"] });
      return new Response(JSON.stringify({ output: { task_id: "task-from-output", task_status: "PENDING" } }), { status: 200 });
    },
  });
  assert.equal(started.taskId, "task-from-output");
  assert.equal(started.model, "wan2.6-i2v-flash");
  assert.equal(started.resolution, "720P");
  assert.equal(started.duration, 5);
  assert.equal(started.audio, false);
  assert.equal(seen[0].url, "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis");
  assert.equal(seen[0].authorization, "Bearer sk-test");
  assert.equal(seen[0].asyncHeader, "enable");
  assert.equal(seen[0].body.parameters.audio, false);

  await assert.rejects(
    () =>
      startWanImageToVideo({
        apiKey: "sk-test",
        prompt: "dolly",
        image: PORTRAIT,
        fetchImpl: async () => new Response(JSON.stringify({ code: "InvalidParameter", message: "bad" }), { status: 400 }),
      }),
    (error) => error.code === "generation_failed",
  );
});

test("query results distinguish a playable video, failure, expiry, and a retry", async () => {
  const succeeded = interpretWanTask({ output: { task_id: "1", task_status: "SUCCEEDED", video_url: VIDEO } });
  assert.equal(succeeded.outcome, "succeeded");
  assert.equal(succeeded.videoUrl, VIDEO);
  assert.equal(succeeded.expiresAt, videoExpiresAt(VIDEO));
  assert.equal(interpretWanTask({ output: { task_id: "3", task_status: "PENDING" } }).status, "queued");
  assert.equal(interpretWanTask({ output: { task_id: "4", task_status: "RUNNING" } }).status, "running");
  assert.equal(interpretWanTask({ output: { task_id: "5", task_status: "FAILED", message: "no" } }).outcome, "failed");
  assert.equal(interpretWanTask({ output: { task_id: "6", task_status: "CANCELED" } }).outcome, "failed");
  assert.equal(interpretWanTask({ output: { task_id: "7", task_status: "UNKNOWN" } }).outcome, "expired");
  assert.equal(interpretWanTask({ output: { task_id: "8", task_status: "SUCCEEDED", video_url: "http://example.com/a.mp4" } }).outcome, "processing");
  assert.equal(playableVideoUrl("javascript:alert(1)"), "");

  const retry = await queryWanTask({
    apiKey: "sk-test",
    taskId: "task_1",
    fetchImpl: async (url) => {
      assert.equal(url, "https://dashscope.aliyuncs.com/api/v1/tasks/task_1");
      return new Response("nope", { status: 500 });
    },
  });
  assert.equal(retry.outcome, "retry");
});

test("video tickets bind the debit and reject tampering, expiry, and session tokens", async () => {
  const now = 1_700_000_000_000;
  const fields = {
    taskId: "0385dc79-5ff8-4d82-bcb6-abcdef12",
    transactionId: "cct_debit",
    accountId: "cca_wallet",
    generationId: "gen_test_123456",
  };
  const ticket = await issueVideoTicket(SECRET, fields, now);
  const read = await readVideoTicket(SECRET, ticket, now + 1000);
  assert.equal(read.taskId, fields.taskId);
  assert.equal(await readVideoTicket(SECRET, ticket, now + 24 * 60 * 60 * 1000), null);
  const session = await issueSession(SECRET, { uid: "dzu_cust_abc", cid: "cust_abc", aid: "cca_wallet" }, now);
  assert.equal(await readVideoTicket(SECRET, session, now), null);
  assert.equal(JSON.stringify(ticket).includes("sk-"), false);
});

test("poll decisions play an https video and stop on a refund or an expired link", () => {
  assert.equal(hdPollAction({ ok: true, generation: { videoUrl: VIDEO } }).action, "ready");
  assert.equal(hdPollAction({ ok: true, status: "processing" }).action, "wait");
  assert.equal(hdPollAction({ ok: false, error: "generation_failed", refunded: true }).action, "stop");
  assert.equal(hdPollAction({ ok: false, error: "video_expired" }).action, "stop");
  const job = validHdJob({ ticket: `${"a".repeat(8)}.${"ab".repeat(16)}`, startedAt: 1000, videoUrl: VIDEO }, 1000);
  assert.equal(job.videoUrl, VIDEO);
});
