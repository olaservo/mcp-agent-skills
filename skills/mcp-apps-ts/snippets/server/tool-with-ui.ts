/**
 * Source: https://github.com/modelcontextprotocol/ext-apps/blob/main/examples/basic-server-vanillajs/server.ts
 *
 * Register an MCP tool with an associated UI resource.
 * The tool and UI are linked via the `_meta[RESOURCE_URI_META_KEY]` property.
 *
 * Customize:
 * - Replace "get-time" with your tool name
 * - Update inputSchema for your tool's parameters
 * - Modify the handler to return your tool's result
 * - Update the resourceUri to match your tool
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
  RESOURCE_URI_META_KEY
} from "@modelcontextprotocol/ext-apps/server";

// Directory where bundled UI HTML is located (after vite build)
const DIST_DIR = path.join(import.meta.dirname, "dist");

/**
 * Creates an MCP server with a tool that has an associated UI.
 */
function createServer(): McpServer {
  const server = new McpServer({
    name: "My MCP App Server",
    version: "1.0.0",
  });

  // Two-part registration: tool + resource, tied together by the resource URI.
  const resourceUri = "ui://get-time/mcp-app.html";

  // 1. Register the tool with UI metadata
  // The host reads `_meta[RESOURCE_URI_META_KEY]` to know which resource to fetch
  registerAppTool(
    server,
    "get-time",
    {
      title: "Get Time",
      description: "Returns the current server time as an ISO 8601 string.",
      inputSchema: {},
      _meta: { [RESOURCE_URI_META_KEY]: resourceUri },
    },
    async (): Promise<CallToolResult> => {
      const time = new Date().toISOString();
      return { content: [{ type: "text", text: time }] };
    }
  );

  // 2. Register the UI resource
  // Returns the bundled HTML/JavaScript for the interactive UI
  registerAppResource(
    server,
    resourceUri,  // Resource name (can match URI)
    resourceUri,  // Resource URI
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      // Read the bundled HTML from dist directory
      const html = await fs.readFile(
        path.join(DIST_DIR, "mcp-app.html"),
        "utf-8"
      );

      return {
        contents: [
          { uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    }
  );

  return server;
}

// Example: Start the server with HTTP transport
// See mcp-server-ts skill for transport setup details
export { createServer };
