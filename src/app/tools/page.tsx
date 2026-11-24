import type { Metadata } from "next";

import { Disclosure } from "@/components/Disclosure";
import { ToolsApp } from "@/components/ToolsApp";

export const metadata: Metadata = {
  title: "本地工具",
  description: "在浏览器里计算仓位、导入并统计本地交易日记。数据不会因为导入而公开。进阶订阅尚未开放。",
  alternates: { canonical: "/tools/" },
};

export default function ToolsPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">工具</h1>
        <p className="mt-3 text-base leading-7 text-muted">
          这两件工具现在就能在浏览器里用。它们不连接你的交易终端，也不会把结果发布到概览页。
        </p>
      </header>
      <ToolsApp />
      <div className="mt-8">
        <Disclosure />
      </div>
    </main>
  );
}
