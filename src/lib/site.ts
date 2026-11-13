/** Public site facts. No secrets. The checkout product id is the live Creem link. */
export const CHECKOUT_URL =
  "https://www.creem.io/payment/prod_w9pGaP1bfoaF20iNiGXKt";

export const SUPPORT_EMAIL = "Zjs315416174@gmail.com";

export const OPERATOR_NAME = "junshan zhao";

export const SITE_URL = "https://dollyzoom.top";

/**
 * Root-relative public URL. Production Pages hosting is the domain root
 * (https://dollyzoom.top/...), not a /dollyzoom project prefix.
 * NEXT_PUBLIC_BASE_PATH stays empty in that deploy.
 */
export function publicPath(path: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
