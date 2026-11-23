"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { CheckoutLink } from "@/components/CheckoutLink";
import { DollyPreview } from "@/components/DollyPreview";
import {
  claimPurchase,
  clearHdJob,
  clearSession,
  fetchWallet,
  loadHdJob,
  loadSession,
  pollPaidGeneration,
  saveHdJob,
  saveSession,
  safeCheckoutUrl,
  startPaidGeneration,
  type HdJob,
  type WalletSnapshot,
} from "@/lib/creditsClient";
import { HD_JOB_TTL_MS, hdPollAction } from "@/lib/hdPoll.mjs";
import { PortraitError, preparePortrait } from "@/lib/preparePortrait";
import { ScreeningError, screenGeneration } from "@/lib/screenGeneration";

type GenerateStatus = "idle" | "screening" | "ready" | "error";

function screeningMessage(code: string): string {
  if (code === "prompt_rejected") {
    return "This request was blocked. Sexual, adult, and NSFW content is not allowed.";
  }
  return "Content screening did not succeed, so no preview was created. Please try again.";
}

function paidMessage(body: { error?: string; refunded?: boolean; transactionId?: string }): string {
  if (body.error === "prompt_rejected") return screeningMessage("prompt_rejected");
  if (body.error === "image_required" || body.error === "image_dimensions") {
    return "Use a JPG, PNG, or WEBP photo, at least 256 pixels on each side, with an aspect ratio between 2:5 and 5:2.";
  }
  if (body.error === "image_too_large") {
    return "That photo is too large. Please use an image under 10 MB.";
  }
  if (body.error === "generation_not_implemented" && body.refunded) {
    return "HD video rendering is not connected yet. The credit debit was reversed, so the wallet balance is unchanged.";
  }
  if (body.error === "generation_failed" && body.refunded) {
    return "HD generation failed. The credit debit was reversed.";
  }
  if (body.error === "refund_pending") {
    const id = body.transactionId ? ` Reference ${body.transactionId}.` : "";
    return `HD generation failed and the credit refund did not complete. Contact support.${id}`;
  }
  if (body.error === "insufficient_credits" || body.error === "credits_needed") {
    return "Generation credits are required. Continuing to the $1.49 checkout.";
  }
  if (body.error === "credits_unavailable") {
    return "The HD request did not finish. Refresh this page. If a credit was used and no video appears, contact support.";
  }
  return "The credit check or content screening did not succeed, so nothing was generated.";
}

function waitWhile(ms: number, isCurrent: () => boolean): Promise<boolean> {
  if (ms <= 0) return Promise.resolve(isCurrent());
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (!isCurrent() || Date.now() - started >= ms) {
        clearInterval(timer);
        resolve(isCurrent());
      }
    }, 200);
  });
}

const HD_READY = "Your HD dolly zoom is ready. The link expires, so open or save the video if you want to keep it.";

function HdVideo({
  src,
  poster,
  frame,
}: {
  src: string;
  poster?: string | null;
  frame: { width: number; height: number } | null;
}) {
  return (
    <div className="w-full">
      <video
        src={src}
        poster={poster || undefined}
        controls
        playsInline
        preload="metadata"
        style={frame ? { aspectRatio: `${frame.width} / ${frame.height}` } : { aspectRatio: "3 / 4" }}
        className="w-full rounded-lg bg-black ring-1 ring-card-border"
        data-hd-video="1"
      >
        Your HD dolly zoom
      </video>
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-xs text-accent-soft underline-offset-2 hover:underline"
      >
        Open video
      </a>
    </div>
  );
}

