import { assertReadOnlyMethod, joinApiUrl, normalizeApiPath, sanitizePath, validateApiTarget } from "./security.js";

export interface AuditEvent {
  event: "auth" | "request" | "retry";
  method: string;
  path: string;
  status: "ok" | "error" | "blocked";
  httpStatus?: number;
  durationMs?: number;
  attempt?: number;
  requestId?: string | undefined;
}

export type AuditSink = (event: AuditEvent) => void;
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export type SleepLike = (milliseconds: number) => Promise<void>;

export interface TrafftClientOptions {
  apiUrl: string;
  apiPath: string;
  authPath?: string;
  allowedHosts: readonly string[];
  clientId: string;
  clientSecret: string;
  timeoutMs?: number;
  maxHttpBodyBytes?: number;
  maxRetries?: number;
  fetchImpl?: FetchLike;
  sleep?: SleepLike;
  audit?: AuditSink;
}

const TRANSIENT_GET_STATUSES = new Set([429, 502, 503, 504]);

export class TrafftClient {
  private readonly origin: string;
  private readonly apiPath: string;
  private readonly authPath: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly timeoutMs: number;
  private readonly maxHttpBodyBytes: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: FetchLike;
  private readonly sleep: SleepLike;
  private readonly audit: AuditSink;
  private token: string | null = null;

  constructor(options: TrafftClientOptions) {
    const target = validateApiTarget(options.apiUrl, options.allowedHosts);
    this.origin = target.origin;
    this.apiPath = normalizeApiPath(options.apiPath, "TRAFFT_API_PATH");
    this.authPath = normalizeApiPath(options.authPath ?? "/auth/token", "TRAFFT_AUTH_PATH");
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxHttpBodyBytes = options.maxHttpBodyBytes ?? 5_000_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.audit = options.audit ?? (() => undefined);
  }

  async authenticate(): Promise<void> {
    const started = Date.now();
    try {
      assertReadOnlyMethod("POST", this.authPath, this.authPath);
      const response = await this.fetchImpl(joinApiUrl(this.origin, this.apiPath, this.authPath), {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clientId: this.clientId, clientSecret: this.clientSecret }),
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: "error"
      });

      if (!response.ok) {
        this.audit({ event: "auth", method: "POST", path: this.authPath, status: "error", httpStatus: response.status, durationMs: Date.now() - started, requestId: safeRequestId(response) });
        throw sanitizedHttpError("Trafft authentication", response);
      }

      const payload = await this.readJson(response);
      const token = getToken(payload);
      if (!token) throw new Error("Trafft authentication returned no recognized token field.");
      this.token = token;
      this.audit({ event: "auth", method: "POST", path: this.authPath, status: "ok", httpStatus: response.status, durationMs: Date.now() - started, requestId: safeRequestId(response) });
    } catch (error) {
      if (!(error instanceof Error && error.message.startsWith("Trafft authentication failed"))) {
        this.audit({ event: "auth", method: "POST", path: this.authPath, status: "error", durationMs: Date.now() - started });
      }
      throw error;
    }
  }

  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>("GET", path, true, 0);
  }

  private async request<T>(method: string, path: string, allowReauth: boolean, attempt: number): Promise<T> {
    const started = Date.now();
    try {
      assertReadOnlyMethod(method, path, this.authPath);
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
          "Authorization": `Bearer ${this.token as string}`
        },
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: "error"
      });
    } catch (error) {
      this.audit({ event: "request", method, path: sanitizePath(path), status: "error", durationMs: Date.now() - started });
      throw error instanceof Error ? new Error(`Trafft API ${method} ${sanitizePath(path)} network request failed.`) : new Error("Trafft network request failed.");
    }

    if (response.status === 401 && allowReauth) {
      this.token = null;
      this.audit({ event: "retry", method, path: sanitizePath(path), status: "ok", httpStatus: 401, attempt: attempt + 1 });
      await this.authenticate();
      return this.request<T>(method, path, false, attempt + 1);
    }

    if (method === "GET" && TRANSIENT_GET_STATUSES.has(response.status) && attempt < this.maxRetries) {
      const delay = retryDelayMs(response, attempt);
      this.audit({ event: "retry", method, path: sanitizePath(path), status: "ok", httpStatus: response.status, attempt: attempt + 1 });
      await this.sleep(delay);
      return this.request<T>(method, path, allowReauth, attempt + 1);
    }

    if (!response.ok) {
      this.audit({ event: "request", method, path: sanitizePath(path), status: "error", httpStatus: response.status, durationMs: Date.now() - started, requestId: safeRequestId(response) });
      throw sanitizedHttpError(`Trafft API ${method} ${sanitizePath(path)}`, response);
    }

    const data = await this.readJson(response) as T;
    this.audit({ event: "request", method, path: sanitizePath(path), status: "ok", httpStatus: response.status, durationMs: Date.now() - started, requestId: safeRequestId(response) });
    return data;
  }

  private async readJson(response: Response): Promise<unknown> {
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > this.maxHttpBodyBytes) {
      throw new Error("Trafft response exceeded the configured body-size limit.");
    }

    const text = await readBodyWithLimit(response, this.maxHttpBodyBytes);
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error("Trafft returned a non-JSON response.");
    }
  }
}

function getToken(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  const token = data.token ?? data.access_token ?? data.accessToken;
  return typeof token === "string" && token.length > 0 ? token : null;
}

function sanitizedHttpError(prefix: string, response: Response): Error {
  const requestId = safeRequestId(response);
  const suffix = requestId ? ` Request ID ${requestId}.` : "";
  return new Error(`${prefix} failed (${response.status}).${suffix}`);
}

function safeRequestId(response: Response): string | undefined {
  const raw = response.headers.get("x-request-id") ?? response.headers.get("request-id");
  if (!raw) return undefined;
  const clean = raw.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 80);
  return clean || undefined;
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter && /^\d+$/.test(retryAfter)) {
    return Math.min(Number(retryAfter) * 1000, 30_000);
  }
  return Math.min(500 * 2 ** attempt, 5_000);
}


async function readBodyWithLimit(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
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
  return new TextDecoder("utf-8", { fatal: true }).decode(merged);
}
