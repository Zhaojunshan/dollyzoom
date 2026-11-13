import Link from "next/link";

import { CheckoutLink } from "@/components/CheckoutLink";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pb-10 pt-16 sm:px-6 sm:pt-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.18),_transparent_55%)]"
      />
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-3 py-1 text-xs font-medium text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          AI image → Hitchcock dolly zoom
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
          AI Dolly Zoom Generator
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted sm:text-xl">
          Turn one photo into a Hitchcock vertigo shot in seconds
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/#upload"
            className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-full border border-card-border bg-card px-6 text-base font-medium text-foreground hover:border-zinc-500 transition-colors"
          >
            Upload a photo
          </Link>
          <CheckoutLink className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-full bg-accent px-6 text-base font-semibold text-white shadow-lg shadow-orange-500/20 hover:bg-accent-soft transition-colors">
            Buy HD — $1.49
          </CheckoutLink>
        </div>
        <Link href="/#demo" className="mt-4 inline-block text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
          See before / after
        </Link>
        <p className="mt-3 text-sm text-muted">
          Free watermarked preview · HD unlock $1.49 on Creem checkout
        </p>
      </div>
    </section>
  );
}
