import {
  closeSync,
  constants,
  existsSync,
  fchmodSync,
  lstatSync,
  mkdirSync,
  openSync,
  writeSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import type { AuditEvent, AuditSink } from "./client.js";

export function createJsonlAuditSink(path: string): AuditSink {
  const absolutePath = resolve(path);
  mkdirSync(dirname(absolutePath), { recursive: true, mode: 0o700 });
  if (existsSync(absolutePath) && lstatSync(absolutePath).isSymbolicLink()) {
    throw new Error("TRAFFT_AUDIT_LOG_PATH must not be a symbolic link.");
  }

  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  const descriptor = openSync(
    absolutePath,
    constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY | noFollow,
    0o600
  );
  try {
    fchmodSync(descriptor, 0o600);
  } catch (error) {
    closeSync(descriptor);
    throw error;
  }

  return (event: AuditEvent): void => {
    const record = { timestamp: new Date().toISOString(), ...event };
    writeSync(descriptor, `${JSON.stringify(record)}\n`, undefined, "utf8");
  };
}
