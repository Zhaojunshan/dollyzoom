import Link from "next/link";

import { SITE_NAME, SITE_URL } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-card-border px-4 py-8 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-6 text-sm sm:grid-cols-3">
        <div className="space-y-2">
          <p className="font-medium">{SITE_NAME}</p>
          <p className="text-muted">已平仓记录和浏览器里的计算工具。不是经纪商，不提供信号、跟单或收益保证。</p>
        </div>
        <div className="space-y-2">
          <p className="font-medium">开始使用</p>
          <Link href="/#records" className="block hover:text-accent">
            查看平仓记录
          </Link>
          <Link href="/tools/#size" className="block hover:text-accent">
            免费使用仓位计算
          </Link>
          <Link href="/guide/" className="block hover:text-accent">
            阅读说明
          </Link>
        </div>
        <nav aria-label="政策" className="flex flex-col gap-2">
          <Link href="/pricing/" className="hover:text-accent">
            价格与尚未开放的订阅
          </Link>
          <Link href="/terms/" className="hover:text-accent">
            使用条款
          </Link>
          <Link href="/privacy/" className="hover:text-accent">
            隐私说明
          </Link>
          <Link href="/acceptable-use/" className="hover:text-accent">
            可接受使用
          </Link>
        </nav>
      </div>
      <p className="mx-auto mt-6 max-w-6xl text-xs text-muted">
        {SITE_URL.replace("https://", "")} · © 2026 {SITE_NAME}. 本站没有联系表单。过往记录不代表未来结果。
      </p>
    </footer>
  );
}
