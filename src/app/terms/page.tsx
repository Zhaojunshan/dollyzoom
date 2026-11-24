import type { Metadata } from "next";
import Link from "next/link";

import { LegalDocument } from "@/components/LegalDocument";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms for Trade Journal. Not a broker, no trade signals, no profit promise, and subscriptions are not open.",
  alternates: { canonical: "/terms/" },
};

export default function TermsPage() {
  return (
    <LegalDocument title="Terms" updated="November 24, 2026">
      <p>
        These terms apply to Trade Journal at {SITE_URL} (“we”). The site shows closed-trade records and runs calculations in the browser. It is not a broker, an investment adviser, or a trading terminal.
      </p>
      <h2>What the service is</h2>
      <p>
        The public pages can show a static JSON file after a person publishes it. The default file is unconnected and contains no performance. The position calculator and journal run in your browser. We do not accept order instructions and we do not connect to your trading account.
      </p>
      <p>
        Planned analysis is not open. An illustrated price on the site cannot be purchased, and there is no checkout. See <Link href="/pricing/">pricing</Link>.
      </p>
      <h2>Not advice and not a verified record</h2>
      <p>
        Records are self-reported and are not checked by us. A demo, live, or unknown account label is not a verified funded track record. Past results are not future results. Decisions you make from these pages are yours.
      </p>
      <h2>Data and the sample</h2>
      <p>
        The sample is fictional and exists so the interface can be seen. Treating the sample as a real result, or putting an account number, password, server, or open-position detail in a file, does not follow these terms. See{" "}
        <Link href="/acceptable-use/">acceptable use</Link>.
      </p>
      <h2>Who may use it</h2>
      <p>You need to be at least 18, and you need the right to use any record you import or publish.</p>
      <h2>Limits</h2>
      <p>
        The site is provided as it is. We do not guarantee that the data is complete, that a calculation matches a particular broker’s specification, or that the site will stay available. To the extent the law allows, we are not liable for trading losses from using the site. A local journal lives in your browser. Clearing site data removes it, and we cannot restore it.
      </p>
      <h2>Contact</h2>
      <p>This site has no contact form and does not publish a personal email address. Do not send account credentials here. There is no place on the site that receives them.</p>
    </LegalDocument>
  );
}
