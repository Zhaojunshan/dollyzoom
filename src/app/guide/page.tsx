import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "说明",
  description: "仓位计算、回撤与收益、MT5 已平仓日记的说明。不提供当前行情，也不承诺收益。",
  keywords: ["仓位计算说明", "回撤", "MT5 已平仓日记"],
  alternates: { canonical: "/guide/" },
};

const articles = [
  {
    href: "/guide/position-size/",
    title: "仓位和 tick",
    text: "风险金额、手数步长，以及为什么 XAUUSD 不能用外汇点值。",
  },
  {
    href: "/guide/drawdown/",
    title: "回撤和收益",
    text: "已实现盈亏回撤、权益回撤和修正迪茨收益率分别在什么前提下才出现。",
  },
  {
    href: "/guide/mt5-journal/",
    title: "MT5 日记",
    text: "成交、部分平仓和未平仓怎样进入或排除公开表。",
  },
];

export default function GuideIndexPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-xs font-medium tracking-[0.16em] text-accent">NOTES</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">说明</h1>
      <p className="mt-3 text-sm leading-7 text-muted">
        这些页面解释本站实际在算的东西。它们不引用实时报价，也不把示例数据说成市场结论。
      </p>
      <div className="mt-6 grid gap-3">
        {articles.map((article) => (
          <Link key={article.href} href={article.href} className="panel block px-4 py-4 hover:bg-accent-soft">
            <h2 className="font-semibold">{article.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{article.text}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
