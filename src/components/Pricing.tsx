const plans = [
  {
    name: "Try",
    price: "Free",
    detail: "1 watermarked preview",
    cta: "Upload a photo",
    href: "#upload",
    highlighted: false,
  },
  {
    name: "Single HD",
    price: "$1.49",
    detail: "1 HD clip · no watermark · download",
    cta: "Buy HD — $1.49",
    href: "#upload",
    highlighted: true,
  },
  {
    name: "Pack",
    price: "$9.90",
    detail: "10 HD clips · best for creators",
    cta: "Get 10 for $9.90",
    href: "#upload",
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Simple pricing
          </h2>
          <p className="mt-2 text-muted">
            Global checkout via Stripe (coming next). No subscription required
            to start.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
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
              <p className="mt-2 text-3xl font-bold tracking-tight">
                {plan.price}
              </p>
              <p className="mt-2 flex-1 text-sm text-muted">{plan.detail}</p>
              <a
                href={plan.href}
                className={`mt-6 inline-flex h-10 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  plan.highlighted
                    ? "bg-accent text-white hover:bg-accent-soft"
                    : "border border-card-border hover:border-zinc-500"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          Payments: Stripe not wired yet — buttons are UI only on Day 0.
        </p>
      </div>
    </section>
  );
}
