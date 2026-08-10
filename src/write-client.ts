import type { AuditSink, FetchLike } from "./client.js";
import { joinApiUrl, normalizeApiPath, sanitizePath, validateApiTarget } from "./security.js";
import { assertAllowedWrite } from "./write-security.js";

export interface CreateCustomerInput {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  description?: string;
}

export interface TrafftWriteClientOptions {
  apiUrl: string;
  apiPath: string;
  authPath?: string;
  allowedHosts: readonly string[];
  clientId: string;
  clientSecret: string;
  writesEnabled: boolean;
  timeoutMs?: number;
  maxHttpBodyBytes?: number;
  fetchImpl?: FetchLike;
  audit?: AuditSink;
}

export class TrafftWriteClient {
  private readonly origin: string;
  private readonly apiPath: string;
  private readonly authPath: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly writesEnabled: boolean;
  private readonly timeoutMs: number;
  private readonly maxHttpBodyBytes: number;
  private readonly fetchImpl: FetchLike;
  private readonly audit: AuditSink;
  private token: string | null = null;

  constructor(options: TrafftWriteClientOptions) {
    const target = validateApiTarget(options.apiUrl, options.allowedHosts);
    this.origin = target.origin;
    this.apiPath = normalizeApiPath(options.apiPath, "TRAFFT_API_PATH");
    this.authPath = normalizeApiPath(options.authPath ?? "/token", "TRAFFT_AUTH_PATH");
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.writesEnabled = options.writesEnabled;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxHttpBodyBytes = options.maxHttpBodyBytes ?? 5_000_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.audit = options.audit ?? (() => undefined);
  }

  async createCustomer(input: CreateCustomerInput): Promise<unknown> {
    return this.writeJson("POST", "/customers", input);
  }

  private async authenticate(): Promise<void> {
    const started = Date.now();
    const body = new URLSearchParams([
      ["grant_type", "client_credentials"],
      ["client_id", this.clientId],
      ["client_secret", this.clientSecret]
    ]).toString();

    const response = await this.fetchImpl(joinApiUrl(this.origin, this.apiPath, this.authPath), {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
      redirect: "error"
    });

    if (!response.ok) {
      this.audit({ event: "auth", method: "POST", path: this.authPath, status: "error", httpStatus: response.status, durationMs: Date.now() - started });
      throw new Error(`Trafft authentication failed (${response.status}).`);
    }

    const payload = await readJsonWithLimit(response, this.maxHttpBodyBytes);
    const token = getToken(payload);
    if (!token) throw new Error("Trafft authentication returned no recognized token field.");
    this.token = token;
    this.audit({ event: "auth", method: "POST", path: this.authPath, status: "ok", httpStatus: response.status, durationMs: Date.now() - started });
  }

  private async writeJson(method: string, path: string, payload: unknown): Promise<unknown> {
    const started = Date.now();
    try {
      assertAllowedWrite(method, path, this.writesEnabled);
    } catch (error) {
      this.audit({ event: "request", method, path: sanitizePath(path), status: "blocked", durationMs: Date.now() - started });
      throw error;
    }

    if (!this.token) await this.authenticate();

    let response: Response;
    try {
      response = await this.fetchImpl(joinApiUrl(this.origin, this.apiPath, path), {
        method,
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${this.token as string}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: "error"
      });
    } catch {
      this.audit({ event: "request", method, path: sanitizePath(path), status: "error", durationMs: Date.now() - started });
      throw new Error(`Trafft API ${method} ${sanitizePath(path)} network request failed.`);
    }

    // Deliberately do not retry writes, including after 401/429/5xx responses.
    // A failed response does not prove the upstream mutation did not happen.
    if (!response.ok) {
      this.audit({ event: "request", method, path: sanitizePath(path), status: "error", httpStatus: response.status, durationMs: Date.now() - started });
      throw new Error(`Trafft API ${method} ${sanitizePath(path)} failed (${response.status}).`);
    }

    const data = await readJsonWithLimit(response, this.maxHttpBodyBytes);
    this.audit({ event: "request", method, path: sanitizePath(path), status: "ok", httpStatus: response.status, durationMs: Date.now() - started });
    return data;
  }
}

function getToken(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  const token = data.token ?? data.access_token ?? data.accessToken;
  return typeof token === "string" && token.length > 0 ? token : null;
}

async function readJsonWithLimit(response: Response, maxBytes: number): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Trafft response exceeded the configured body-size limit.");
  }

  if (!response.body) return {};
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("body-size limit exceeded").catch(() => undefined);
        throw new Error("Trafft response exceeded the configured body-size limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (merged.length === 0) return {};
  const text = new TextDecoder("utf-8", { fatal: true }).decode(merged);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Trafft returned a non-JSON response.");
  }
}
