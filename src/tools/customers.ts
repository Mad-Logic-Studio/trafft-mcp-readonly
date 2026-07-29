import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { resourceId } from "../schemas.js";
import { buildQuery, errorResult, extractCollection, maskEmail, normalizedString, textResult } from "../util.js";

export function registerCustomerTools(server: McpServer, client: TrafftClient, maxChars: number): void {
  server.tool("list_customers", "List customers with optional search and pagination. This returns personal data; use only when needed.", {
    search: z.string().max(200).optional(),
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).optional()
  }, async (args) => {
    try { return textResult(await client.get(`/customers${buildQuery(args)}`), maxChars); }
    catch (error) { return errorResult(error); }
  });

  server.tool("get_customer", "Get one customer by ID without changing the record.", {
    id: resourceId
  }, async ({ id }) => {
    try { return textResult(await client.get(`/customers/${encodeURIComponent(String(id))}`), maxChars); }
    catch (error) { return errorResult(error); }
  });

  server.tool("find_duplicate_customers", "Identify likely duplicate customers by normalized email. Results mask email addresses.", {
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).optional().default(100)
  }, async (args) => {
    try {
      const payload = await client.get(`/customers${buildQuery(args)}`);
      const groups = new Map<string, Record<string, unknown>[]>();
      for (const item of extractCollection(payload)) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const email = normalizedString(record.email ?? record.customer_email);
        if (!email) continue;
        const existing = groups.get(email) ?? [];
        existing.push(record);
        groups.set(email, existing);
      }
      const duplicates = [...groups.entries()].filter(([, records]) => records.length > 1).map(([email, records]) => ({
        email: maskEmail(email),
        count: records.length,
        customerIds: records.map((record) => record.id ?? record.customer_id).filter((value) => value !== undefined)
      }));
      return textResult({ pageScopeOnly: true, duplicateGroups: duplicates.length, duplicates }, maxChars);
    } catch (error) { return errorResult(error); }
  });
}
