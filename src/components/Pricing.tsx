import Link from "next/link";

import { CheckoutLink } from "@/components/CheckoutLink";

const plans = [
  {
    name: "Try",
    price: "Free",
    detail: "1 watermarked preview after content screening",
    highlighted: false,
  },
  {
    name: "Single HD",
    price: "$1.49",
    detail: "Dolly Zoom HD Unlock · 1 HD clip · no watermark",
    highlighted: true,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Simple pricing
          </h2>
          <p className="mt-2 text-muted">
            The HD button continues to Creem checkout in this tab. Creem is the
            merchant of record. No subscription required.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-2xl border p-6 ${
                plan.highlighted
                  ? "border-accent bg-accent/10 shadow-lg shadow-orange-500/10"
                  : "border-card-border bg-card"
              }`}
            >
              <p className="text-sm font-medium text-muted">{plan.name}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">{plan.price}</p>
              <p className="mt-2 flex-1 text-sm text-muted">{plan.detail}</p>
              {plan.highlighted ? (
                <CheckoutLink className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white hover:bg-accent-soft transition-colors">
                  Buy HD — $1.49
                </CheckoutLink>
              ) : (
                <Link
                  href="/#upload"
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-full border border-card-border text-sm font-semibold hover:border-zinc-500 transition-colors"
                >
                  Upload a photo
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
