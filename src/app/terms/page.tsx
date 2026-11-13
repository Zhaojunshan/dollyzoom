import type { Metadata } from "next";
import Link from "next/link";

import { LegalDocument } from "@/components/LegalDocument";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service | DollyZoom",
  description:
    "Terms of Service for DollyZoom, the AI dolly zoom video tool operated by junshan zhao. Sexual, adult, NSFW, explicit, and sexually suggestive generation is prohibited.",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalDocument title="Terms of Service" updated="November 13, 2026">
      <p>
        These terms govern use of DollyZoom at{" "}
        <a href="https://dollyzoom.top/">dollyzoom.top</a>, an AI video tool that
        turns one photo into a Hitchcock-style dolly zoom. The service is
        operated by junshan zhao, an individual in China (“we”, “us”). DollyZoom
        is an independent product. It is not affiliated with, endorsed by, or
        sponsored by any third-party AI model provider.
      </p>

      <h2>The service</h2>
      <p>
        You can upload a photo for a watermarked preview and buy a Dolly Zoom HD
        Unlock (currently $1.49) through Creem checkout. Creem is the merchant
        of record for that purchase. The price and what is delivered are shown
        on the checkout page before you pay. We do not offer face swap, deepfake,
        or identity-replacement tools.
      </p>

      <h2>Eligibility</h2>
      <p>
        You must be at least 18 years old. You must have the rights and any
        required permission to upload a photo, including permission from any
        person shown in it. Do not upload images of minors.
      </p>

      <h2>Prohibited content</h2>
      <p>
        You may not use DollyZoom to request, upload, generate, or attempt to
        generate sexual, adult, NSFW, pornographic, nude, explicit, or sexually
        suggestive content. This ban includes implied sexual content and any
        attempt to describe or produce it. You also may not generate content
        that is illegal, hateful, extremely violent, or that uses another
        person’s likeness without permission. The full list is in our{" "}
        <Link href="/acceptable-use/">Acceptable Use Policy</Link>, which is part of
        these terms. We screen generation requests and block ones that violate
        this rule. We may refuse service to anyone who tries to break it.
      </p>

      <h2>Your content</h2>
      <p>
        You keep your rights in photos you upload. The free preview is processed
        in your browser. You give us a limited permission to screen the
        generation request and to show you that preview. Our sample still and
        sample clip on the homepage are original illustrations owned by the
        operator.
      </p>

      <h2>Payments</h2>
      <p>
        HD checkout is provided by Creem. Card details are entered on Creem’s
        site, not on dollyzoom.top. Creem’s terms apply to the payment. For a
        billing question, or if a paid HD file was not delivered, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>Acceptable use and privacy</h2>
      <p>
        You must follow the <Link href="/acceptable-use/">Acceptable Use Policy</Link>{" "}
        and the <Link href="/privacy/">Privacy Policy</Link>.
      </p>

      <h2>Disclaimers</h2>
      <p>
        The service is provided as available. Previews are watermarked and may
        differ from a paid HD file. We do not promise that a result will be free
        of visual artifacts. To the extent the law allows, we are not liable for
        indirect or consequential loss. Nothing in these terms limits rights
        that cannot legally be limited.
      </p>

      <h2>Contact</h2>
      <p>
        junshan zhao ·{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </LegalDocument>
  );
}
