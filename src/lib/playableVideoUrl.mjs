/**
 * HTTPS URL a browser can play. Rejects other schemes, embedded credentials,
 * and local hosts so a provider response cannot redirect the page at itself.
 */
export function playableVideoUrl(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed.length < 12 || trimmed.length > 2000) return "";
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return "";
  }
  if (url.protocol !== "https:" || url.username || url.password) return "";
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".localhost")
  ) {
    return "";
  }
  return url.toString();
}
