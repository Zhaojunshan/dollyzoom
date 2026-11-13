/**
 * Cloudflare Worker entry for the same proxy as server/index.mjs.
 *
 *   cd server
 *   npx wrangler secret put CREEM_API_KEY
 *   npx wrangler deploy
 *
 * Use a live key from Creem Dashboard → Settings → API Keys.
 */
import { handleRequest } from "./app.mjs";

const worker = {
  async fetch(request, env) {
    return handleRequest(request, {
      apiKey: env.CREEM_API_KEY || "",
      allowTestKey: env.CREEM_ALLOW_TEST_KEY === "1",
    });
  },
};

export default worker;
