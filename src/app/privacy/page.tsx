import type { Metadata } from "next";

import { LegalDocument } from "@/components/LegalDocument";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy | DollyZoom",
  description:
    "Privacy Policy for DollyZoom. How junshan zhao handles photos, support email, content screening, and Creem checkout.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy" updated="November 13, 2026">
      <p>
        This policy explains how DollyZoom at{" "}
        <a href="https://dollyzoom.top/">dollyzoom.top</a> handles information.
        The operator is junshan zhao, an individual in China. Contact{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>Photos you upload</h2>
      <p>
        The free preview is created in your browser from the file you choose.
        That photo is not uploaded to a DollyZoom server. It stays on your
        device unless your own browser or an extension sends it somewhere else.
        We do not build a gallery from customer photos.
      </p>

      <h2>Content screening</h2>
      <p>
        Before a preview is created, the site asks our moderation proxy to
        screen the generation. The proxy sends the prompt for that request to
        Creem’s Content Moderation API (
        <a href="https://api.creem.io/v1/moderation/prompt">
          api.creem.io/v1/moderation/prompt
        </a>
        ). For the standard dolly-zoom effect that prompt is the fixed effect
        description, plus any text you submit if a text field is offered. The
        photo itself is not part of that call. Creem returns a decision. We
        block the preview unless the decision is allow. That includes sexual,
        adult, and NSFW requests: they are not previewed. The API key for the
        screening call stays on the server.
      </p>

      <h2>Payments</h2>
      <p>
        HD purchases are checked out by Creem, the merchant of record. Creem
        collects the payment details, billing email, and related records on its
        own checkout page. We do not receive or store your card number. Creem’s
        privacy policy describes how it handles that information.
      </p>

      <h2>Support email</h2>
      <p>
        If you email {SUPPORT_EMAIL}, we use the message to answer you. We keep
        it for as long as needed to handle the request and any follow-up, then
        delete it when we no longer need it.
      </p>

      <h2>Cookies and hosting</h2>
      <p>
        The site is a static site hosted on GitHub Pages. We do not set
        advertising or analytics cookies. Creem may set cookies on creem.io
        after you continue to checkout.
      </p>

      <h2>Sharing</h2>
      <p>
        We share the screening prompt with Creem so the generation can be
        checked. We share payment processing with Creem when you buy HD. We do
        not sell personal information. We may disclose information if the law
        requires it.
      </p>

      <h2>International processing</h2>
      <p>
        The operator is in China. GitHub Pages and Creem may process data in
        other countries. By using the site or emailing support, you understand
        that this processing is needed to run the service.
      </p>

      <h2>Children</h2>
      <p>
        DollyZoom is not for anyone under 18. Do not upload photos of minors.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </LegalDocument>
  );
}
