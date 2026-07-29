import { readFileSync } from "node:fs";

const path = process.env.TRAFFT_AUDIT_LOG_PATH;
if (!path) throw new Error("Missing TRAFFT_AUDIT_LOG_PATH.");

const rawMinimum = process.env.TRAFFT_AUDIT_MIN_GET_EVENTS ?? "5";
if (!/^\d+$/.test(rawMinimum)) throw new Error("TRAFFT_AUDIT_MIN_GET_EVENTS must be an integer.");
const minimumGetEvents = Number(rawMinimum);
if (!Number.isSafeInteger(minimumGetEvents) || minimumGetEvents < 1 || minimumGetEvents > 50) {
  throw new Error("TRAFFT_AUDIT_MIN_GET_EVENTS must be between 1 and 50.");
}

const text = readFileSync(path, "utf8");
if (!text.trim()) throw new Error("Live validation audit log is empty.");

for (const secretName of ["TRAFFT_CLIENT_ID", "TRAFFT_CLIENT_SECRET"]) {
  const value = process.env[secretName];
  if (value && text.includes(value)) throw new Error(`Audit log contains ${secretName}.`);
}

const allowedKeys = new Set([
  "timestamp",
  "event",
  "method",
  "path",
  "status",
  "httpStatus",
  "durationMs",
  "attempt",
  "requestId"
]);

let authEvents = 0;
let getEvents = 0;
for (const [index, line] of text.trim().split("\n").entries()) {
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    throw new Error(`Audit line ${index + 1} is not valid JSON.`);
  }
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`Audit line ${index + 1} is not an object.`);
  for (const key of Object.keys(record)) if (!allowedKeys.has(key)) throw new Error(`Audit line ${index + 1} contains unapproved key ${key}.`);
  if (typeof record.path !== "string" || record.path.includes("?") || record.path.includes("@")) {
    throw new Error(`Audit line ${index + 1} contains an unsafe path.`);
  }
  if (record.method === "POST") {
    if (record.path !== "/token" || record.event !== "auth") throw new Error(`Audit line ${index + 1} contains an unapproved POST.`);
    authEvents += 1;
  } else if (record.method === "GET") {
    getEvents += 1;
  } else {
    throw new Error(`Audit line ${index + 1} contains unapproved method ${String(record.method)}.`);
  }
}

if (authEvents < 1) throw new Error("Audit log contains no authentication event.");
if (getEvents < minimumGetEvents) throw new Error(`Audit log contains fewer than ${minimumGetEvents} GET events.`);
process.stdout.write("Live audit metadata verification passed.\n");
