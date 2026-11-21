import { apiBaseForKey, classifyKey } from "./creemHost.mjs";

export class CreemRequestError extends Error {
  constructor(status, code) {
    super(code || "credits_unavailable");
    this.name = "CreemRequestError";
    this.status = status;
    this.code = code || "";
  }
}

function errorCode(data) {
  if (!data || typeof data !== "object") return "";
  const nested = data.error;
  if (nested && typeof nested === "object" && typeof nested.code === "string") return nested.code;
  if (typeof data.code === "string") return data.code;
  return "";
}

export function createCreem({ apiKey, fetchImpl = fetch, timeoutMs = 8000 }) {
  const kind = classifyKey(apiKey);
  const base = apiBaseForKey(apiKey);
  const key = typeof apiKey === "string" ? apiKey.trim() : "";

  async function call(path, { method = "GET", body } = {}) {
    if (kind !== "live" && kind !== "test") {
      throw new CreemRequestError(0, "credits_unavailable");
    }
    const headers = { "x-api-key": key };
    const init = { method, headers, signal: AbortSignal.timeout(timeoutMs) };
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    let response;
    try {
      response = await fetchImpl(`${base}${path}`, init);
    } catch {
      throw new CreemRequestError(0, "credits_unavailable");
    }
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok) {
      throw new CreemRequestError(response.status, errorCode(data) || "credits_unavailable");
    }
    return data;
  }

  return {
    kind,
    get: (path) => call(path),
    post: (path, body) => call(path, { method: "POST", body }),
    patch: (path, body) => call(path, { method: "PATCH", body }),
  };
}
