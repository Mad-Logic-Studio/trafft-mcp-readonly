import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createJsonlAuditSink } from "./audit-log.js";
import { TrafftClient } from "./client.js";
import { loadConfig } from "./config.js";

interface ReadClient {
  get<T = unknown>(path: string): Promise<T>;
}

export interface LiveResponseDiagnostic {
  mode: "read-only";
  endpoint: "services";
  result: "json-ok" | "error";
  errorCode?: string;
}

export async function runLiveResponseDiagnostic(client: ReadClient): Promise<LiveResponseDiagnostic> {
  try {
    await client.get("/services?limit=1&page=1");
    return { mode: "read-only", endpoint: "services", result: "json-ok" };
  } catch (error) {
    return {
      mode: "read-only",
      endpoint: "services",
      result: "error",
      errorCode: classifyDiagnosticError(error)
    };
  }
}

export function classifyDiagnosticError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const status = message.match(/\((\d{3})\)/)?.[1];
  if (status) return `http-${status}`;
  const format = message.match(/non-JSON response \((html|text|invalid-json|unknown|other)\)/)?.[1];
  if (format) return `non-json-${format}`;
  if (message.includes("body-size limit")) return "body-limit";
  if (message.includes("invalid UTF-8")) return "invalid-utf8";
  if (message.includes("network request failed")) return "network";
  if (message.includes("authentication")) return "authentication";
  if (message.includes("unsafe") || message.includes("escaped the configured")) return "request-validation";
  return "response-validation";
}

async function main(): Promise<void> {
  if (process.env.TRAFFT_LIVE_VALIDATION_ACK !== "READ_ONLY_ONLY") {
    throw new Error("Set TRAFFT_LIVE_VALIDATION_ACK=READ_ONLY_ONLY to run the controlled live diagnostic.");
  }

  const config = loadConfig();
  if (config.enableExperimentalReads) throw new Error("Live diagnostic requires TRAFFT_ENABLE_EXPERIMENTAL_READS=false.");

  const client = new TrafftClient({
    apiUrl: config.apiUrl,
    apiPath: config.apiPath,
    authPath: config.authPath,
    allowedHosts: config.allowedHosts,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    timeoutMs: config.timeoutMs,
    maxHttpBodyBytes: config.maxHttpBodyBytes,
    maxRetries: 0,
    audit: createJsonlAuditSink(config.auditLogPath)
  });

  const result = await runLiveResponseDiagnostic(client);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.result !== "json-ok") process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    const code = classifyDiagnosticError(error);
    process.stderr.write(`Live response diagnostic failed (${code}).\n`);
    process.exitCode = 1;
  });
}
