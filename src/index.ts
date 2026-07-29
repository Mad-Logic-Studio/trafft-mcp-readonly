#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import "dotenv/config";
import { createJsonlAuditSink } from "./audit-log.js";
import { TrafftClient } from "./client.js";
import { loadConfig } from "./config.js";
import { registerAppointmentTools } from "./tools/appointments.js";
import { registerAvailabilityTools } from "./tools/availability.js";
import { registerCustomerTools } from "./tools/customers.js";
import { registerEmployeeTools } from "./tools/employees.js";
import { registerExperimentalReadTools } from "./tools/experimental.js";
import { registerLocationTools } from "./tools/locations.js";
import { registerReconciliationTools } from "./tools/reconciliation.js";
import { registerServiceTools } from "./tools/services.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new TrafftClient({
    apiUrl: config.apiUrl,
    apiPath: config.apiPath,
    authPath: config.authPath,
    allowedHosts: config.allowedHosts,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    timeoutMs: config.timeoutMs,
    maxHttpBodyBytes: config.maxHttpBodyBytes,
    maxRetries: config.maxRetries,
    audit: createJsonlAuditSink(config.auditLogPath)
  });

  await client.authenticate();

  const server = new McpServer({ name: "trafft-readonly", version: "0.1.0" });
  registerServiceTools(server, client, config.maxResponseChars);
  registerEmployeeTools(server, client, config.maxResponseChars);
  registerLocationTools(server, client, config.maxResponseChars);
  registerAppointmentTools(server, client, config.maxResponseChars);
  registerCustomerTools(server, client, config.maxResponseChars);
  registerAvailabilityTools(server, client, config.maxResponseChars);
  registerReconciliationTools(server, client, config.maxResponseChars);
  if (config.enableExperimentalReads) {
    registerExperimentalReadTools(server, client, config.maxResponseChars);
  }

  await server.connect(new StdioServerTransport());
  const shutdown = async (): Promise<void> => {
    await server.close();
    process.exit(0);
  };
  process.once("SIGINT", () => { void shutdown(); });
  process.once("SIGTERM", () => { void shutdown(); });
  console.error("trafft-readonly MCP is running on stdio. Write methods are not compiled into V1.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown startup failure.";
  console.error(`Fatal error starting trafft-readonly MCP: ${message.slice(0, 500)}`);
  process.exit(1);
});
