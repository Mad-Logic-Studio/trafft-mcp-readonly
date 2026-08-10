#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import "dotenv/config";
import { createTrafftMcpRuntime } from "./server-factory.js";

async function main(): Promise<void> {
  const { server } = await createTrafftMcpRuntime();
  await server.connect(new StdioServerTransport());

  const shutdown = async (): Promise<void> => {
    await server.close();
    process.exit(0);
  };

  process.once("SIGINT", () => { void shutdown(); });
  process.once("SIGTERM", () => { void shutdown(); });
  console.error("trafft-readonly MCP is running on stdio. Stable tools remain read-only.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown startup failure.";
  console.error(`Fatal error starting trafft-readonly MCP: ${message.slice(0, 500)}`);
  process.exit(1);
});
