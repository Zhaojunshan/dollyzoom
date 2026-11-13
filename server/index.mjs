/**
 * DollyZoom moderation proxy.
 *
 * Keeps CREEM_API_KEY on the server. The static GitHub Pages site never
 * receives the key. Point public/moderation.json "endpoint" at this
 * server's public URL, for example:
 *   https://<your-host>/v1/generate
 *
 * Create the key in Creem Dashboard → Settings → API Keys.
 * Account review only counts a live key (prefix creem_, not creem_test_)
 * calling https://api.creem.io. Leave CREEM_ALLOW_TEST_KEY unset in production.
 */
import http from "node:http";

import { classifyKey, handleRequest } from "./app.mjs";

import { pathToFileURL } from "node:url";

export function createProxyServer(options = {}) {
  const port = Number(options.port || process.env.PORT || 8787);
  const apiKey = options.apiKey ?? process.env.CREEM_API_KEY ?? "";
  const allowTestKey =
    options.allowTestKey ?? process.env.CREEM_ALLOW_TEST_KEY === "1";

  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const host = req.headers.host || `127.0.0.1:${port}`;
    const url = new URL(req.url || "/", `http://${host}`);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value == null) continue;
      headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
    }
    const method = req.method || "GET";
    const init = { method, headers };
    if (method !== "GET" && method !== "HEAD") init.body = body;
    let response;
    try {
      response = await handleRequest(new Request(url, init), {
        apiKey,
        allowTestKey,
        screenImpl: options.screenImpl,
      });
    } catch {
      response = new Response(
        JSON.stringify({ ok: false, error: "moderation_unavailable" }),
        {
          status: 503,
          headers: { "content-type": "application/json; charset=utf-8" },
        },
      );
    }
    const outHeaders = {};
    response.headers.forEach((value, key) => {
      outHeaders[key] = value;
    });
    res.writeHead(response.status, outHeaders);
    res.end(Buffer.from(await response.arrayBuffer()));
  });

  return server;
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const port = Number(process.env.PORT || 8787);
  const apiKey = process.env.CREEM_API_KEY || "";
  createProxyServer({ port, apiKey }).listen(port, () => {
    // Log the key class only. Never print the key itself.
    console.log(
      `dollyzoom moderation proxy on :${port} (key: ${classifyKey(apiKey)})`,
    );
  });
}
