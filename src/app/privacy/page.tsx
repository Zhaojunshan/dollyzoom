import type { Metadata } from "next";

import { LegalDocument } from "@/components/LegalDocument";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Trade Journal handles a public static file and a browser-local journal. No account passwords, no signup, and no contact form.",
  alternates: { canonical: "/privacy/" },
};

export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy" updated="November 24, 2026">
      <p>This note applies to {SITE_URL}.</p>
      <h2>The public static file</h2>
      <p>
        The overview reads performance.json on the site. That file is placed there by hand. It is not a live account connection. It should contain closed-trade statistics, any point balance or equity you chose to include, plus currency, time zone, and an as-of time. It should not contain an account number, password, server, session, or open-position detail.
      </p>
      <h2>What this website does not collect</h2>
      <p>There is no signup, no mailing list, and no contact form. The position calculator and a journal import do not send the file to a server we operate. The pages do not contain a payment key or a personal email address.</p>
      <h2>Storage in the browser</h2>
      <p>
        Two values can be written in your browser: whether the fictional sample is open, and the local journal. They stay on that device. The clear button on the tools page, or the browser’s site-data control, removes them.
      </p>
      <h2>Hosting</h2>
      <p>
        The pages are static files served by GitHub Pages. When a browser requests HTML, scripts, or JSON from this domain, the host handles connection logs under its own policy. This site does not keep a separate account database.
      </p>
      <h2>Sample data</h2>
      <p>The sample file is fictional and shows the interface. Opening it does not upload your terminal or your journal.</p>
    </LegalDocument>
  );
}
