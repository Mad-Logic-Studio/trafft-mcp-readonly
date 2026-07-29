import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { resourceId } from "../schemas.js";
import { buildQuery, errorResult, textResult } from "../util.js";

export function registerAppointmentTools(server: McpServer, client: TrafftClient, maxChars: number): void {
  server.tool("list_appointments", "List appointments with Trafft's documented read-only filters.", {
    customerId: resourceId.optional(),
    employeeId: resourceId.optional(),
    serviceId: resourceId.optional(),
    locationId: resourceId.optional(),
    status: z.enum(["approved", "pending", "canceled", "rejected", "no_show"]).optional(),
    sortBy: z.enum(["start_time", "created_at"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).optional()
  }, async (args) => {
    const query = buildQuery({
      page: args.page,
      limit: args.limit,
      customerId: args.customerId,
      employeeId: args.employeeId,
      serviceId: args.serviceId,
      locationId: args.locationId,
      status: args.status,
      sort_by: args.sortBy,
      sort_order: args.sortOrder
    });
    try { return textResult(await client.get(`/appointments${query}`), maxChars); }
    catch (error) { return errorResult(error); }
  });
}
