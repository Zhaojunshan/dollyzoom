import Link from "next/link";

const links = [
  { href: "/guide/position-size/", label: "仓位和 tick" },
  { href: "/guide/drawdown/", label: "回撤和收益" },
  { href: "/guide/mt5-journal/", label: "MT5 日记" },
];

export function GuideArticle({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-xs font-medium tracking-[0.16em] text-accent">{kicker}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-6 space-y-4 text-sm leading-7 text-foreground [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4 [&_h2]:pt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
      <nav aria-label="相关说明" className="mt-8 flex flex-wrap gap-2 text-sm">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="rounded-full border border-card-border px-3 py-1.5 hover:bg-accent-soft">
            {link.label}
          </Link>
        ))}
        <Link href="/tools/#size" className="rounded-full border border-card-border px-3 py-1.5 hover:bg-accent-soft">
          免费使用仓位计算
        </Link>
        <Link href="/pricing/" className="rounded-full border border-card-border px-3 py-1.5 hover:bg-accent-soft">
          价格
        </Link>
      </nav>
    </main>
  );
}
