import assert from "node:assert/strict";
import { test } from "node:test";

import { hdPollAction, validHdJob } from "../src/lib/hdPoll.mjs";
import { playableVideoUrl } from "../src/lib/playableVideoUrl.mjs";
import { issueSession } from "./session.mjs";
import {
  HAILUO_DURATION,
  HAILUO_MODEL,
  HAILUO_RESOLUTION,
  buildHailuoImageRequest,
  interpretHailuoTask,
  issueVideoTicket,
  parsePortraitDataUrl,
  queryHailuoTask,
  readVideoTicket,
  startHailuoImageToVideo,
  taskIdFromCreate,
} from "./minimax.mjs";

const SECRET = "session_secret_0123456789";
const PORTRAIT = `data:image/png;base64,${"A".repeat(80)}`;
const VIDEO = "https://cdn.hailuoai.com/prod/clip.mp4";

test("the paid request is MiniMax-H3 image-to-video at 768P for 5 seconds", () => {
  const body = buildHailuoImageRequest({ prompt: "dolly zoom", image: PORTRAIT });
  assert.equal(body.model, "MiniMax-H3");
  assert.equal(body.model, HAILUO_MODEL);
  assert.equal(body.resolution, "768P");
  assert.equal(body.resolution, HAILUO_RESOLUTION);
  assert.equal(body.duration, 5);
  assert.equal(body.duration, HAILUO_DURATION);
  assert.equal(body.ratio, "adaptive");
  assert.equal(body.generate_audio, false);
  assert.deepEqual(body.content[0], { type: "text", text: "dolly zoom" });
  assert.deepEqual(body.content[1], {
    type: "image_url",
    image_url: { url: PORTRAIT },
    role: "first_frame",
  });
  assert.equal(JSON.stringify(body).includes("2K"), false);
  assert.equal(JSON.stringify(body).includes("1080"), false);
});

test("portraits are data URLs and remote or non-image values are refused", () => {
  assert.equal(parsePortraitDataUrl(PORTRAIT).dataUrl, PORTRAIT);
  assert.equal(parsePortraitDataUrl(`data:image/jpg;base64,${"B".repeat(80)}`).dataUrl.startsWith("data:image/jpeg;base64,"), true);
  assert.equal(parsePortraitDataUrl(`data:image/webp;base64,${"C".repeat(80)}`).error, undefined);
  assert.equal(parsePortraitDataUrl("https://example.com/photo.jpg").error, "image_required");
  assert.equal(parsePortraitDataUrl("data:image/svg+xml;base64,AAAA").error, "image_required");
  assert.equal(parsePortraitDataUrl("").error, "image_required");
  assert.equal(parsePortraitDataUrl(`data:image/png;base64,${"A".repeat(8)}`).error, "image_required");
  const oversized = `data:image/png;base64,${"A".repeat(13981016)}`;
  assert.equal(parsePortraitDataUrl(oversized).error, "image_too_large");
});

test("create responses accept task_id, nested task.id, and a flat running id", () => {
  assert.equal(taskIdFromCreate({ task_id: "424010985738629" }), "424010985738629");
  assert.equal(taskIdFromCreate({ task: { id: "task_nested" } }), "task_nested");
  assert.equal(taskIdFromCreate({ id: "task_flat", status: "queued" }), "task_flat");
  assert.equal(taskIdFromCreate({ id: "req_not_a_task" }), "");
  assert.equal(taskIdFromCreate({ type: "error", error: { message: "no" } }), "");
});

