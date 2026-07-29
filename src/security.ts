export type AllowedHttpMethod = "GET" | "POST";

export interface ValidatedApiTarget {
  origin: string;
  hostname: string;
}

export function validateApiTarget(apiUrl: string, allowedHosts: readonly string[]): ValidatedApiTarget {
  if (allowedHosts.length === 0) {
    throw new Error("TRAFFT_ALLOWED_HOSTS must contain at least one hostname.");
  }

  let parsed: URL;
  try {
    parsed = new URL(apiUrl);
  } catch {
    throw new Error("TRAFFT_API_URL is not a valid URL.");
  }

  if (parsed.protocol !== "https:") throw new Error("TRAFFT_API_URL must use HTTPS.");
  if (parsed.username || parsed.password) throw new Error("TRAFFT_API_URL must not contain embedded credentials.");
  if (parsed.search || parsed.hash) throw new Error("TRAFFT_API_URL must not contain a query string or fragment.");
  if (parsed.port && parsed.port !== "443") throw new Error("TRAFFT_API_URL must use the standard HTTPS port.");
  if (parsed.pathname !== "/" && parsed.pathname !== "") {
    throw new Error("TRAFFT_API_URL must be an origin without an API path.");
  }

  const normalizedAllowed = new Set(
    allowedHosts.map(normalizeAllowedHostname).filter((value): value is string => Boolean(value))
  );
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!normalizedAllowed.has(hostname)) {
    throw new Error(`TRAFFT_API_URL hostname is not allowlisted: ${hostname}`);
  }

  return { origin: parsed.origin, hostname };
}

export function normalizeApiPath(path: string, label: string): string {
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) throw new Error(`${label} must start with /.`);
  if (trimmed.includes("?") || trimmed.includes("#")) throw new Error(`${label} must not contain a query string or fragment.`);
  if (/\p{Cc}/u.test(trimmed)) throw new Error(`${label} contains control characters.`);
  if (trimmed.includes("..") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    throw new Error(`${label} contains an unsafe path sequence.`);
  }
  if (/%(?:2e|2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(trimmed)) {
    throw new Error(`${label} contains an unsafe encoded path sequence.`);
  }
  return trimmed.length > 1 ? trimmed.replace(/\/+$/, "") : trimmed;
}

export function assertReadOnlyMethod(method: string, path: string, authPath: string): asserts method is AllowedHttpMethod {
  if (method === "GET") return;
  if (method === "POST" && stripQuery(path) === stripQuery(authPath)) return;
  throw new Error(`Read-only policy blocked ${method} ${sanitizePath(path)}.`);
}

export function sanitizePath(path: string): string {
  const withoutQuery = stripQuery(path);
  return withoutQuery
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, "{uuid}")
    .replace(/\b\d+\b/g, "{id}")
    .slice(0, 240);
}

export function joinApiUrl(origin: string, apiPath: string, relativePath: string): string {
  const normalizedApiPath = normalizeApiPath(apiPath, "TRAFFT_API_PATH");
  const queryIndex = relativePath.indexOf("?");
  const rawPath = queryIndex >= 0 ? relativePath.slice(0, queryIndex) : relativePath;
  const query = queryIndex >= 0 ? relativePath.slice(queryIndex) : "";
  const normalizedRelative = normalizeApiPath(rawPath, "API request path");
  if (query.includes("#") || /\p{Cc}/u.test(query)) {
    throw new Error("API request query contains unsafe characters.");
  }

  const expectedBasePath = normalizedApiPath === "/" ? "/" : `${normalizedApiPath}/`;
  const url = new URL(`${origin}${normalizedApiPath}${normalizedRelative}${query}`);
  if (url.origin !== origin) throw new Error("API request escaped the configured origin.");
  if (normalizedApiPath !== "/" && url.pathname !== normalizedApiPath && !url.pathname.startsWith(expectedBasePath)) {
    throw new Error("API request escaped the configured API path.");
  }
  if (url.hash) throw new Error("API request must not contain a fragment.");
  return url.toString();
}

function stripQuery(path: string): string {
  return path.split("?", 1)[0] ?? path;
}

function normalizeAllowedHostname(value: string): string | null {
  const host = value.trim().toLowerCase().replace(/\.$/, "");
  if (!host) return null;
  if (host.includes("://") || host.includes("/") || host.includes("*") || /\s/.test(host)) {
    throw new Error(`TRAFFT_ALLOWED_HOSTS contains an invalid hostname: ${value}`);
  }
  return host;
}
