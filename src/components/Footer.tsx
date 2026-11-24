import Link from "next/link";

import { SITE_NAME, SITE_URL } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-card-border px-4 py-8 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-6 text-sm sm:grid-cols-3">
        <div className="space-y-2">
          <p className="font-medium">{SITE_NAME}</p>
          <p className="text-muted">Closed-trade records and browser calculators. Not a broker. No signals, copy trading, or profit promise.</p>
        </div>
        <div className="space-y-2">
          <p className="font-medium">Start</p>
          <Link href="/#records" className="block hover:text-accent">
            View closed trades
          </Link>
          <Link href="/tools/#size" className="block hover:text-accent">
            Use the free position calculator
          </Link>
          <Link href="/guide/" className="block hover:text-accent">
            Read the notes
          </Link>
        </div>
        <nav aria-label="Policies" className="flex flex-col gap-2">
          <Link href="/pricing/" className="hover:text-accent">
            Pricing and the closed subscription
          </Link>
          <Link href="/terms/" className="hover:text-accent">
            Terms
          </Link>
          <Link href="/privacy/" className="hover:text-accent">
            Privacy
          </Link>
          <Link href="/acceptable-use/" className="hover:text-accent">
            Acceptable use
          </Link>
        </nav>
      </div>
      <p className="mx-auto mt-6 max-w-6xl text-xs text-muted">
        {SITE_URL.replace("https://", "")} · © 2026 {SITE_NAME}. No contact form. Past records are not future results.
      </p>
    </footer>
  );
}
