export function validateLiveEnvironment(env = process.env) {
  const required = ["TRAFFT_API_URL", "TRAFFT_ALLOWED_HOSTS", "TRAFFT_CLIENT_ID", "TRAFFT_CLIENT_SECRET"];
  for (const name of required) {
    if (!env[name]?.trim()) return { ok: false, code: `missing-${name.toLowerCase().replaceAll("_", "-")}` };
  }

  let url;
  try {
    url = new URL(env.TRAFFT_API_URL.trim());
  } catch {
    return { ok: false, code: "api-url-invalid" };
  }

  if (url.protocol !== "https:") return { ok: false, code: "api-url-not-https" };
  if (url.username || url.password) return { ok: false, code: "api-url-has-credentials" };
  if (url.search || url.hash) return { ok: false, code: "api-url-has-query-or-fragment" };
  if (url.port && url.port !== "443") return { ok: false, code: "api-url-nonstandard-port" };
  if (url.pathname !== "/" && url.pathname !== "") return { ok: false, code: "api-url-has-path" };

  const rawHosts = env.TRAFFT_ALLOWED_HOSTS.split(",").map((value) => value.trim()).filter(Boolean);
  if (rawHosts.length === 0) return { ok: false, code: "allowed-hosts-empty" };
  const hosts = [];
  for (const raw of rawHosts) {
    if (raw.includes("://") || raw.includes("/") || raw.includes("*") || /\s/.test(raw)) {
      return { ok: false, code: "allowed-host-invalid" };
    }
    hosts.push(raw.toLowerCase().replace(/\.$/, ""));
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hosts.includes(hostname)) return { ok: false, code: "api-host-not-allowlisted" };

  if ((env.TRAFFT_API_PATH ?? "/api/v2") !== "/api/v2") return { ok: false, code: "api-path-unexpected" };
  if ((env.TRAFFT_AUTH_PATH ?? "/auth/token") !== "/auth/token") return { ok: false, code: "auth-path-unexpected" };
  if ((env.TRAFFT_ENABLE_EXPERIMENTAL_READS ?? "false").toLowerCase() !== "false") {
    return { ok: false, code: "experimental-reads-enabled" };
  }
  if (env.TRAFFT_LIVE_VALIDATION_ACK !== "READ_ONLY_ONLY") return { ok: false, code: "ack-invalid" };

  return { ok: true, code: "ok" };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const result = validateLiveEnvironment();
  if (result.ok) {
    process.stdout.write("Live configuration preflight passed.\n");
  } else {
    process.stderr.write(`Live configuration preflight failed (${result.code}).\n`);
    process.exitCode = 1;
  }
}
