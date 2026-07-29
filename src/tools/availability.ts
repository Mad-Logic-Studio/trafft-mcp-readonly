import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftClient } from "../client.js";
import { resourceId, isoDate } from "../schemas.js";
import { buildQuery, errorResult, textResult } from "../util.js";

export function registerAvailabilityTools(server: McpServer, client: TrafftClient, maxChars: number): void {
  server.tool("get_available_times", "Get Trafft-computed open times for one service on one date without creating a booking.", {
    serviceId: resourceId,
    date: isoDate,
    employeeId: resourceId.optional(),
    locationId: resourceId.optional(),
    additionalGuestCount: z.number().int().nonnegative().max(100).optional()
  }, async ({ serviceId, date, employeeId, locationId, additionalGuestCount }) => {
    const query = buildQuery({
      calendar_start_date: date,
      calendar_end_date: date,
      service: serviceId,
      employee: employeeId,
      location: locationId,
      additional_guest_count: additionalGuestCount
    });
    try { return textResult(await client.get(`/available-times${query}`), maxChars); }
    catch (error) { return errorResult(error); }
  });
}
