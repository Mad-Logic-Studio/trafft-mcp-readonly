#!/usr/bin/env node
import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import "dotenv/config";
import { createTrafftMcpRuntime } from "./server-factory.js";

// @modelcontextprotocol/sdk 1.29.0's StreamableHTTPServerTransport declaration is
// incompatible with TypeScript 6 + exactOptionalPropertyTypes even though the
// runtime transport is valid. Keep the lockfile pinned and load this one module
// through Node's runtime resolver so the upstream declaration defect does not
// force us to weaken this repository's compiler settings. Remove this shim in a
// separately reviewed SDK upgrade once the pinned declaration is compatible.
const require = createRequire(import.meta.url);
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js") as {
  StreamableHTTPServerTransport: new (options: Record<string, unknown>) => {
    close(): Promise<void>;
    handleRequest(req: IncomingMessage, res: ServerResponse, parsedBody?: unknown): Promise<void>;
  };
};

const port = boundedInteger(process.env.PORT ?? process.env.MCP_PORT, 3000, 1, 65535, "MCP_PORT");
const bindHost = process.env.MCP_BIND_HOST?.trim() || "127.0.0.1";
const endpoint = normalizeEndpoint(process.env.MCP_ENDPOINT?.trim() || "/mcp");
const maxRequestBytes = boundedInteger(process.env.MCP_MAX_REQUEST_BYTES, 1_000_000, 1_024, 4_000_000, "MCP_MAX_REQUEST_BYTES");
const accessToken = requiredSecret("MCP_ACCESS_TOKEN");

const httpServer = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/healthz") {
      if (req.method !== "GET") return methodNotAllowed(res, "GET");
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ ok: true, service: "trafft-readonly-mcp", transport: "streamable-http" }));
      return;
    }

    if (url.pathname !== endpoint) {
      res.writeHead(404, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }

    if (!isAuthorized(req, accessToken)) {
      res.writeHead(401, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "WWW-Authenticate": "Bearer"
      });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }

    if (req.method === "GET" || req.method === "DELETE") {
      return methodNotAllowed(res, "POST");
    }
    if (req.method !== "POST") {
      return methodNotAllowed(res, "POST");
    }

    const body = await readJsonBody(req, maxRequestBytes);
    const { server } = await createTrafftMcpRuntime();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    let closed = false;
    const cleanup = async (): Promise<void> => {
      if (closed) return;
      closed = true;
      await transport.close().catch(() => undefined);
      await server.close().catch(() => undefined);
    };

    res.once("close", () => { void cleanup(); });
    await server.connect(transport as never);
    await transport.handleRequest(req, res, body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected request failure.";
    if (!res.headersSent) {
      const status = message === "request_too_large" ? 413 : message === "invalid_json" ? 400 : 500;
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ error: status === 500 ? "internal_error" : message }));
    } else if (!res.writableEnded) {
      res.end();
    }
  }
});

httpServer.listen(port, bindHost, () => {
  console.error(`trafft-readonly MCP remote transport listening on http://${bindHost}:${port}${endpoint}`);
});

const shutdown = (): void => {
  httpServer.close(() => process.exit(0));
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

function isAuthorized(req: IncomingMessage, expectedToken: string): boolean {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;
  const supplied = header.slice("Bearer ".length).trim();
  if (!supplied) return false;
  const expectedDigest = createHash("sha256").update(expectedToken).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}

async function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const contentType = req.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new Error("invalid_json");

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > maxBytes) throw new Error("request_too_large");
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new Error("invalid_json");
  }
}

function methodNotAllowed(res: ServerResponse, allow: string): void {
  res.writeHead(405, { "Content-Type": "application/json", "Cache-Control": "no-store", "Allow": allow });
  res.end(JSON.stringify({ error: "method_not_allowed" }));
}

function normalizeEndpoint(value: string): string {
  if (!value.startsWith("/") || value.includes("?") || value.includes("#") || value.includes("..")) {
    throw new Error("MCP_ENDPOINT must be a simple absolute path.");
  }
  return value.length > 1 ? value.replace(/\/+$/, "") : value;
}

function requiredSecret(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value.length < 32) throw new Error(`${name} must contain at least 32 characters.`);
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