test("starting a task posts the portrait and refuses a missing key before fetch", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      startHailuoImageToVideo({
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
  const started = await startHailuoImageToVideo({
    apiKey: "test-key",
    prompt: "dolly zoom",
    image: PORTRAIT,
    fetchImpl: async (url, init) => {
      seen.push({ url, body: JSON.parse(init.body), authorization: init.headers.authorization });
      return new Response(JSON.stringify({ task: { id: "task_from_nested" } }), { status: 200 });
    },
  });
  assert.equal(started.taskId, "task_from_nested");
  assert.equal(started.status, "processing");
  assert.equal(started.resolution, "768P");
  assert.equal(started.duration, 5);
  assert.equal(seen[0].url, "https://api.minimax.io/v2/video_generation");
  assert.equal(seen[0].authorization, "Bearer test-key");
  assert.equal(seen[0].body.resolution, "768P");
  assert.equal(JSON.stringify(seen[0].body).includes("2K"), false);

  await assert.rejects(
    () =>
      startHailuoImageToVideo({
        apiKey: "test-key",
        prompt: "dolly",
        image: PORTRAIT,
        fetchImpl: async () => new Response(JSON.stringify({ type: "error" }), { status: 422 }),
      }),
    (error) => error.code === "generation_failed",
  );
});

test("query results distinguish a playable video, failure, and a retry", async () => {
  assert.deepEqual(
    interpretHailuoTask({
      task: { id: "1", status: "succeeded", content: { url: VIDEO } },
    }),
    { outcome: "succeeded", status: "succeeded", taskId: "1", videoUrl: VIDEO },
  );
  assert.equal(
    interpretHailuoTask({ id: "2", status: "succeeded", content: { url: VIDEO } }).outcome,
    "succeeded",
  );
  assert.equal(interpretHailuoTask({ task: { id: "3", status: "running" } }).outcome, "processing");
  assert.equal(interpretHailuoTask({ task: { id: "4", status: "failed" } }).outcome, "failed");
  assert.equal(interpretHailuoTask({ task: { id: "5", status: "cancelled" } }).outcome, "failed");
  assert.equal(
    interpretHailuoTask({
      task: { id: "6", status: "succeeded", content: { url: "http://cdn.example/a.mp4" } },
    }).outcome,
    "processing",
  );
  assert.equal(
    interpretHailuoTask({
      task: { id: "7", status: "succeeded", content: { url: "javascript:alert(1)" } },
    }).outcome,
    "processing",
  );

  const retry = await queryHailuoTask({
    apiKey: "test-key",
    taskId: "task_1",
    fetchImpl: async (url) => {
      assert.equal(url, "https://api.minimax.io/v2/query/video_generation/task_1");
      return new Response("nope", { status: 500 });
    },
  });
  assert.equal(retry.outcome, "retry");
  const missing = await queryHailuoTask({
    apiKey: "",
    taskId: "task_1",
    fetchImpl: async () => {
      throw new Error("should not fetch");
    },
  });
  assert.equal(missing.outcome, "retry");
});

test("video tickets bind the debit and reject tampering, expiry, and session tokens", async () => {
  const now = 1_700_000_000_000;
  const fields = {
    taskId: "424010985738629",
    transactionId: "cct_debit",
    accountId: "cca_wallet",
    generationId: "gen_test_123456",
  };
  const ticket = await issueVideoTicket(SECRET, fields, now);
  const read = await readVideoTicket(SECRET, ticket, now + 1000);
  assert.equal(read.taskId, fields.taskId);
  assert.equal(read.transactionId, fields.transactionId);
  assert.equal(read.aid, fields.accountId);
  assert.equal(await readVideoTicket(SECRET, ticket, now + 24 * 60 * 60 * 1000), null);
  assert.equal(await readVideoTicket(SECRET, `${ticket.slice(0, -1)}0`, now), null);
  assert.equal(await readVideoTicket("short", ticket, now), null);
  const session = await issueSession(SECRET, { uid: "dzu_cust_abc", cid: "cust_abc", aid: "cca_wallet" }, now);
  assert.equal(await readVideoTicket(SECRET, session, now), null);
  assert.equal(JSON.stringify(ticket).includes("minimax"), false);
});

test("poll decisions play an https video, wait on progress, and stop on a refund", () => {
  assert.deepEqual(hdPollAction({ ok: true, generation: { videoUrl: VIDEO } }), {
    action: "ready",
    videoUrl: VIDEO,
  });
  assert.equal(playableVideoUrl("http://cdn.example/a.mp4"), "");
  assert.equal(hdPollAction({ ok: true, generation: { videoUrl: "http://cdn.example/a.mp4" } }).action, "wait");
  assert.equal(hdPollAction({ ok: true, status: "processing" }).action, "wait");
  assert.equal(hdPollAction({ ok: false, error: "credits_unavailable" }).action, "wait");
  assert.equal(hdPollAction({ ok: false, error: "generation_failed", refunded: true }).action, "stop");
  assert.equal(hdPollAction({ ok: false, error: "refund_pending" }).action, "stop");
  const job = validHdJob({ ticket: `${"a".repeat(8)}.${"ab".repeat(16)}`, startedAt: 1000 }, 1000);
  assert.equal(job.ticket.length > 8, true);
  assert.equal(validHdJob({ ticket: "nope", startedAt: 1000 }, 1000), null);
});
