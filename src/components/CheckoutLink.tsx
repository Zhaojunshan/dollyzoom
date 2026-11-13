"use client";

import { useState } from "react";

import { CHECKOUT_URL } from "@/lib/site";

/**
 * Real same-tab link to the existing Creem checkout.
 * The href is in the server HTML, so a clean visit works with JavaScript off.
 * Clicking does not call preventDefault. A new tab is not used: a blocked
 * popup would leave this page looking unchanged.
 */
export function CheckoutLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [pending, setPending] = useState(false);

  return (
    <a
      href={CHECKOUT_URL}
      className={className}
      data-checkout="hd"
      aria-live="polite"
      onClick={() => setPending(true)}
    >
      {pending ? "Continuing to Creem checkout…" : children}
    </a>
  );
}
