import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { errorResult, extractCollection, normalizedString, textResult } from "../util.js";

const expectedService = z.object({
  name: z.string().min(1),
  price: z.number().nonnegative().optional(),
  minimumCapacity: z.number().int().nonnegative().optional(),
  maximumCapacity: z.number().int().positive().optional()
});

export function registerReconciliationTools(server: McpServer, client: TrafftClient, maxChars: number): void {
  server.tool("compare_services_to_expected", "Compare live read-only service data with an approved expected list. No changes are made.", {
    expected: z.array(expectedService).min(1).max(50)
  }, async ({ expected }) => {
    try {
      const payload = await client.get("/services");
      const live = extractCollection(payload).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
      const report = expected.map((wanted) => {
        const matches = live.filter((record) => normalizedString(record.name ?? record.service_name ?? record.title) === normalizedString(wanted.name));
        if (matches.length !== 1) {
          return {
            expected: wanted,
            matchCount: matches.length,
            status: matches.length === 0 ? "missing" : "duplicate",
            live: matches
          };
        }

        const record = matches[0]!;
        const observed = {
          price: firstFiniteNumber(record, ["price", "service_price", "amount"]),
          minimumCapacity: firstFiniteNumber(record, ["minimumCapacity", "minimum_capacity", "minCapacity", "min_capacity"]),
          maximumCapacity: firstFiniteNumber(record, ["maximumCapacity", "maximum_capacity", "maxCapacity", "max_capacity", "capacity"])
        };
        const comparisons = {
          price: compareOptionalNumber(wanted.price, observed.price),
          minimumCapacity: compareOptionalNumber(wanted.minimumCapacity, observed.minimumCapacity),
          maximumCapacity: compareOptionalNumber(wanted.maximumCapacity, observed.maximumCapacity)
        };
        const mismatch = Object.values(comparisons).some((value) => value === "mismatch");
        const unverified = Object.values(comparisons).some((value) => value === "live-field-unavailable");
        return {
          expected: wanted,
          matchCount: 1,
          status: mismatch ? "mismatch" : unverified ? "found-field-unverified" : "matched",
          observed,
          comparisons,
          live: record
        };
      });
      return textResult({ liveServiceCount: live.length, report }, maxChars);
    } catch (error) { return errorResult(error); }
  });
}

function firstFiniteNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    const number = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
    if (Number.isFinite(number)) return number;
  }
  return undefined;
}

function compareOptionalNumber(expected: number | undefined, observed: number | undefined): "not-requested" | "match" | "mismatch" | "live-field-unavailable" {
  if (expected === undefined) return "not-requested";
  if (observed === undefined) return "live-field-unavailable";
  return Math.abs(expected - observed) < 0.000001 ? "match" : "mismatch";
}
