type TextContent = { content: { type: "text"; text: string }[]; isError?: boolean };

export function buildQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.append(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function textResult(data: unknown, maxChars: number): TextContent {
  const cleaned = stripEmpty(data);
  const serialized = JSON.stringify(cleaned);
  if (serialized.length <= maxChars) return { content: [{ type: "text", text: serialized }] };

  const base = {
    truncated: true,
    originalCharacters: serialized.length,
    message: "Response exceeded the MCP size limit. Use narrower filters, pagination, or a specific record ID."
  };
  let low = 0;
  let high = serialized.length;
  let best = JSON.stringify({ ...base, preview: "" });
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = JSON.stringify({ ...base, preview: serialized.slice(0, middle) });
    if (candidate.length <= maxChars) {
      best = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return { content: [{ type: "text", text: best }] };
}

export function errorResult(error: unknown): TextContent {
  const message = error instanceof Error ? redactSecrets(error.message) : "Unexpected Trafft MCP error.";
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

export function extractCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.items)) return record.items;
  if (record.data && typeof record.data === "object") {
    const nested = record.data as Record<string, unknown>;
    if (Array.isArray(nested.data)) return nested.data;
    if (Array.isArray(nested.items)) return nested.items;
  }
  return [];
}

export function normalizedString(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ") : "";
}

export function maskEmail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const [local, domain] = value.split("@");
  if (!local || !domain) return undefined;
  return `${local.slice(0, 1)}***@${domain}`;
}

function stripEmpty(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripEmpty);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === null || raw === undefined || raw === "") continue;
    result[key] = stripEmpty(raw);
  }
  return result;
}

function redactSecrets(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(/client[_-]?secret\s*[:=]\s*[^\s,;]+/gi, "clientSecret=[REDACTED]")
    .replace(/client[_-]?id\s*[:=]\s*[^\s,;]+/gi, "clientId=[REDACTED]")
    .slice(0, 500);
}
