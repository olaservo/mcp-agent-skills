/**
 * Tool returning structuredContent alongside text content.
 *
 * structuredContent provides typed data that the UI can easily consume,
 * while text content provides a human-readable fallback.
 *
 * Customize:
 * - Define your outputSchema using Zod
 * - Return both content (text) and structuredContent (typed)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
  RESOURCE_URI_META_KEY
} from "@modelcontextprotocol/ext-apps/server";

// Define output schema for typed responses
const TimeOutputSchema = z.object({
  time: z.string().describe("ISO 8601 timestamp"),
  timezone: z.string().describe("Timezone identifier"),
  unix: z.number().describe("Unix timestamp in milliseconds"),
});

type TimeOutput = z.infer<typeof TimeOutputSchema>;

function createServerWithStructured(): McpServer {
  const server = new McpServer({
    name: "Structured Output Server",
    version: "1.0.0",
  });

  const resourceUri = "ui://get-time-structured/mcp-app.html";

  registerAppTool(
    server,
    "get-time-structured",
    {
      title: "Get Structured Time",
      description: "Returns server time with structured data for easy UI consumption.",
      inputSchema: {},
      // outputSchema helps document the expected response shape
      outputSchema: {
        time: { type: "string", description: "ISO 8601 timestamp" },
        timezone: { type: "string", description: "Timezone" },
        unix: { type: "number", description: "Unix timestamp" },
      },
      _meta: { [RESOURCE_URI_META_KEY]: resourceUri },
    },
    async (): Promise<CallToolResult> => {
      const now = new Date();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Prepare structured data
      const structured: TimeOutput = {
        time: now.toISOString(),
        timezone,
        unix: now.getTime(),
      };

      return {
        // Text content for human-readable output
        content: [
          {
            type: "text",
            text: `Current time: ${structured.time} (${structured.timezone})`,
          },
        ],
        // Structured content for programmatic access in UI
        structuredContent: structured,
      };
    }
  );

  // Register UI resource (see tool-with-ui.ts for full example)
  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      // Your bundled HTML here
      const html = "<!-- Your bundled HTML -->";
      return {
        contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    }
  );

  return server;
}

// In the UI app, access structured data like this:
// app.ontoolresult = (result) => {
//   const { time, timezone, unix } = result.structuredContent as TimeOutput;
//   // Use typed data directly
// };

export { createServerWithStructured, TimeOutputSchema, type TimeOutput };