export function UploadZone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const fileRef = useRef<File | null>(null);
  const hdRun = useRef(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<GenerateStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [walletLabel, setWalletLabel] = useState("Checking generation wallet…");
  const [paidNote, setPaidNote] = useState<string | null>(null);
  const [paidBusy, setPaidBusy] = useState(false);
  const [hdStatus, setHdStatus] = useState<"idle" | "starting" | "rendering" | "ready" | "error">("idle");
  const [hdVideoUrl, setHdVideoUrl] = useState<string | null>(null);
  const [hdFrame, setHdFrame] = useState<{ width: number; height: number } | null>(null);
  const paidLock = useRef(false);

  const rememberWallet = useCallback(async (session: string) => {
    if (!session) return;
    try {
      const next = await fetchWallet(session);
      saveSession(next.session);
      setWallet(next);
      setWalletLabel(`${next.balance} credits`);
    } catch {
      // The video state still updates. Balance refresh is best-effort.
    }
  }, []);

  const watchTicket = useCallback(
    async (session: string, job: HdJob, isCurrent: () => boolean) => {
      const deadline = Math.min(Date.now() + 30 * 60 * 1000, job.startedAt + HD_JOB_TTL_MS);
      let waitMs = job.videoUrl ? 0 : 5000;
      while (isCurrent() && Date.now() < deadline) {
        const keepGoing = await waitWhile(waitMs, isCurrent);
        if (!keepGoing) return;
        waitMs = 8000;
        const poll = await pollPaidGeneration(session, job.ticket);
        if (!isCurrent()) return;
        const decision = hdPollAction(poll);
        if (decision.action === "ready" && decision.videoUrl) {
          setHdVideoUrl(decision.videoUrl);
          setHdStatus("ready");
          setPaidNote(HD_READY);
          saveHdJob({ ...job, videoUrl: decision.videoUrl });
          await rememberWallet(session);
          return;
        }
        if (decision.action === "stop") {
          clearHdJob();
          setHdVideoUrl(null);
          setHdStatus("error");
          setPaidNote(paidMessage(poll));
          if (poll.refunded || poll.error === "refund_pending") await rememberWallet(session);
          return;
        }
      }
      if (isCurrent()) {
        setHdStatus("rendering");
        setPaidNote(
          "HD rendering is still going. Reopen this site in this browser and it will keep checking. A credit is returned only if rendering fails.",
        );
      }
    },
    [rememberWallet],
  );

  const reset = useCallback(() => {
    requestId.current += 1;
    hdRun.current += 1;
    paidLock.current = false;
    fileRef.current = null;
    clearHdJob();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFileName(null);
    setStatus("idle");
    setError(null);
    setPaidNote(null);
    setPaidBusy(false);
    setHdStatus("idle");
    setHdVideoUrl(null);
    setHdFrame(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [previewUrl]);

  const onFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image (JPG, PNG, or WEBP).");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("Max file size is 10 MB.");
        return;
      }
      setError(null);
      setPaidNote(null);
      setStatus("idle");
      fileRef.current = file;
      requestId.current += 1;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
      setFileName(file.name);
    },
    [previewUrl],
  );

  useEffect(() => {
    let cancel = false;
    const apply = (next: WalletSnapshot) => {
      if (cancel) return;
      saveSession(next.session);
      setWallet(next);
      setWalletLabel(`${next.balance} credits`);
    };
    const needed = () => {
      if (cancel) return;
      setWallet(null);
      setWalletLabel("credits needed");
    };
    (async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.has("signature") && params.has("customer_id") && params.has("product_id")) {
        try {
          const next = await claimPurchase(window.location.search);
          apply(next);
          const url = new URL(window.location.href);
          for (const key of [
            "checkout_id",
            "order_id",
            "customer_id",
            "subscription_id",
            "product_id",
            "request_id",
            "signature",
          ]) {
            url.searchParams.delete(key);
          }
          window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
          return;
        } catch (err) {
          if (cancel) return;
          const code = err instanceof Error ? err.message : "";
          setWallet(null);
          setWalletLabel("credits needed");
          setPaidNote(
            code === "payment_not_verified"
              ? "This return link could not be verified, so no wallet was opened."
              : "The generation wallet could not be opened from this return link.",
          );
          return;
        }
      }
      const session = loadSession();
      if (!session) {
        needed();
        return;
      }
      try {
        apply(await fetchWallet(session));
      } catch (err) {
        if (cancel) return;
        if (err instanceof Error && err.message === "credits_needed") {
          clearSession();
          needed();
          return;
        }
        setWalletLabel("wallet unavailable");
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    const job = loadHdJob();
    if (!job) return;
    const run = ++hdRun.current;
    let stopped = false;
    const locked = !job.videoUrl;
    if (locked) paidLock.current = true;
    const session = loadSession();
    const timer = setTimeout(() => {
      if (stopped || run !== hdRun.current) return;
      if (job.videoUrl) {
        setHdVideoUrl(job.videoUrl);
        setHdStatus("ready");
        setPaidNote(HD_READY);
      } else if (session) {
        setPaidBusy(true);
        setHdStatus("rendering");
        setPaidNote("Checking your HD dolly zoom…");
      }
      if (!session) {
        if (locked) paidLock.current = false;
        return;
      }
      watchTicket(session, job, () => !stopped && run === hdRun.current).finally(() => {
        if (locked && !stopped && run === hdRun.current) {
          paidLock.current = false;
          setPaidBusy(false);
        }
      });
    }, 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
      if (locked && run === hdRun.current) paidLock.current = false;
    };
  }, [watchTicket]);

  const refreshWallet = useCallback(async () => {
    const session = wallet?.session || loadSession();
    if (!session) {
      setWallet(null);
      setWalletLabel("credits needed");
      return;
    }
    try {
      const next = await fetchWallet(session);
      saveSession(next.session);
      setWallet(next);
      setWalletLabel(`${next.balance} credits`);
    } catch (err) {
      if (err instanceof Error && err.message === "credits_needed") {
        clearSession();
        setWallet(null);
        setWalletLabel("credits needed");
        return;
      }
      setWalletLabel("wallet unavailable");
    }
  }, [wallet?.session]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      onFile(e.dataTransfer.files?.[0]);
    },
    [onFile],
  );

  const handleGenerate = async () => {
    if (!previewUrl || status === "screening") return;
    const id = ++requestId.current;
    setStatus("screening");
    setError(null);
    try {
      const result = await screenGeneration();
      if (id !== requestId.current) return;
      if (!result.moderationId) {
        throw new ScreeningError("moderation_unavailable");
      }
      setStatus("ready");
    } catch (err) {
      if (id !== requestId.current) return;
      setStatus("error");
      const code = err instanceof ScreeningError ? err.code : "moderation_unavailable";
      setError(screeningMessage(code));
    }
  };

  const handlePaid = async () => {
    if (!previewUrl || !fileRef.current || paidLock.current) return;
    const run = ++hdRun.current;
    paidLock.current = true;
    setPaidBusy(true);
    setPaidNote(null);
    setHdVideoUrl(null);
    setHdStatus("starting");
    const generationId = `gen_${crypto.randomUUID()}`;
    const session = wallet?.session || loadSession();
    try {
      const prepared = await preparePortrait(fileRef.current);
      if (run !== hdRun.current) return;
      setHdFrame({ width: prepared.width, height: prepared.height });
      const result = await startPaidGeneration(session, generationId, prepared.dataUrl);
      if (run !== hdRun.current) return;
      if (result.error === "insufficient_credits" || result.error === "credits_needed") {
        setPaidNote(paidMessage(result));
        setHdStatus("error");
        window.location.assign(safeCheckoutUrl(result.checkoutUrl));
        return;
      }
      if (!result.ok) {
        setPaidNote(paidMessage(result));
        setHdStatus("error");
        if (result.refunded || result.error === "refund_pending") await rememberWallet(session);
        return;
      }
      const immediate = hdPollAction(result);
      if (immediate.action === "ready" && immediate.videoUrl) {
        setHdVideoUrl(immediate.videoUrl);
        setHdStatus("ready");
        setPaidNote(HD_READY);
        clearHdJob();
        await rememberWallet(session);
        return;
      }
      const ticket = result.generation?.ticket;
      if (!ticket) {
        setPaidNote("HD rendering did not return a status link. Contact support if a credit was used.");
        setHdStatus("error");
        return;
      }
      const job: HdJob = { ticket, startedAt: Date.now() };
      saveHdJob(job);
      setHdStatus("rendering");
      setPaidNote(
        "Rendering your HD dolly zoom. This usually takes a few minutes. You can leave and come back in this browser.",
      );
      await rememberWallet(session);
      await watchTicket(session, job, () => run === hdRun.current);
    } catch (err) {
      if (run !== hdRun.current) return;
      const code = err instanceof PortraitError ? err.code : "image_required";
      setPaidNote(paidMessage({ error: code }));
      setHdStatus("error");
    } finally {
      if (run === hdRun.current) {
        paidLock.current = false;
        setPaidBusy(false);
      }
    }
  };

  return (
    <section id="upload" className="scroll-mt-20 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Upload & generate
          </h2>
          <p className="mt-2 text-muted">
            The sample above is a finished example. A watermarked preview of
            your photo is created in this browser only after content screening.
            That preview does not spend generation credits. Generate HD uploads
            the photo and renders a short 768P video.
          </p>
        </div>

        <div className="rounded-2xl border border-card-border bg-card p-5 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p data-wallet="balance">
              Generation wallet: <span className="font-medium text-foreground">{walletLabel}</span>
              {wallet ? ` · HD uses ${wallet.cost} ${wallet.cost === "1" ? "credit" : "credits"}` : ""}
            </p>
            <button
              type="button"
              onClick={refreshWallet}
              className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
            >
              Refresh balance
            </button>
            {paidNote && (
              <p className="w-full text-xs text-muted" data-paid-note="1">
                {paidNote}
              </p>
            )}
          </div>
          {!previewUrl && (hdVideoUrl || hdStatus === "rendering" || hdStatus === "starting") && (
            <div className="mb-5" data-hd-status={hdStatus}>
              {hdVideoUrl ? (
                <HdVideo src={hdVideoUrl} frame={hdFrame} />
              ) : (
                <p className="text-center text-sm text-accent-soft animate-pulse">
                  Rendering the HD dolly zoom…
                </p>
              )}
            </div>
          )}
          {!previewUrl ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-600 bg-background/60 px-6 py-16 text-center transition-colors hover:border-accent hover:bg-background"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 3v12" />
                  <path d="m17 8-5-5-5 5" />
                  <path d="M5 21h14" />
                </svg>
              </div>
              <p className="text-base font-medium">Drop a portrait here</p>
              <p className="mt-1 text-sm text-muted">
                or click to browse · JPG / PNG / WEBP · max 10 MB
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                  Your photo
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Upload preview"
                  className="aspect-[3/4] w-full rounded-xl object-cover ring-1 ring-card-border"
                />
                <p className="mt-2 truncate text-xs text-muted">{fileName}</p>
              </div>

              <div className="flex flex-col">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                  Output
                </p>
                <div
                  className="flex flex-1 flex-col items-center justify-center rounded-xl border border-card-border bg-background/80 px-4 py-8 text-center"
                  data-hd-status={hdStatus}
                >
                  {status === "error" && <p className="mb-3 text-sm text-red-400">{error}</p>}
                  {hdVideoUrl ? (
                    <HdVideo src={hdVideoUrl} poster={previewUrl} frame={hdFrame} />
                  ) : hdStatus === "starting" || hdStatus === "rendering" ? (
                    <p className="text-sm text-accent-soft animate-pulse">Rendering the HD dolly zoom…</p>
                  ) : status === "idle" ? (
                    <p className="text-sm text-muted">
                      Ready. Screening runs before the preview is created.
                    </p>
                  ) : status === "screening" ? (
                    <p className="text-sm text-accent-soft animate-pulse">
                      Screening this request…
                    </p>
                  ) : status === "ready" && previewUrl ? (
                    <DollyPreview src={previewUrl} />
                  ) : null}
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={status === "screening"}
                    className="h-11 rounded-full bg-accent font-semibold text-white hover:bg-accent-soft disabled:opacity-50 transition-colors"
                  >
                    {status === "screening"
                      ? "Screening…"
                      : status === "ready"
                        ? "Screen and preview again"
                        : "Generate dolly zoom preview"}
                  </button>
                  <button
                    type="button"
                    onClick={handlePaid}
                    disabled={paidBusy || status === "screening" || hdStatus === "starting" || hdStatus === "rendering"}
                    data-generate="hd"
                    className="h-11 rounded-full border border-accent/60 font-semibold text-accent-soft hover:bg-accent/10 disabled:opacity-50 transition-colors"
                  >
                    {hdStatus === "rendering"
                      ? "Rendering HD…"
                      : hdStatus === "starting" || paidBusy
                        ? "Starting HD…"
                        : "Generate HD"}
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Clear & upload another
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && status !== "error" && (
            <p className="mt-3 text-center text-sm text-red-400">{error}</p>
          )}

          <div className="mt-6 flex flex-col items-center gap-2 border-t border-card-border pt-6">
            <CheckoutLink className="inline-flex h-11 w-full items-center justify-center rounded-full border border-accent/60 bg-transparent font-semibold text-accent-soft hover:bg-accent/10 transition-colors sm:w-auto sm:min-w-64">
              Buy HD — $1.49
            </CheckoutLink>
            <p className="text-center text-[11px] text-muted">
              Continues to Creem checkout in this tab ($1.49).
            </p>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          Sexual, adult, and NSFW content is prohibited. See the{" "}
          <Link href="/acceptable-use/" className="underline underline-offset-2 hover:text-foreground">
            Acceptable Use Policy
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
