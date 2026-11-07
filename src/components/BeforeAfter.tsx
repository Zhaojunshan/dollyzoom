export function BeforeAfter() {
  return (
    <section id="demo" className="scroll-mt-20 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Before / After
          </h2>
          <p className="mt-2 text-muted">
            Still photo in → cinematic dolly zoom out. Replace placeholders with
            real samples once the I2V prompt is locked.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-2xl border border-card-border bg-card">
            <div className="relative aspect-[4/5] bg-gradient-to-b from-zinc-800 to-zinc-950 flex items-center justify-center">
              <div className="absolute inset-6 rounded-xl border border-dashed border-zinc-600 flex flex-col items-center justify-center gap-2 text-muted">
                <span className="text-3xl opacity-40">📷</span>
                <span className="text-sm font-medium">Before</span>
                <span className="px-4 text-center text-xs">
                  Single portrait photo placeholder
                </span>
              </div>
            </div>
            <figcaption className="border-t border-card-border px-4 py-3 text-sm text-muted">
              Input: 1 still image
            </figcaption>
          </figure>

          <figure className="overflow-hidden rounded-2xl border border-card-border bg-card">
            <div className="relative aspect-[4/5] bg-gradient-to-br from-orange-950/80 via-zinc-900 to-zinc-950 flex items-center justify-center">
              <div className="absolute inset-6 rounded-xl border border-dashed border-orange-500/40 flex flex-col items-center justify-center gap-2 text-orange-100/80">
                <span className="text-3xl opacity-50">🎬</span>
                <span className="text-sm font-medium text-accent-soft">
                  After · Dolly Zoom
                </span>
                <span className="px-4 text-center text-xs text-muted">
                  Hitchcock vertigo short video placeholder
                </span>
                <span className="mt-2 rounded-full bg-accent/20 px-3 py-1 text-[10px] uppercase tracking-wider text-accent-soft">
                  ▶ Sample clip TBD
                </span>
              </div>
            </div>
            <figcaption className="border-t border-card-border px-4 py-3 text-sm text-muted">
              Output: ~3–5s HD dolly zoom clip
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
