import Link from "next/link";

import { SITE_NAME, SITE_NAME_EN } from "@/lib/site";

const links = [
  { href: "/#records", label: "概览" },
  { href: "/tools/", label: "工具" },
  { href: "/guide/", label: "说明" },
  { href: "/pricing/", label: "价格" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-card-border bg-[#070d18]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md border border-card-border bg-card font-mono text-[11px] text-accent">
            TJ
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-wide">{SITE_NAME}</span>
            <span className="block text-[10px] uppercase tracking-[0.14em] text-muted">{SITE_NAME_EN}</span>
          </span>
        </Link>
        <nav aria-label="页面" className="flex items-center gap-1 overflow-x-auto text-sm">
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
