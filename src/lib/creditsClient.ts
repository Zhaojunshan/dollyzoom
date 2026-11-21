import { CHECKOUT_URL } from "@/lib/site";
import { loadModerationEndpoint, workerOrigin } from "@/lib/screenGeneration";

export const SESSION_KEY = "dollyzoom.creem.session";

const SESSION_TOKEN = /^[A-Za-z0-9_-]+\.[0-9a-fA-F]+$/;

export type WalletSnapshot = {
  balance: string;
  cost: string;
  session: string;
};

export type PaidResponse = {
  ok: boolean;
  error?: string;
  checkoutUrl?: string;
  balance?: string;
  cost?: string;
  refunded?: boolean;
  moderationId?: string;
  transactionId?: string;
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

export async function startPaidGeneration(session: string, generationId: string): Promise<PaidResponse> {
  const origin = await proxyOrigin();
  if (!origin) return { ok: false, error: "credits_unavailable" };
  try {
    const response = await fetch(`${origin}/v1/generations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(session ? { authorization: `Bearer ${session}` } : {}),
      },
      body: JSON.stringify({ effect: "dolly_zoom", generationId }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = await readJson(response);
    return { ...body, ok: response.ok && body.ok === true };
  } catch {
    return { ok: false, error: "credits_unavailable" };
  }
}
