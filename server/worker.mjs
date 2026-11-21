/**
 * Cloudflare Worker entry for the same proxy as server/index.mjs.
 *
 *   cd server
 *   npx wrangler secret put CREEM_API_KEY
 *   npx wrangler secret put CREEM_WEBHOOK_SECRET
 *   npx wrangler secret put CREEM_SESSION_SECRET
 *   npx wrangler deploy
 *
 * Use a live key from Creem Dashboard → Developers → API Keys.
 * Do not put secret values in wrangler.toml.
 */
import { handleRequest } from "./app.mjs";

const worker = {
  async fetch(request, env) {
    return handleRequest(request, {
      apiKey: env.CREEM_API_KEY || "",
      allowTestKey: env.CREEM_ALLOW_TEST_KEY === "1",
      webhookSecret: env.CREEM_WEBHOOK_SECRET || "",
      sessionSecret: env.CREEM_SESSION_SECRET || "",
      creditCost: env.GENERATION_CREDIT_COST,
      successUrl: env.CREEM_SUCCESS_URL,
    });
  },
};

export default worker;
