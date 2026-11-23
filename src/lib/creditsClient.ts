import { validHdJob } from "@/lib/hdPoll.mjs";
import { CHECKOUT_URL } from "@/lib/site";
import { loadModerationEndpoint, workerOrigin } from "@/lib/screenGeneration";

export const SESSION_KEY = "dollyzoom.creem.session";
export const HD_JOB_KEY = "dollyzoom.hd.job";

const SESSION_TOKEN = /^[A-Za-z0-9_-]+\.[0-9a-fA-F]+$/;

export type WalletSnapshot = {
  balance: string;
  cost: string;
  session: string;
};

export type PaidGeneration = {
  status?: string;
  taskId?: string;
  ticket?: string;
  videoUrl?: string;
  resolution?: string;
  duration?: number;
};

export type PaidResponse = {
  ok: boolean;
  error?: string;
  status?: string;
  checkoutUrl?: string;
  balance?: string;
  cost?: string;
  refunded?: boolean;
  moderationId?: string;
  transactionId?: string;
  generation?: PaidGeneration;
};

export type HdJob = {
  ticket: string;
  startedAt: number;
  videoUrl?: string;
};

export function loadSession(): string {
  try {
    const value = localStorage.getItem(SESSION_KEY) || "";
    return SESSION_TOKEN.test(value) ? value : "";
  } catch {
    return "";
  }
}

export function saveSession(session: string): void {
  if (!SESSION_TOKEN.test(session)) return;
  try {
    localStorage.setItem(SESSION_KEY, session);
  } catch {
    // Private mode can reject storage. The in-memory return value still works for this page.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function loadHdJob(): HdJob | null {
  try {
    const raw = localStorage.getItem(HD_JOB_KEY);
    if (!raw) return null;
    const job = validHdJob(JSON.parse(raw)) as HdJob | null;
    if (!job) localStorage.removeItem(HD_JOB_KEY);
    return job;
  } catch {
    return null;
  }
}

export function saveHdJob(job: HdJob): void {
  const valid = validHdJob(job);
  if (!valid) return;
  try {
    localStorage.setItem(HD_JOB_KEY, JSON.stringify(valid));
  } catch {
    // Private mode can reject storage. Polling still works for this page view.
  }
}

export function clearHdJob(): void {
  try {
    localStorage.removeItem(HD_JOB_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function safeCheckoutUrl(value: unknown): string {
  if (typeof value !== "string") return CHECKOUT_URL;
  try {
    const url = new URL(value);
    const hostOk =
      url.protocol === "https:" &&
      (url.hostname === "www.creem.io" ||
        url.hostname === "creem.io" ||
        url.hostname === "checkout.creem.io");
    if (!hostOk || url.username || url.password) return CHECKOUT_URL;
    return url.toString();
  } catch {
    return CHECKOUT_URL;
  }
}

async function proxyOrigin(): Promise<string> {
  const endpoint = await loadModerationEndpoint();
  return endpoint ? workerOrigin(endpoint) : "";
}

async function readJson(response: Response): Promise<PaidResponse & WalletSnapshot & { externalId?: string }> {
  try {
    return (await response.json()) as PaidResponse & WalletSnapshot;
  } catch {
    return { ok: false, error: "credits_unavailable", balance: "", cost: "", session: "" };
  }
}

export async function claimPurchase(query: string): Promise<WalletSnapshot> {
  const origin = await proxyOrigin();
  if (!origin) throw new Error("credits_unavailable");
  const response = await fetch(`${origin}/v1/credits/claim`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await readJson(response);
  if (!response.ok || !body.session || typeof body.balance !== "string") {
    throw new Error(body.error || "credits_unavailable");
  }
  return { balance: body.balance, cost: body.cost || "1", session: body.session };
}

export async function fetchWallet(session: string): Promise<WalletSnapshot> {
  const origin = await proxyOrigin();
  if (!origin) throw new Error("credits_unavailable");
  const response = await fetch(`${origin}/v1/credits`, {
    headers: { authorization: `Bearer ${session}` },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  const body = await readJson(response);
  if (response.status === 401) {
    const error = new Error("credits_needed");
    throw error;
  }
  if (!response.ok || typeof body.balance !== "string") {
    throw new Error(body.error || "credits_unavailable");
  }
  return {
    balance: body.balance,
    cost: body.cost || "1",
    session: body.session || session,
  };
}

export async function startPaidGeneration(
  session: string,
  generationId: string,
  image: string,
): Promise<PaidResponse> {
  const origin = await proxyOrigin();
  if (!origin) return { ok: false, error: "credits_unavailable" };
  try {
    const response = await fetch(`${origin}/v1/generations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(session ? { authorization: `Bearer ${session}` } : {}),
      },
      body: JSON.stringify({ effect: "dolly_zoom", generationId, image }),
      signal: AbortSignal.timeout(90_000),
    });
    const body = await readJson(response);
    return { ...body, ok: response.ok && body.ok === true };
  } catch {
    return { ok: false, error: "credits_unavailable" };
  }
}

/** Ask the worker whether a paid Wan task has a video yet. */
export async function pollPaidGeneration(session: string, ticket: string): Promise<PaidResponse> {
  const origin = await proxyOrigin();
  if (!origin) return { ok: false, error: "credits_unavailable" };
  try {
    const response = await fetch(`${origin}/v1/generations/status`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(session ? { authorization: `Bearer ${session}` } : {}),
      },
      body: JSON.stringify({ ticket }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = await readJson(response);
    return { ...body, ok: response.ok && body.ok === true };
  } catch {
    return { ok: false, error: "generation_pending" };
  }
}

export type TestGrantResult = WalletSnapshot & {
  granted: boolean;
  capped: boolean;
};

/** True only when the Worker health payload sets testGrant to boolean true. */
export async function fetchTestGrantEnabled(): Promise<boolean> {
  const origin = await proxyOrigin();
  if (!origin) return false;
  try {
    const response = await fetch(`${origin}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { testGrant?: unknown };
    return body.testGrant === true;
  } catch {
    return false;
  }
}

/** Ask the Worker for the temporary 2-credit grant and a browser session. */
export async function claimTestGrant(): Promise<TestGrantResult> {
  const origin = await proxyOrigin();
  if (!origin) throw new Error("credits_unavailable");
  const response = await fetch(`${origin}/v1/credits/test-grant`, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const body = await readJson(response);
  const capped = response.status === 429 && body.error === "test_grant_cap";
  if ((response.ok || capped) && body.session && typeof body.balance === "string") {
    return {
      balance: body.balance,
      cost: body.cost || "1",
      session: body.session,
      granted: body.ok === true && (body as { granted?: unknown }).granted === true,
      capped,
    };
  }
  throw new Error(body.error || "credits_unavailable");
}

/** Same-origin download. The Worker re-checks the task and attaches the mp4. */
export async function hdDownloadUrl(ticket: string): Promise<string> {
  const origin = await proxyOrigin();
  if (!origin || !ticket) return "";
  const url = new URL(`${origin}/v1/generations/file`);
  url.searchParams.set("ticket", ticket);
  return url.toString();
}
