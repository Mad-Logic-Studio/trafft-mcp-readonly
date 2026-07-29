import test from "node:test";
import assert from "node:assert/strict";
import { TrafftClient } from "../build-core/client.js";
import { assertReadOnlyMethod, joinApiUrl, validateApiTarget } from "../build-core/security.js";
import { textResult } from "../build-core/util.js";

const jsonResponse = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", ...headers }
});

const options = (fetchImpl, overrides = {}) => ({
  apiUrl: "https://socialmedium.trafft.com",
  apiPath: "/api/v2",
  allowedHosts: ["socialmedium.trafft.com"],
  clientId: "id",
  clientSecret: "secret",
  fetchImpl,
  sleep: async () => undefined,
  ...overrides
});

test("requires HTTPS", () => {
  assert.throws(() => validateApiTarget("http://socialmedium.trafft.com", ["socialmedium.trafft.com"]), /HTTPS/);
});

test("requires an exact allowlisted hostname", () => {
  assert.throws(() => validateApiTarget("https://evil.example", ["socialmedium.trafft.com"]), /not allowlisted/);
});

test("blocks every write except the authentication POST", () => {
  assert.doesNotThrow(() => assertReadOnlyMethod("POST", "/auth/token", "/auth/token"));
  assert.doesNotThrow(() => assertReadOnlyMethod("GET", "/services", "/auth/token"));
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.throws(() => assertReadOnlyMethod(method, "/customers/1", "/auth/token"), /blocked/);
  }
});

test("joins only normalized API paths", () => {
  assert.equal(joinApiUrl("https://socialmedium.trafft.com", "/api/v2", "/services?page=1"), "https://socialmedium.trafft.com/api/v2/services?page=1");
  assert.throws(() => joinApiUrl("https://socialmedium.trafft.com", "/api/v2", "/../admin"), /unsafe/);
});

test("authenticates and performs a GET with redirects disabled", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/auth/token")) return jsonResponse({ token: "token-1" });
    return jsonResponse([{ id: 1, name: "Service" }]);
  };
  const client = new TrafftClient(options(fetchImpl));
  const data = await client.get("/services");
  assert.deepEqual(data, [{ id: 1, name: "Service" }]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.redirect, "error");
  assert.equal(calls[1].init.redirect, "error");
  assert.equal(calls[1].init.headers.Authorization, "Bearer token-1");
});

test("reauthenticates once after a 401", async () => {
  let authCount = 0;
  let serviceCount = 0;
  const fetchImpl = async (url) => {
    if (String(url).endsWith("/auth/token")) {
      authCount += 1;
      return jsonResponse({ token: `token-${authCount}` });
    }
    serviceCount += 1;
    return serviceCount === 1 ? jsonResponse({ message: "expired" }, 401) : jsonResponse({ ok: true });
  };
  const client = new TrafftClient(options(fetchImpl));
  assert.deepEqual(await client.get("/services"), { ok: true });
  assert.equal(authCount, 2);
  assert.equal(serviceCount, 2);
});

test("retries a transient GET without retrying forever", async () => {
  let serviceCount = 0;
  const fetchImpl = async (url) => {
    if (String(url).endsWith("/auth/token")) return jsonResponse({ token: "token" });
    serviceCount += 1;
    return serviceCount < 3 ? jsonResponse({ message: "busy" }, 503) : jsonResponse({ ok: true });
  };
  const client = new TrafftClient(options(fetchImpl, { maxRetries: 2 }));
  assert.deepEqual(await client.get("/services"), { ok: true });
  assert.equal(serviceCount, 3);
});

test("does not include an upstream error body in thrown errors", async () => {
  const fetchImpl = async (url) => {
    if (String(url).endsWith("/auth/token")) return jsonResponse({ token: "token" });
    return jsonResponse({ customerEmail: "private@example.com", secret: "leak-me" }, 500, { "x-request-id": "req-123" });
  };
  const client = new TrafftClient(options(fetchImpl, { maxRetries: 0 }));
  await assert.rejects(client.get("/customers"), (error) => {
    assert.match(error.message, /failed \(500\)/);
    assert.match(error.message, /req-123/);
    assert.doesNotMatch(error.message, /private@example.com|leak-me/);
    return true;
  });
});

test("rejects query strings and encoded traversal in configured paths", () => {
  assert.throws(() => joinApiUrl("https://socialmedium.trafft.com", "/api/v2?x=1", "/services"), /query string/);
  assert.throws(() => joinApiUrl("https://socialmedium.trafft.com", "/api/v2", "/%2e%2e/admin"), /unsafe encoded/);
});

test("enforces the body limit while streaming", async () => {
  const fetchImpl = async (url) => {
    if (String(url).endsWith("/auth/token")) return jsonResponse({ token: "token" });
    return new Response(JSON.stringify({ value: "x".repeat(200) }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const client = new TrafftClient(options(fetchImpl, { maxHttpBodyBytes: 64 }));
  await assert.rejects(client.get("/services"), /body-size limit/);
});

test("records network failures without exposing the underlying message", async () => {
  const events = [];
  const fetchImpl = async (url) => {
    if (String(url).endsWith("/auth/token")) return jsonResponse({ token: "token" });
    throw new Error("socket failed with secret-value");
  };
  const client = new TrafftClient(options(fetchImpl, { audit: (event) => events.push(event) }));
  await assert.rejects(client.get("/services"), (error) => {
    assert.match(error.message, /network request failed/);
    assert.doesNotMatch(error.message, /secret-value/);
    return true;
  });
  assert.equal(events.at(-1).status, "error");
});


test("returns valid JSON within the configured MCP response limit", () => {
  const result = textResult({ privateData: "x".repeat(5000) }, 1000);
  const text = result.content[0].text;
  assert.ok(text.length <= 1000);
  const parsed = JSON.parse(text);
  assert.equal(parsed.truncated, true);
});

test("rejects wildcard or URL-shaped allowlist entries", () => {
  assert.throws(() => validateApiTarget("https://socialmedium.trafft.com", ["*.trafft.com"]), /invalid hostname/);
  assert.throws(() => validateApiTarget("https://socialmedium.trafft.com", ["https://socialmedium.trafft.com"]), /invalid hostname/);
});
