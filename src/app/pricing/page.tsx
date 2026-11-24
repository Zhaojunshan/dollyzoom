import type { Metadata } from "next";
import Link from "next/link";

import { Disclosure } from "@/components/Disclosure";
import { PLANNED_MONTHLY_USD } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "The closed-trade overview, position calculator, and local journal are free. A planned analytics subscription is illustrated at $9/month and is not open. This site cannot take payment.",
  keywords: ["trade journal pricing", "free position calculator", "planned analytics subscription"],
  alternates: { canonical: "/pricing/" },
};

const rows = [
  ["Closed-trade overview, filters, and curves", "Free. Unknown until a file is published.", "Stays free"],
  ["Position calculator with your own ticks", "Free and working now", "Stays free"],
  ["Local journal, symbol and month splits, fee drag, CSV", "Free. Stays in the browser.", "Stays free"],
  ["Comparison across several periods", "Not built", "Planned. Not available now."],
  ["A longer risk report and fixed export templates", "Not built", "Planned. Not available now."],
  ["Trade signals, copy trading, or order entry", "Not offered", "Not offered"],
  ["Checkout and login", "None", "Not yet open. No pay button."],
];

export default function PricingPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-xs font-medium tracking-[0.16em] text-accent">FREE NOW · PRO NOT OPEN</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Use it free. Subscribe only later, if at all.</h1>
      <p className="mt-3 max-w-3xl text-base leading-7 text-muted">
        What can check closed trades, fees, and position size works now and is not behind a trial wall. If a subscription opens later, it would sell analysis that has not been built. It would not sell a profit promise. ${PLANNED_MONTHLY_USD}/month is an illustration, not a quote, and it cannot be paid here.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/#records" className="btn btn-primary">
          View closed trades
        </Link>
        <Link href="/tools/#size" className="btn btn-ghost">
          Use the free position calculator
        </Link>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-card-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Free features compared with planned features</caption>
          <thead className="bg-card text-muted">
            <tr>
              <th scope="col" className="px-3 py-3 font-medium">
                Capability
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Now
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Planned · ${PLANNED_MONTHLY_USD}/month illustration
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([feature, now, later]) => (
              <tr key={feature} className="border-t border-card-border align-top">
                <th scope="row" className="px-3 py-3 font-medium">
                  {feature}
                </th>
                <td className="px-3 py-3">{now}</td>
                <td className="px-3 py-3 text-muted">{later}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="panel mt-6 px-4 py-5">
        <h2 className="text-lg font-semibold">Why a later price might exist</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          The free tools cover one calculation and one local journal. Ongoing comparison and a longer report, if they are built, are the only reason a fee would be discussed. Until then this page only separates what works from what does not. There is no countdown, no subscriber count, and no payment-success state.
        </p>
        <button type="button" className="btn btn-ghost mt-4 cursor-not-allowed opacity-60" disabled>
          Subscriptions are not yet open
        </button>
      </section>
      <div className="mt-8">
        <Disclosure />
      </div>
    </main>
  );
}
