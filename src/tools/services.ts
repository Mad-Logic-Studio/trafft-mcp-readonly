import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { resourceId } from "../schemas.js";
import { buildQuery, errorResult, extractCollection, normalizedString, textResult } from "../util.js";

export function registerServiceTools(server: McpServer, client: TrafftClient, maxChars: number): void {
  server.tool("list_services", "List Trafft services without changing them.", {
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).optional()
  }, async (args) => {
    try { return textResult(await client.get(`/services${buildQuery(args)}`), maxChars); }
    catch (error) { return errorResult(error); }
  });

  server.tool("get_service", "Get one Trafft service by ID without changing it.", {
    id: resourceId
  }, async ({ id }) => {
    try { return textResult(await client.get(`/services/${encodeURIComponent(String(id))}`), maxChars); }
    catch (error) { return errorResult(error); }
  });

  server.tool("find_services_by_name", "Find services by an exact or partial name, including price and capacity fields returned by Trafft.", {
    name: z.string().min(1),
    exact: z.boolean().optional().default(false)
  }, async ({ name, exact }) => {
    try {
      const payload = await client.get("/services");
      const needle = normalizedString(name);
      const matches = extractCollection(payload).filter((item) => {
        if (!item || typeof item !== "object") return false;
        const record = item as Record<string, unknown>;
        const candidate = normalizedString(record.name ?? record.service_name ?? record.title);
        return exact ? candidate === needle : candidate.includes(needle);
      });
      return textResult({ query: name, exact, count: matches.length, matches }, maxChars);
    } catch (error) { return errorResult(error); }
  });
}
