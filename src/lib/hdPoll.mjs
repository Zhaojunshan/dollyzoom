import { playableVideoUrl } from "./playableVideoUrl.mjs";

/** MiniMax keeps a task queryable for 7 days. The signed ticket lasts 24 hours. */
export const HD_JOB_TTL_MS = 24 * 60 * 60 * 1000;

const TICKET = /^[A-Za-z0-9_-]{8,}\.[0-9a-fA-F]{32,}$/;

const STOP_ERRORS = new Set([
  "generation_failed",
  "refund_pending",
  "generation_not_found",
  "credits_needed",
  "prompt_rejected",
  "insufficient_credits",
  "image_required",
  "image_too_large",
  "image_dimensions",
]);

/** Drop a stored HD job that is expired, unsigned-looking, or not a playable URL. */
export function validHdJob(value, now = Date.now()) {
  if (!value || typeof value !== "object") return null;
  const ticket = value.ticket;
  const startedAt = value.startedAt;
  if (typeof ticket !== "string" || !TICKET.test(ticket)) return null;
  if (typeof startedAt !== "number" || !Number.isFinite(startedAt)) return null;
  if (now - startedAt > HD_JOB_TTL_MS || startedAt - now > 5 * 60 * 1000) return null;
  const videoUrl = playableVideoUrl(value.videoUrl);
  if (videoUrl) return { ticket, startedAt, videoUrl };
  return { ticket, startedAt };
}

/**
 * What the page should do with one paid-generation or status response.
 * Transient failures keep polling. A failed or cancelled video stops so the
 * server can reverse the debit. A playable https URL finishes the job.
 */
export function hdPollAction(body) {
  const generation = body && typeof body === "object" ? body.generation : null;
  const videoUrl = playableVideoUrl(generation && generation.videoUrl);
  if (body && body.ok === true && videoUrl) return { action: "ready", videoUrl };
  const status =
    body && typeof body === "object"
      ? body.status || (generation && generation.status) || ""
      : "";
  if (
    body &&
    body.ok === true &&
    (status === "processing" || status === "queued" || status === "running" || status === "succeeded")
  ) {
    return { action: "wait" };
  }
  const error = body && typeof body.error === "string" ? body.error : "";
  if (STOP_ERRORS.has(error)) return { action: "stop", error };
  return { action: "wait" };
}
