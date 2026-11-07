# DollyZoom — AI Dolly Zoom Generator (Day 0)

Outbound SaaS skeleton: **upload one photo → Hitchcock dolly zoom short video**.

Day 0 ships a runnable English landing page, local image preview, **client-side mock generate** (static-export friendly), and placeholder Stripe CTAs. No real domain or live payments.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Client upload preview (object URL)
- `mockGenerate()` in `src/lib/mockGenerate.ts` — pure frontend I2V mock (no API routes)

## Local start

```bash
cd /workspace/dollyzoom
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Static build & preview

```bash
npm run build          # writes out/
npm run preview        # serve out/ (e.g. http://localhost:3000)
```

`out/index.html` must exist after a successful build.

For a **GitHub Pages project site** preview locally (path prefix):

```bash
NEXT_PUBLIC_BASE_PATH=/dollyzoom npm run build
# then open out/ with a static server; assets resolve under /dollyzoom/
```

## GitHub Pages deploy

This repo is set up for a **project site**: `https://<username>.github.io/dollyzoom/`.

1. Push to GitHub (repo name ideally `dollyzoom`).
2. In the repo: **Settings → Pages → Source: GitHub Actions**.
3. On push to `main`/`master` (or manual **Actions → Deploy GitHub Pages → Run workflow**), `.github/workflows/deploy-pages.yml`:
   - builds with `NEXT_PUBLIC_BASE_PATH=/dollyzoom`
   - uploads `out/` via `actions/upload-pages-artifact`
   - deploys with `actions/deploy-pages`

`next.config.ts` reads `NEXT_PUBLIC_BASE_PATH` (default empty) for `basePath` / `assetPrefix`. Leave it empty for a user/org site (`username.github.io` root).

## Page sections

1. **Header** — logo + Try free
2. **Hero** — H1 `AI Dolly Zoom Generator`, subtitle, upload CTA
3. **Before / After** — placeholders for still → vertigo clip
4. **Upload & generate** — drag/drop preview, mock generate, Buy HD $1.49
5. **Pricing** — Free / $1.49 / $9.90 for 10
6. **Footer**

SEO `title` / `description` / Open Graph live in `src/app/layout.tsx`.

## Pricing (product)

| Plan       | Price  | Notes                    |
|------------|--------|--------------------------|
| Try        | Free   | Watermarked preview      |
| Single HD  | $1.49  | One HD download          |
| Pack       | $9.90  | 10 HD clips              |

## Next: Stripe

1. Create Stripe account + Products: `hd_single` ($1.49), `hd_pack_10` ($9.90).
2. Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to `.env.local`.
3. Move off pure static hosting (or call an external Checkout API) — static Pages cannot host `POST` route handlers.
4. Replace **Buy HD — $1.49** handler with redirect to Checkout.
5. Webhook `checkout.session.completed` → mark job unlocked / email download link.
6. Optional: Customer Portal for pack credits.

## Next: Kling / Seedance (I2V)

1. Pick provider (Kling or Seedance); store API key in env only (never in static Pages).
2. Fixed **dolly-zoom** prompt + negative prompt; lock aspect ratio & duration (e.g. 3–5s).
3. Replace `src/lib/mockGenerate.ts` with a call to a real backend / edge function:
   - accept multipart upload or pre-signed URL
   - create remote job → poll / webhook → store MP4
4. Quality gate: face stable, zoom direction correct, no morph artifacts.
5. Watermark free preview; HD after payment.
6. Add sample Before/After assets under `public/` once quality passes.

## Suggested Day 1 order

1. Domain shortlist (e.g. dollyzoom.ai) — register only when you decide.
2. Lock I2V prompt + 5 sample clips.
3. Stripe Checkout for $1.49 (needs a server or third-party backend).
4. Replace Before/After placeholders with real media.
5. Basic analytics (Plausible / GA) + OG image.

## Project layout

```
src/app/layout.tsx          # SEO metadata
src/app/page.tsx            # Landing composition
src/lib/mockGenerate.ts     # Client-side mock I2V
src/components/             # Header, Hero, BeforeAfter, UploadZone, Pricing, Footer
.github/workflows/          # GitHub Pages static deploy
out/                        # Static export (after npm run build)
```

## Notes

- Do not commit secrets. Use `.env.local`.
- Day 0 does **not** register a real domain or charge cards.
- Static export cannot include API routes; generate is mocked in the browser for Pages.
