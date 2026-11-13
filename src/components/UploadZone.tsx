"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { CheckoutLink } from "@/components/CheckoutLink";
import { DollyPreview } from "@/components/DollyPreview";
import { ScreeningError, screenGeneration } from "@/lib/screenGeneration";

type GenerateStatus = "idle" | "screening" | "ready" | "error";

function screeningMessage(code: string): string {
  if (code === "prompt_rejected") {
    return "This request was blocked. Sexual, adult, and NSFW content is not allowed.";
  }
  return "Content screening did not succeed, so no preview was created. Please try again.";
}

export function UploadZone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<GenerateStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    requestId.current += 1;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFileName(null);
    setStatus("idle");
    setError(null);
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
      setStatus("idle");
      requestId.current += 1;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
      setFileName(file.name);
    },
    [previewUrl],
  );

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
          </p>
        </div>

        <div className="rounded-2xl border border-card-border bg-card p-5 sm:p-8">
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
                <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-card-border bg-background/80 px-4 py-8 text-center">
                  {status === "idle" && (
                    <p className="text-sm text-muted">
                      Ready. Screening runs before the preview is created.
                    </p>
                  )}
                  {status === "screening" && (
                    <p className="text-sm text-accent-soft animate-pulse">
                      Screening this request…
                    </p>
                  )}
                  {status === "ready" && previewUrl && <DollyPreview src={previewUrl} />}
                  {status === "error" && (
                    <p className="text-sm text-red-400">{error}</p>
                  )}
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
