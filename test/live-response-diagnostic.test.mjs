import assert from "node:assert/strict";
import test from "node:test";
import { classifyDiagnosticError, runLiveResponseDiagnostic } from "../build/live-response-diagnostic.js";

test("diagnostic discards successful payload contents", async () => {
  const client = {
    async get() {
      return { data: [{ id: 1, name: "Private Service", email: "private@example.com" }] };
    }
  };

  const result = await runLiveResponseDiagnostic(client);
  assert.deepEqual(result, { mode: "read-only", endpoint: "services", result: "json-ok" });
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("Private Service"), false);
  assert.equal(serialized.includes("private@example.com"), false);
});

test("diagnostic classifies safe response failure categories", async () => {
  const cases = [
    [new Error("Trafft API GET /services failed (401)."), "http-401"],
    [new Error("Trafft returned a non-JSON response (html)."), "non-json-html"],
    [new Error("Trafft returned a non-JSON response (invalid-json)."), "non-json-invalid-json"],
    [new Error("Trafft response exceeded the configured body-size limit."), "body-limit"],
    [new Error("Trafft returned a response with invalid UTF-8 encoding."), "invalid-utf8"],
    [new Error("Trafft API GET /services network request failed."), "network"],
    [new Error("Trafft authentication returned no recognized token field."), "authentication"]
  ];

  for (const [error, expected] of cases) assert.equal(classifyDiagnosticError(error), expected);
});

test("diagnostic never echoes an underlying error message", async () => {
  const client = {
    async get() {
      throw new Error("Trafft returned a non-JSON response (html). private@example.com secret-value");
    }
  };

  const result = await runLiveResponseDiagnostic(client);
  assert.equal(result.errorCode, "non-json-html");
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("private@example.com"), false);
  assert.equal(serialized.includes("secret-value"), false);
});
