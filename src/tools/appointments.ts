import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { resourceId, isoDate } from "../schemas.js";
import { buildQuery, errorResult, textResult } from "../util.js";

export function registerAppointmentTools(server: McpServer, client: TrafftClient, maxChars: number): void {
  server.tool("list_appointments", "List appointments with read-only filters.", {
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    employeeId: resourceId.optional(),
    serviceId: resourceId.optional(),
    customerId: resourceId.optional(),
    status: z.string().min(1).max(50).optional(),
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).optional()
  }, async (args) => {
    try { return textResult(await client.get(`/appointments${buildQuery(args)}`), maxChars); }
    catch (error) { return errorResult(error); }
  });

  server.tool("get_appointment", "Get one appointment by ID without changing it.", {
    id: resourceId
  }, async ({ id }) => {
    try { return textResult(await client.get(`/appointments/${encodeURIComponent(String(id))}`), maxChars); }
    catch (error) { return errorResult(error); }
  });
}
