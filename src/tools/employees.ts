import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { resourceId } from "../schemas.js";
import { buildQuery, errorResult, textResult } from "../util.js";

export function registerEmployeeTools(server: McpServer, client: TrafftClient, maxChars: number): void {
  server.tool("list_employees", "List Trafft employees without changing them.", {
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).optional()
  }, async (args) => {
    try { return textResult(await client.get(`/employees${buildQuery(args)}`), maxChars); }
    catch (error) { return errorResult(error); }
  });

  server.tool("get_employee", "Get one employee, including assigned-service data returned by Trafft.", {
    id: resourceId
  }, async ({ id }) => {
    try { return textResult(await client.get(`/employees/${encodeURIComponent(String(id))}`), maxChars); }
    catch (error) { return errorResult(error); }
  });
}
