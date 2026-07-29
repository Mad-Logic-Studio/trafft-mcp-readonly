import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createJsonlAuditSink } from "./audit-log.js";
import { TrafftClient } from "./client.js";
import { loadConfig } from "./config.js";

interface ReadClient {
  get<T = unknown>(path: string): Promise<T>;
}

interface ProbeDefinition {
  name: string;
  listPath: string;
  detailBasePath?: string;
}

export interface ProbeResult {
  name: string;
  list: "ok" | "error";
  detail: "ok" | "skipped" | "error";
  hasRecords: boolean;
  recognizedFields: string[];
  errorCode?: string;
}

export interface ServiceExpectation {
  label: string;
  name: string;
  price?: number;
  capacity?: number;
}

export interface ServiceCheckResult {
  label: string;
  status: "matched" | "missing" | "mismatch";
}

export interface LiveValidationSummary {
  mode: "read-only";
  apiPath: string;
  experimentalReads: false;
  probes: ProbeResult[];
  serviceChecks: ServiceCheckResult[] | "not-configured";
  passed: boolean;
}

const PROBES: readonly ProbeDefinition[] = [
  { name: "services", listPath: "/services?limit=10&page=1", detailBasePath: "/services" },
  { name: "employees", listPath: "/employees?limit=10&page=1", detailBasePath: "/employees" },
  { name: "locations", listPath: "/locations?limit=10&page=1", detailBasePath: "/locations" },
  { name: "appointments", listPath: "/appointments?limit=5&page=1", detailBasePath: "/appointments" },
  { name: "customers", listPath: "/customers?limit=1&page=1", detailBasePath: "/customers" }
] as const;

const SAFE_FIELD_NAMES = new Set([
  "id",
  "uuid",
  "status",
  "name",
  "title",
  "price",
  "capacity",
  "max_capacity",
  "maxCapacity",
  "services",
  "service_ids",
  "serviceIds",
  "employees",
  "employee_ids",
  "employeeIds",
  "locations",
  "location_ids",
  "locationIds",
  "working_hours",
  "workingHours",
  "special_days",
  "specialDays",
  "days_off",
  "daysOff",
  "pagination",
  "meta"
]);

export async function runLiveValidation(
  client: ReadClient,
  apiPath: string,
  expectedServices: readonly ServiceExpectation[] = []
): Promise<LiveValidationSummary> {
  const probes: ProbeResult[] = [];
  let servicesPayload: unknown;

  for (const probe of PROBES) {
    try {
      const payload = await client.get(probe.listPath);
      if (probe.name === "services") servicesPayload = payload;
      const records = extractRecords(payload);
      const first = records[0];
      const recognizedFields = recognizedKeys(first ?? payload);
      let detail: ProbeResult["detail"] = "skipped";

      const id = extractId(first);
      if (probe.detailBasePath && id !== null) {
        try {
          const detailPayload = await client.get(`${probe.detailBasePath}/${encodeURIComponent(id)}`);
          recognizedFields.push(...recognizedKeys(detailPayload));
          detail = "ok";
        } catch {
          detail = "error";
        }
      }

      probes.push({
        name: probe.name,
        list: "ok",
        detail,
        hasRecords: records.length > 0,
        recognizedFields: [...new Set(recognizedFields)].sort()
      });
    } catch (error) {
      probes.push({
        name: probe.name,
        list: "error",
        detail: "skipped",
        hasRecords: false,
        recognizedFields: [],
        errorCode: classifyError(error)
      });
    }
  }

  const serviceChecks = expectedServices.length > 0
    ? reconcileServices(servicesPayload, expectedServices)
    : "not-configured";
  const probesPassed = probes.every((probe) => probe.list === "ok" && probe.detail !== "error");
  const servicesPassed = serviceChecks === "not-configured" || serviceChecks.every((check) => check.status === "matched");

  return {
    mode: "read-only",
    apiPath,
    experimentalReads: false,
    probes,
    serviceChecks,
    passed: probesPassed && servicesPassed
  };
}

