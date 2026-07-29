import { readFileSync, readdirSync } from "node:fs";

const toolDirectory = new URL("../src/tools/", import.meta.url);
const toolFiles = readdirSync(toolDirectory).filter((name) => name.endsWith(".ts"));
const toolSource = toolFiles.map((name) => readFileSync(new URL(name, toolDirectory), "utf8")).join("\n");
const clientSource = readFileSync(new URL("../src/client.ts", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const securitySource = readFileSync(new URL("../src/security.ts", import.meta.url), "utf8");

const failures = [];
const allToolNames = [...toolSource.matchAll(/server\.tool\(\s*["']([^"']+)["']/g)].map((match) => match[1]);
const forbiddenToolNames = allToolNames.filter((name) => /^(create|update|delete|cancel|reschedule|set|change|patch)_/i.test(name));
if (forbiddenToolNames.length) failures.push(`Forbidden write-like MCP tools: ${forbiddenToolNames.join(", ")}`);

for (const method of ["post", "put", "patch", "delete"]) {
  if (new RegExp(`client\\.${method}\\s*\\(`).test(toolSource)) failures.push(`Tool source calls client.${method}().`);
}
if (!clientSource.includes('assertReadOnlyMethod(method, path, this.authPath)')) failures.push("REST request path is missing the read-only method assertion.");
if (!clientSource.includes('redirect: "error"')) failures.push("Fetch redirect refusal is missing.");
if (!clientSource.includes("readBodyWithLimit")) failures.push("Streaming response-size enforcement is missing.");
if (!securitySource.includes("API request escaped the configured API path")) failures.push("API path confinement check is missing.");
if (/register(?:Booking|Coupon)Tools/.test(indexSource)) failures.push("Index registers an upstream write-capable tool module.");
if (!indexSource.includes("if (config.enableExperimentalReads)")) failures.push("Experimental tools are not gated.");

const stableExpected = new Set([
  "list_services", "get_service", "find_services_by_name",
  "list_employees", "get_employee", "list_locations", "get_location",
  "list_appointments", "list_customers", "get_customer",
  "find_duplicate_customers", "get_available_times", "compare_services_to_expected"
]);
const experimental = new Set(["inspect_webhooks", "inspect_notification_settings", "inspect_working_hours", "inspect_special_days", "inspect_days_off", "inspect_account_settings"]);
const stableActual = new Set(allToolNames.filter((name) => !experimental.has(name)));
for (const name of stableExpected) if (!stableActual.has(name)) failures.push(`Missing stable MCP tool: ${name}`);
for (const name of stableActual) if (!stableExpected.has(name)) failures.push(`Unexpected stable MCP tool: ${name}`);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Read-only policy check passed: ${stableActual.size} stable and ${experimental.size} gated experimental tools.`);
