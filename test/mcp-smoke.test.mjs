import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppointmentTools } from "../build/tools/appointments.js";
import { registerAvailabilityTools } from "../build/tools/availability.js";
import { registerCustomerTools } from "../build/tools/customers.js";
import { registerEmployeeTools } from "../build/tools/employees.js";
import { registerLocationTools } from "../build/tools/locations.js";
import { registerReconciliationTools } from "../build/tools/reconciliation.js";
import { registerServiceTools } from "../build/tools/services.js";

const expectedTools = [
  "compare_services_to_expected",
  "find_duplicate_customers",
  "find_services_by_name",
  "get_available_times",
  "get_customer",
  "get_employee",
  "get_location",
  "get_service",
  "list_appointments",
  "list_customers",
  "list_employees",
  "list_locations",
  "list_services"
].sort();

test("MCP protocol exposes exactly the stable read-only V1 tools", async () => {
  const server = new McpServer({ name: "trafft-readonly-smoke", version: "0.2.0" });
  const readonlyClient = {
    get: async (path) => ({ data: [], requestedPath: path })
  };

  registerServiceTools(server, readonlyClient, 20_000);
  registerEmployeeTools(server, readonlyClient, 20_000);
  registerLocationTools(server, readonlyClient, 20_000);
  registerAppointmentTools(server, readonlyClient, 20_000);
  registerCustomerTools(server, readonlyClient, 20_000);
  registerAvailabilityTools(server, readonlyClient, 20_000);
  registerReconciliationTools(server, readonlyClient, 20_000);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "trafft-readonly-test-client", version: "0.2.0" });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport)
  ]);

  try {
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, expectedTools);
    assert.equal(names.some((name) => /^(create|update|delete|cancel|reschedule|set|change|patch)_/i.test(name)), false);

    const serviceResult = await client.callTool({ name: "list_services", arguments: { limit: 1 } });
    assert.notEqual(serviceResult.isError, true);
    assert.equal(serviceResult.content[0]?.type, "text");
    assert.match(serviceResult.content[0]?.text ?? "", /requestedPath/);

    const appointmentResult = await client.callTool({
      name: "list_appointments",
      arguments: {
        customerId: 22,
        employeeId: 7,
        serviceId: 11,
        locationId: 3,
        status: "approved",
        sortBy: "start_time",
        sortOrder: "desc",
        page: 2,
        limit: 5
      }
    });
    assert.notEqual(appointmentResult.isError, true);
    const appointmentPayload = JSON.parse(appointmentResult.content[0]?.text ?? "{}");
    assert.equal(
      appointmentPayload.requestedPath,
      "/appointments?page=2&limit=5&customerId=22&employeeId=7&serviceId=11&locationId=3&status=approved&sort_by=start_time&sort_order=desc"
    );

    const availabilityResult = await client.callTool({
      name: "get_available_times",
      arguments: {
        serviceId: 11,
        date: "2026-07-30",
        employeeId: 7,
        locationId: 3,
        additionalGuestCount: 2
      }
    });
    assert.notEqual(availabilityResult.isError, true);
    const availabilityPayload = JSON.parse(availabilityResult.content[0]?.text ?? "{}");
    assert.equal(
      availabilityPayload.requestedPath,
      "/available-times?calendar_start_date=2026-07-30&calendar_end_date=2026-07-30&service=11&employee=7&location=3&additional_guest_count=2"
    );
  } finally {
    await client.close();
    await server.close();
  }
});
