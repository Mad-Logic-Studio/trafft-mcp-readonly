import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { resourceId, isoDate } from "../schemas.js";
import { buildQuery, errorResult, textResult } from "../util.js";

export function registerAvailabilityTools(server: McpServer, client: TrafftClient, maxChars: number): void {
  server.tool("get_available_times", "Get Trafft-computed open times without creating a booking.", {
    serviceId: resourceId,
    date: isoDate,
    employeeId: resourceId.optional(),
    locationId: resourceId.optional()
  }, async (args) => {
    try { return textResult(await client.get(`/available-times${buildQuery(args)}`), maxChars); }
    catch (error) { return errorResult(error); }
  });
}
