import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createJsonlAuditSink } from "./audit-log.js";
import { TrafftClient } from "./client.js";
import { loadConfig, type RuntimeConfig } from "./config.js";
import { registerAppointmentTools } from "./tools/appointments.js";
import { registerAvailabilityTools } from "./tools/availability.js";
import { registerCustomerTools } from "./tools/customers.js";
import { registerEmployeeTools } from "./tools/employees.js";
import { registerExperimentalReadTools } from "./tools/experimental.js";
import { registerLocationTools } from "./tools/locations.js";
import { registerReconciliationTools } from "./tools/reconciliation.js";
import { registerServiceTools } from "./tools/services.js";

export interface TrafftMcpRuntime {
  server: McpServer;
  config: RuntimeConfig;
}

export async function createTrafftMcpRuntime(env: NodeJS.ProcessEnv = process.env): Promise<TrafftMcpRuntime> {
  const config = loadConfig(env);
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

  const server = new McpServer({ name: "trafft-readonly", version: "0.3.0" });
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

  return { server, config };
}
