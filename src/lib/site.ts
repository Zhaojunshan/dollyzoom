/** Public site facts. No secrets, no checkout URL, and no personal contact address. */

export const SITE_URL = "https://dollyzoom.top";
export const SITE_NAME = "交易观察";
export const SITE_NAME_EN = "Trade Journal";
export const PLANNED_MONTHLY_USD = 9;

/**
 * Root-relative public URL. Production Pages hosting is the domain root.
 * NEXT_PUBLIC_BASE_PATH stays empty in that deploy.
 */
export function publicPath(path: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

/** Resolve a same-origin data path on both the custom domain and a github.io project URL. */
export function browserPublicPath(path: string): string {
  const suffix = publicPath(path);
  if (typeof window === "undefined") return suffix;
  if (process.env.NEXT_PUBLIC_BASE_PATH) return suffix;
  if (
    process.env.NEXT_PUBLIC_RELATIVE_ASSETS === "1" &&
    window.location.hostname.endsWith("github.io")
  ) {
    const [first] = window.location.pathname.split("/").filter(Boolean);
    if (first === "dollyzoom") return `/dollyzoom${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
  }
  return suffix;
}
