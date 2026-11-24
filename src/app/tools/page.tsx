import type { Metadata } from "next";

import { Disclosure } from "@/components/Disclosure";
import { ToolsApp } from "@/components/ToolsApp";

export const metadata: Metadata = {
  title: "Tools",
  description:
    "Size a position and import a local trade journal in the browser. An import is not published. The planned subscription is not open.",
  keywords: ["position size calculator", "trade journal CSV", "tick value", "fee drag"],
  alternates: { canonical: "/tools/" },
};

export default function ToolsPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="max-w-3xl">
        <p className="text-xs font-medium tracking-[0.16em] text-accent">FREE · LOCAL · NO ORDERS</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Tools</h1>
        <p className="mt-3 text-base leading-7 text-muted">
          Both tools run in the browser now. They do not connect to a terminal, and they do not publish a result to the overview.
        </p>
      </header>
      <ToolsApp />
      <div className="mt-8">
        <Disclosure />
      </div>
    </main>
  );
}
