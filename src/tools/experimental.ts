import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TrafftClient } from "../client.js";
import { errorResult, textResult } from "../util.js";

const endpoints = [
  ["inspect_webhooks", "/webhooks"],
  ["inspect_notification_settings", "/notifications"],
  ["inspect_working_hours", "/working-hours"],
  ["inspect_special_days", "/special-days"],
  ["inspect_days_off", "/days-off"],
  ["inspect_account_settings", "/settings"]
] as const;

export function registerExperimentalReadTools(server: McpServer, client: TrafftClient, maxChars: number): void {
  for (const [name, path] of endpoints) {
    server.tool(name, `Experimental read-only probe for ${path}. Enable only after endpoint review.`, {}, async () => {
      try { return textResult(await client.get(path), maxChars); }
      catch (error) { return errorResult(error); }
    });
  }
}
