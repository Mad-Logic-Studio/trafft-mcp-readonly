import assert from "node:assert/strict";
import test from "node:test";
import { parseExpectedServices, runLiveValidation } from "../build/live-validation.js";

test("live validator emits only sanitized metadata and expected-service results", async () => {
  const requested = [];
  const sensitiveValues = [
    "Private Service Name",
    "sunflower@example.com",
    "+18015550123",
    "Private Customer",
    "Private Employee"
  ];

  const payloads = new Map([
    ["/services?limit=10&page=1", { data: [{ id: 11, name: "Private Service Name", price: 44, capacity: 1, email: "sunflower@example.com" }] }],
    ["/services/11", { id: 11, name: "Private Service Name", price: 44, capacity: 1, employees: [{ id: 7, name: "Private Employee" }] }],
    ["/employees?limit=10&page=1", { data: [{ id: 7, name: "Private Employee", email: "sunflower@example.com" }] }],
    ["/employees/7", { id: 7, name: "Private Employee", services: [11], working_hours: [] }],
    ["/locations?limit=10&page=1", { data: [{ id: 3, name: "Private Location", phone: "+18015550123" }] }],
    ["/locations/3", { id: 3, name: "Private Location" }],
    ["/appointments?limit=5&page=1", { data: [] }],
    ["/customers?limit=1&page=1", { data: [{ id: 22, name: "Private Customer", email: "sunflower@example.com" }] }],
    ["/customers/22", { id: 22, name: "Private Customer", phone: "+18015550123" }]
  ]);

  const client = {
    async get(path) {
      requested.push(path);
      if (!payloads.has(path)) throw new Error("Unexpected test path");
      return payloads.get(path);
    }
  };

  const summary = await runLiveValidation(client, "/api/v2", [
    { label: "approved-service", name: "Private Service Name", price: 44, capacity: 1 }
  ]);

  assert.equal(summary.mode, "read-only");
  assert.equal(summary.experimentalReads, false);
  assert.equal(summary.passed, true);
  assert.deepEqual(summary.serviceChecks, [{ label: "approved-service", status: "matched" }]);
  assert.ok(requested.every((path) => path.startsWith("/")));
  assert.ok(requested.includes("/services/11"));
  assert.ok(requested.includes("/employees/7"));
  assert.ok(requested.includes("/locations/3"));
  assert.ok(requested.includes("/customers/22"));

  const serialized = JSON.stringify(summary);
  for (const value of sensitiveValues) assert.equal(serialized.includes(value), false);
});

test("live validator classifies a failed endpoint without echoing its error body", async () => {
  const client = {
    async get(path) {
      if (path.startsWith("/services")) throw new Error("Trafft API GET /services failed (403). secret-body");
      return { data: [] };
    }
  };

  const summary = await runLiveValidation(client, "/api/v2");
  assert.equal(summary.passed, false);
  assert.equal(summary.probes[0].errorCode, "http-403");
  assert.equal(JSON.stringify(summary).includes("secret-body"), false);
});

test("expected service configuration accepts only bounded public expectations", () => {
  assert.deepEqual(
    parseExpectedServices('[{"label":"thirty-minute","name":"30-minute session","price":44,"capacity":1}]'),
    [{ label: "thirty-minute", name: "30-minute session", price: 44, capacity: 1 }]
  );
  assert.throws(() => parseExpectedServices("not-json"), /valid JSON/);
  assert.throws(() => parseExpectedServices('[{"label":"missing-name"}]'), /requires label and name/);
  assert.throws(() => parseExpectedServices('[{"label":"bad-price","name":"Service","price":"44"}]'), /finite number/);
});
