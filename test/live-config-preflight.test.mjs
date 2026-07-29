import test from "node:test";
import assert from "node:assert/strict";
import { validateLiveEnvironment } from "../scripts/preflight-live-config.mjs";

const base = {
  TRAFFT_API_URL: "https://api.example.com",
  TRAFFT_ALLOWED_HOSTS: "api.example.com",
  TRAFFT_CLIENT_ID: "id",
  TRAFFT_CLIENT_SECRET: "secret",
  TRAFFT_API_PATH: "/api/v2",
  TRAFFT_AUTH_PATH: "/token",
  TRAFFT_ENABLE_EXPERIMENTAL_READS: "false",
  TRAFFT_LIVE_VALIDATION_ACK: "READ_ONLY_ONLY"
};

test("accepts exact origin and exact allowlisted host", () => {
  assert.deepEqual(validateLiveEnvironment(base), { ok: true, code: "ok" });
});

test("rejects an API URL containing the API path without echoing it", () => {
  const result = validateLiveEnvironment({ ...base, TRAFFT_API_URL: "https://api.example.com/api/v2" });
  assert.deepEqual(result, { ok: false, code: "api-url-has-path" });
  assert.equal(JSON.stringify(result).includes("api.example.com"), false);
});

test("rejects a hostname mismatch without echoing either hostname", () => {
  const result = validateLiveEnvironment({ ...base, TRAFFT_ALLOWED_HOSTS: "other.example.com" });
  assert.deepEqual(result, { ok: false, code: "api-host-not-allowlisted" });
  assert.equal(JSON.stringify(result).includes("example.com"), false);
});

test("rejects obsolete or unexpected authentication paths", () => {
  assert.equal(validateLiveEnvironment({ ...base, TRAFFT_AUTH_PATH: "/auth/token" }).code, "auth-path-unexpected");
  assert.equal(validateLiveEnvironment({ ...base, TRAFFT_AUTH_PATH: "/api/v2/token" }).code, "auth-path-unexpected");
});

test("rejects experimental reads and an invalid acknowledgment", () => {
  assert.equal(validateLiveEnvironment({ ...base, TRAFFT_ENABLE_EXPERIMENTAL_READS: "true" }).code, "experimental-reads-enabled");
  assert.equal(validateLiveEnvironment({ ...base, TRAFFT_LIVE_VALIDATION_ACK: "no" }).code, "ack-invalid");
});
