import Link from "next/link";

import { SUPPORT_EMAIL } from "@/lib/site";

export function Footer() {
  return (
    <footer id="support" className="mt-auto border-t border-card-border px-4 py-10 sm:px-6">
      <div className="mx-auto grid max-w-5xl gap-8 text-sm sm:grid-cols-3">
        <div className="space-y-2">
          <p className="font-medium text-foreground">DollyZoom</p>
          <p className="text-muted">
            Operated by junshan zhao. DollyZoom is an independent product and is
            not affiliated with third-party AI model providers.
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-medium text-foreground">Support</p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-block text-base font-medium text-foreground underline decoration-accent/60 underline-offset-4 hover:text-accent-soft"
          >
            {SUPPORT_EMAIL}
          </a>
          <p className="text-muted">We read this address for product and billing help.</p>
        </div>
        <nav className="flex flex-col gap-2">
          <Link href="/terms/" className="text-foreground hover:text-accent-soft">
            Terms of Service
          </Link>
          <Link href="/privacy/" className="text-foreground hover:text-accent-soft">
            Privacy Policy
          </Link>
          <Link href="/acceptable-use/" className="text-foreground hover:text-accent-soft">
            Acceptable Use
          </Link>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-5xl text-sm text-muted">
        Sexual, adult, and NSFW generation is prohibited. © 2026 DollyZoom.
      </p>
    </footer>
  );
}
