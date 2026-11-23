/**
 * Cloudflare Worker entry for the same proxy as server/index.mjs.
 *
 *   cd server
 *   npx wrangler secret put CREEM_API_KEY
 *   npx wrangler secret put CREEM_WEBHOOK_SECRET
 *   npx wrangler secret put CREEM_SESSION_SECRET
 *   npx wrangler secret put DASHSCOPE_API_KEY
 *   npx wrangler deploy
 *
 * Use a live key from Creem Dashboard → Developers → API Keys.
 * DASHSCOPE_API_KEY is the China (Beijing) Bailian key. Paid HD will not
 * render without it. Do not put secret values in wrangler.toml.
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
      dashscopeApiKey: env.DASHSCOPE_API_KEY || "",
      dashscopeBaseUrl: env.DASHSCOPE_BASE_URL || "",
      dashscopeRegion: env.DASHSCOPE_REGION || "",
      wanResolution: env.WAN_RESOLUTION || "",
      wanDuration: env.WAN_DURATION || "",
      wanAudio: env.WAN_AUDIO || "",
    });
  },
};

export default worker;
