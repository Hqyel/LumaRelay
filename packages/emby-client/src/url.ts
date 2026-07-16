export function normalizeEmbyBaseUrl(value: string): string {
  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new TypeError("Emby URL must use HTTP or HTTPS");

  if (url.username !== "" || url.password !== "")
    throw new TypeError("Emby URL must not contain credentials");

  url.hash = "";
  url.search = "";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  return url.toString();
}

export function embyApiUrl(baseUrl: string, path: string): URL {
  const normalized = normalizeEmbyBaseUrl(baseUrl);
  return new URL(path.replace(/^\/+/, ""), normalized);
}
