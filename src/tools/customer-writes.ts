import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrafftWriteClient } from "../write-client.js";
import { errorResult, textResult } from "../util.js";

export function registerCustomerWriteTools(server: McpServer, client: TrafftWriteClient, maxChars: number): void {
  server.registerTool("create_customer", {
    title: "Create Trafft customer",
    description: "Create one customer in the live Trafft account. This changes live business data and requires the exact confirmation value CREATE_CUSTOMER.",
    inputSchema: z.object({
      firstName: z.string().trim().min(1).max(120),
      lastName: z.string().trim().min(1).max(120),
      email: z.string().trim().email().max(254),
      phone: z.string().trim().max(50).optional(),
      description: z.string().max(2000).optional(),
      confirm: z.literal("CREATE_CUSTOMER")
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  }, async ({ firstName, lastName, email, phone, description }) => {
    try {
      const result = await client.createCustomer({
        first_name: firstName,
        last_name: lastName,
        email,
        ...(phone ? { phone } : {}),
        ...(description !== undefined ? { description } : {})
      });
      return textResult(result, maxChars);
    } catch (error) {
      return errorResult(error);
    }
  });
}
