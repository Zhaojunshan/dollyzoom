import type { Metadata } from "next";
import Link from "next/link";

import { LegalDocument } from "@/components/LegalDocument";

export const metadata: Metadata = {
  title: "Acceptable use",
  description: "Do not present Trade Journal as a verified profit record, a broker, or a copy-trading service, and do not publish account credentials.",
  alternates: { canonical: "/acceptable-use/" },
};

export default function AcceptableUsePage() {
  return (
    <LegalDocument title="Acceptable use" updated="November 24, 2026">
      <p>
        These rules are part of the <Link href="/terms/">terms</Link>.
      </p>
      <h2>Use it this way</h2>
      <ul>
        <li>Treat the public page as a self-reported, unchecked closed-trade record.</li>
        <li>Publish only records you have the right to publish, with account identifiers and open positions removed.</li>
        <li>Treat the position calculator as arithmetic. The contract terms are the ones in your broker’s specification.</li>
      </ul>
      <h2>Do not use it this way</h2>
      <ul>
        <li>Do not describe the sample, an unconnected board, or an unverified record as real, audited, or a guaranteed profit.</li>
        <li>Do not put a password, login, server, session, or someone else’s unauthorized record in a public file or in the journal.</li>
        <li>Do not describe the site as a broker, a signal service, a copy-trading system, or an automated trading program.</li>
        <li>Do not use the illustrated price to pretend a payment succeeded or a subscription is active.</li>
      </ul>
      <h2>Age</h2>
      <p>The site discusses trading records and is not meant for anyone under 18.</p>
      <p>There is no form that accepts credentials or messages. If a file you meant to publish contains a credential, do not upload it, and change that credential with your broker.</p>
    </LegalDocument>
  );
}
