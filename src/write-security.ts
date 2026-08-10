import { normalizeApiPath, sanitizePath } from "./security.js";

export type AllowedWriteMethod = "POST";

const ALLOWED_WRITES = new Map<string, ReadonlySet<AllowedWriteMethod>>([
  ["/customers", new Set<AllowedWriteMethod>(["POST"])]
]);

export function assertAllowedWrite(method: string, path: string, writesEnabled: boolean): asserts method is AllowedWriteMethod {
  if (!writesEnabled) {
    throw new Error("Trafft write policy is disabled.");
  }

  const normalizedPath = normalizeApiPath(path, "Trafft write path");
  const allowedMethods = ALLOWED_WRITES.get(normalizedPath);
  if (!allowedMethods?.has(method as AllowedWriteMethod)) {
    throw new Error(`Trafft write policy blocked ${method} ${sanitizePath(path)}.`);
  }
}
