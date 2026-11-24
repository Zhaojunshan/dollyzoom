import Link from "next/link";

import { SITE_NAME, SITE_NAME_EN } from "@/lib/site";

const links = [
  { href: "/", label: "概览" },
  { href: "/tools/", label: "工具" },
  { href: "/pricing/", label: "价格" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-card-border bg-card/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="min-w-0 leading-tight">
          <span className="block text-base font-semibold tracking-wide">{SITE_NAME}</span>
          <span className="block text-[11px] text-muted">{SITE_NAME_EN}</span>
        </Link>
        <nav aria-label="页面" className="flex items-center gap-1 text-sm sm:gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-2.5 py-1.5 text-foreground hover:bg-accent-soft sm:px-3"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
