import Link from "next/link";

import { OPERATOR_NAME, SITE_NAME, SITE_URL, SUPPORT_EMAIL } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-card-border px-4 py-10 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-8 text-sm sm:grid-cols-3">
        <div className="space-y-2">
          <p className="font-medium">{SITE_NAME}</p>
          <p className="text-muted">
            由 {OPERATOR_NAME} 维护的公开记录页和本地计算工具。不是经纪商，也不提供下单、跟单或收益保证。
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-medium">说明</p>
          <p className="text-muted">
            站点地址 <a href={SITE_URL}>{SITE_URL.replace("https://", "")}</a>
            。通信只使用邮箱，本站没有留言表单。
          </p>
          <a className="inline-block font-medium underline decoration-accent/50 underline-offset-4" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
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
      <p className="mx-auto mt-8 max-w-6xl text-sm text-muted">© 2026 {SITE_NAME}. 过往记录不代表未来结果。</p>
    </footer>
  );
}
