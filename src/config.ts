export interface RuntimeConfig {
  apiUrl: string;
  apiPath: string;
  authPath: string;
  allowedHosts: string[];
  clientId: string;
  clientSecret: string;
  auditLogPath: string;
  timeoutMs: number;
  maxHttpBodyBytes: number;
  maxRetries: number;
  maxResponseChars: number;
  enableExperimentalReads: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  return {
    apiUrl: required(env, "TRAFFT_API_URL"),
    apiPath: required(env, "TRAFFT_API_PATH"),
    authPath: env.TRAFFT_AUTH_PATH?.trim() || "/auth/token",
    allowedHosts: [...new Set(required(env, "TRAFFT_ALLOWED_HOSTS").split(",").map((value) => value.trim()).filter(Boolean))],
    clientId: required(env, "TRAFFT_CLIENT_ID"),
    clientSecret: required(env, "TRAFFT_CLIENT_SECRET"),
    auditLogPath: required(env, "TRAFFT_AUDIT_LOG_PATH"),
    timeoutMs: boundedInteger(env.TRAFFT_TIMEOUT_MS, 30_000, 1_000, 120_000, "TRAFFT_TIMEOUT_MS"),
    maxHttpBodyBytes: boundedInteger(env.TRAFFT_MAX_HTTP_BODY_BYTES, 5_000_000, 1_024, 10_000_000, "TRAFFT_MAX_HTTP_BODY_BYTES"),
    maxRetries: boundedInteger(env.TRAFFT_MAX_RETRIES, 2, 0, 5, "TRAFFT_MAX_RETRIES"),
    maxResponseChars: boundedInteger(env.TRAFFT_MAX_RESPONSE_CHARS, 20_000, 1_000, 100_000, "TRAFFT_MAX_RESPONSE_CHARS"),
    enableExperimentalReads: env.TRAFFT_ENABLE_EXPERIMENTAL_READS?.trim().toLowerCase() === "true"
  };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${name}.`);
  return value;
}

function boundedInteger(raw: string | undefined, fallback: number, minimum: number, maximum: number, name: string): number {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum}.`);
  }
  return value;
}
