/**
 * Shared allow-check for the static site and the moderation proxy.
 * A preview may start only when Creem returned allow plus a result id.
 * deny, flag, empty payloads, and errors are not permitted.
 *
 * @param {unknown} data
 * @returns {data is { ok: true, decision: "allow", moderationId: string }}
 */
export function generationPermitted(data) {
  if (!data || typeof data !== "object") return false;
  const id = /** @type {{ moderationId?: unknown }} */ (data).moderationId;
  return (
    /** @type {{ ok?: unknown, decision?: unknown }} */ (data).ok === true &&
    /** @type {{ decision?: unknown }} */ (data).decision === "allow" &&
    typeof id === "string" &&
    /^[A-Za-z0-9._:-]{1,128}$/.test(id)
  );
}
