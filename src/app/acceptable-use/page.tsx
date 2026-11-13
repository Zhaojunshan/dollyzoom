import type { Metadata } from "next";
import Link from "next/link";

import { LegalDocument } from "@/components/LegalDocument";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Acceptable Use Policy | DollyZoom",
  description:
    "Acceptable use rules for the DollyZoom AI video tool. Sexual, adult, and NSFW video generation is prohibited, along with deepfakes and other harmful uses.",
  robots: { index: true, follow: true },
};

export default function AcceptableUsePage() {
  return (
    <LegalDocument title="Acceptable Use Policy" updated="November 13, 2026">
      <p>
        These rules apply to every use of DollyZoom, including free previews and
        paid HD unlocks. They are part of the{" "}
        <Link href="/terms/">Terms of Service</Link>. DollyZoom is an AI video tool
        that applies a dolly-zoom camera move to a photo. It is not a face-swap,
        deepfake, or unfiltered generation product.
      </p>

      <h2>Sexual, adult, and NSFW content is prohibited</h2>
      <p>
        You may not upload, request, generate, or attempt to generate any of the
        following, and you may not try to get the tool to do so:
      </p>
      <ul>
        <li>Sexual content</li>
        <li>Adult content</li>
        <li>NSFW content</li>
        <li>Pornographic, nude, or explicit content</li>
        <li>Sexually suggestive content, including implied sexual content</li>
        <li>Non-consensual intimate imagery</li>
      </ul>
      <p>
        This prohibition is absolute on DollyZoom. A request that is blocked by
        screening must not be reworded to sneak past it.
      </p>

      <h2>Other prohibited uses</h2>
      <ul>
        <li>
          Any sexual, exploitative, or nude content involving a minor, and any
          upload of a minor’s image
        </li>
        <li>
          Deepfakes, face swaps, face replacement, or other tools or prompts
          meant to change someone’s identity
        </li>
        <li>
          Using a real person’s likeness without their permission, or
          impersonating someone
        </li>
        <li>Extreme violence, gore, or content that promotes terrorism</li>
        <li>
          Content that assists fraud, scams, phishing, or other illegal activity
        </li>
        <li>Harassment, threats, or hate against a person or group</li>
        <li>
          Uploading a photo you do not have the right to use, including
          copyrighted material you do not own
        </li>
        <li>
          Trying to bypass, disable, or overwhelm content screening, or probing
          the service for a way around these rules
        </li>
        <li>
          Reselling or misrepresenting the tool as an uncensored, no-filter, or
          adult generator
        </li>
      </ul>

      <h2>What the tool is for</h2>
      <p>
        Use DollyZoom to make a dolly-zoom camera move from a photo you are
        allowed to use, of an adult subject who has agreed to it where consent
        is required. Do not use it to invent a different person, to remove
        clothing, or to sexualize the subject.
      </p>

      <h2>Enforcement</h2>
      <p>
        Generation requests are screened before a preview is created. Decisions
        to deny or flag, and any screening failure, stop the preview. We may
        refuse further use of the service if these rules are broken. Report
        abuse to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalDocument>
  );
}
