import Link from "next/link";

import { SITE_NAME } from "@/lib/site";

const links = [
  { href: "/#records", label: "Overview" },
  { href: "/tools/", label: "Tools" },
  { href: "/guide/", label: "Notes" },
  { href: "/pricing/", label: "Pricing" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-card-border bg-[#070d18]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-card-border bg-card font-mono text-[11px] text-accent">
            TJ
          </span>
          <span className="text-sm font-semibold tracking-wide">{SITE_NAME}</span>
        </Link>
        <nav aria-label="Pages" className="flex flex-wrap items-center gap-1 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 rounded-md px-2 py-1.5 text-foreground hover:bg-accent-soft sm:px-2.5"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
