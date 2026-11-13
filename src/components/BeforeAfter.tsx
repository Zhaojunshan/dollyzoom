export function BeforeAfter() {
  return (
    <section id="demo" className="scroll-mt-20 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Before / After
          </h2>
          <p className="mt-2 text-muted">
            One still in, a dolly zoom out. This sample is an original
            illustration made for DollyZoom, not a clip from a film.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-2xl border border-card-border bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/demo/before.jpg"
              width={960}
              height={1200}
              alt="Sample input still: an original illustrated traveler standing in a hallway, before the dolly zoom."
              className="aspect-[4/5] w-full object-cover"
            />
            <figcaption className="border-t border-card-border px-4 py-3 text-sm text-muted">
              Input: 1 still image
            </figcaption>
          </figure>

          <figure className="overflow-hidden rounded-2xl border border-card-border bg-card">
            <video
              controls
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster="/demo/poster.jpg"
              width={960}
              height={1200}
              className="aspect-[4/5] w-full bg-black object-cover"
              aria-label="Sample dolly zoom clip. The traveler stays the same size while the hallway expands."
            >
              <source src="/demo/dolly-zoom.mp4" type="video/mp4" />
              <track
                src="/demo/captions.en.vtt"
                kind="captions"
                srcLang="en"
                label="English"
              />
              Sample dolly zoom clip.
            </video>
            <figcaption className="border-t border-card-border px-4 py-3 text-sm text-muted">
              Output: sample dolly zoom clip
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
