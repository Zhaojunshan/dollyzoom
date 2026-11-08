"use client";

import { useCallback, useRef, useState } from "react";

import { mockGenerate } from "@/lib/mockGenerate";

type GenerateStatus = "idle" | "uploading" | "generating" | "done" | "error";

export function UploadZone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<GenerateStatus>("idle");
  const [mockJobId, setMockJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payNote, setPayNote] = useState<string | null>(null);

  const reset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFileName(null);
    setStatus("idle");
    setMockJobId(null);
    setError(null);
    setPayNote(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [previewUrl]);

  const onFile = useCallback((file: File | undefined) => {
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
    setPayNote(null);
    setMockJobId(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name);
    setStatus("idle");
  }, [previewUrl]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      onFile(e.dataTransfer.files?.[0]);
    },
    [onFile],
  );

  const handleGenerate = async () => {
    if (!previewUrl) return;
    setStatus("generating");
    setError(null);
    setPayNote(null);
    try {
      const data = await mockGenerate({
        fileName: fileName ?? "portrait.jpg",
        effect: "dolly_zoom",
      });
      setMockJobId(data.jobId);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const handleBuy = () => {
    // Creem Checkout Link — live charges need Creem account verification + custom domain
    window.open(
      "https://www.creem.io/payment/prod_w9pGaP1bfoaF20iNiGXKt?theme=dark",
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <section id="upload" className="scroll-mt-20 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Upload & generate
          </h2>
          <p className="mt-2 text-muted">
            Local preview only for now. Image-to-video API is mocked.
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
                      Ready to mock-generate a dolly zoom clip.
                    </p>
                  )}
                  {status === "generating" && (
                    <p className="text-sm text-accent-soft animate-pulse">
                      Generating Hitchcock vertigo shot…
                    </p>
                  )}
                  {status === "done" && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-success">
                        Mock job complete
                      </p>
                      <p className="font-mono text-xs text-muted">
                        jobId: {mockJobId}
                      </p>
                      <p className="text-xs text-muted">
                        Watermarked preview placeholder — real I2V (Kling /
                        Seedance) comes next.
                      </p>
                      <div className="mx-auto mt-3 aspect-video w-full max-w-xs rounded-lg bg-gradient-to-br from-zinc-800 via-zinc-700 to-orange-900/40 ring-1 ring-card-border flex items-center justify-center text-xs text-muted">
                        ▶ Preview video (mock)
                      </div>
                    </div>
                  )}
                  {status === "error" && (
                    <p className="text-sm text-red-400">{error}</p>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={status === "generating"}
                    className="h-11 rounded-full bg-accent font-semibold text-white hover:bg-accent-soft disabled:opacity-50 transition-colors"
                  >
                    {status === "generating"
                      ? "Generating…"
                      : status === "done"
                        ? "Regenerate (mock)"
                        : "Generate dolly zoom (mock)"}
                  </button>
                  <button
                    type="button"
                    onClick={handleBuy}
                    className="h-11 rounded-full border border-accent/60 bg-transparent font-semibold text-accent-soft hover:bg-accent/10 transition-colors"
                  >
                    Buy HD — $1.49
                  </button>
                  <p className="text-center text-[11px] text-muted">
                    Opens Creem checkout ($1.49). Live pay needs Creem verification.
                  </p>
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
          {payNote && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-200">
              {payNote}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
