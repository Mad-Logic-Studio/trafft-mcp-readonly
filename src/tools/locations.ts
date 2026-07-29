import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { resourceId } from "../schemas.js";
import { buildQuery, errorResult, textResult } from "../util.js";

export function registerLocationTools(server: McpServer, client: TrafftClient, maxChars: number): void {
  server.tool("list_locations", "List Trafft locations without changing them.", {
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).optional()
  }, async (args) => {
    try { return textResult(await client.get(`/locations${buildQuery(args)}`), maxChars); }
    catch (error) { return errorResult(error); }
  });

  server.tool("get_location", "Get one Trafft location by ID without changing it.", {
    id: resourceId
  }, async ({ id }) => {
    try { return textResult(await client.get(`/locations/${encodeURIComponent(String(id))}`), maxChars); }
    catch (error) { return errorResult(error); }
  });
}