export function parseExpectedServices(raw: string | undefined): ServiceExpectation[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("TRAFFT_EXPECTED_SERVICES_JSON must contain valid JSON.");
  }
  if (!Array.isArray(parsed)) throw new Error("TRAFFT_EXPECTED_SERVICES_JSON must be an array.");

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`Expected service ${index + 1} must be an object.`);
    const record = entry as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!label || !name) throw new Error(`Expected service ${index + 1} requires label and name.`);
    const price = optionalFiniteNumber(record.price, `Expected service ${label} price`);
    const capacity = optionalFiniteNumber(record.capacity, `Expected service ${label} capacity`);
    return { label, name, ...(price === undefined ? {} : { price }), ...(capacity === undefined ? {} : { capacity }) };
  });
}

async function main(): Promise<void> {
  if (process.env.TRAFFT_LIVE_VALIDATION_ACK !== "READ_ONLY_ONLY") {
    throw new Error("Set TRAFFT_LIVE_VALIDATION_ACK=READ_ONLY_ONLY to run the controlled live validator.");
  }

  const config = loadConfig();
  if (config.enableExperimentalReads) throw new Error("Live validation requires TRAFFT_ENABLE_EXPERIMENTAL_READS=false.");

  const client = new TrafftClient({
    apiUrl: config.apiUrl,
    apiPath: config.apiPath,
    authPath: config.authPath,
    allowedHosts: config.allowedHosts,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    timeoutMs: config.timeoutMs,
    maxHttpBodyBytes: config.maxHttpBodyBytes,
    maxRetries: config.maxRetries,
    audit: createJsonlAuditSink(config.auditLogPath)
  });

  const expected = parseExpectedServices(process.env.TRAFFT_EXPECTED_SERVICES_JSON);
  const summary = await runLiveValidation(client, config.apiPath, expected);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!summary.passed) process.exitCode = 1;
}

function extractRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  const envelopeKeys = ["data", "items", "records", "results", "customers", "employees", "locations", "services", "appointments"];
  for (const key of envelopeKeys) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter(isRecord);
    if (isRecord(value)) {
      for (const nestedKey of envelopeKeys) {
        const nested = value[nestedKey];
        if (Array.isArray(nested)) return nested.filter(isRecord);
      }
    }
  }
  return [];
}

function extractId(record: Record<string, unknown> | undefined): string | null {
  if (!record) return null;
  for (const key of ["id", "uuid"]) {
    const value = record[key];
    if ((typeof value === "string" && value.length > 0) || typeof value === "number") return String(value);
  }
  return null;
}

function recognizedKeys(payload: unknown): string[] {
  const target = isRecord(payload) ? payload : undefined;
  if (!target) return [];
  return Object.keys(target).filter((key) => SAFE_FIELD_NAMES.has(key));
}

function reconcileServices(payload: unknown, expected: readonly ServiceExpectation[]): ServiceCheckResult[] {
  const records = extractRecords(payload);
  return expected.map((expectation) => {
    const match = records.find((record) => normalizedString(readFirst(record, ["name", "service_name", "title"])) === normalizedString(expectation.name));
    if (!match) return { label: expectation.label, status: "missing" };

    const actualPrice = readFiniteNumber(match, ["price", "service_price", "amount"]);
    const actualCapacity = readFiniteNumber(match, ["capacity", "max_capacity", "maxCapacity", "max_people", "maxPeople"]);
    const priceMatches = expectation.price === undefined || actualPrice === expectation.price;
    const capacityMatches = expectation.capacity === undefined || actualCapacity === expectation.capacity;
    return { label: expectation.label, status: priceMatches && capacityMatches ? "matched" : "mismatch" };
  });
}

function readFirst(record: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) if (key in record) return record[key];
  return undefined;
}

function readFiniteNumber(record: Record<string, unknown>, keys: readonly string[]): number | undefined {
  const value = readFirst(record, keys);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function optionalFiniteNumber(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error(`${label} must be a finite number.`);
}

function normalizedString(value: unknown): string {
  return typeof value === "string" ? value.trim().toLocaleLowerCase("en-US") : "";
}

function classifyError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const status = message.match(/\((\d{3})\)/)?.[1];
  if (status) return `http-${status}`;
  if (message.includes("network request failed")) return "network";
  if (message.includes("authentication")) return "authentication";
  return "validation";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    const code = classifyError(error);
    process.stderr.write(`Live read-only validation failed (${code}).\n`);
    process.exitCode = 1;
  });
}
