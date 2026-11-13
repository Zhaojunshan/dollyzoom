"use client";

/**
 * Watermarked in-browser dolly zoom. Mount this only after moderation allows
 * the generation. The background scales; the center of the photo stays put.
 */
export function DollyPreview({ src }: { src: string }) {
  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-black ring-1 ring-card-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="dolly-bg absolute inset-0 h-full w-full object-cover"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Watermarked dolly zoom preview of your photo"
        className="absolute inset-0 h-full w-full object-cover [clip-path:ellipse(32%_38%_at_50%_42%)]"
      />
      <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90 drop-shadow">
        DollyZoom preview
      </p>
    </div>
  );
}
