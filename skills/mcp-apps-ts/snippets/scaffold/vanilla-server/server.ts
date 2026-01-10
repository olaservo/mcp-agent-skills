/**
 * MCP App Server Scaffold (Vanilla JS)
 *
 * This is a complete, runnable MCP server with an interactive HTML UI.
 *
 * Quick Start:
 *   npm install && npm run dev
 *
 * Customize:
 *   1. Replace "get-time" with your tool name
 *   2. Update inputSchema for your parameters
 *   3. Modify the handler to return your data
 *   4. Update RESOURCE_URI to match
 *
 * Test with basic-host:
 *   git clone https://github.com/modelcontextprotocol/ext-apps
 *   cd ext-apps/examples/basic-host && npm install && npm start
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE, RESOURCE_URI_META_KEY } from "@modelcontextprotocol/ext-apps/server";
import { startServer } from "./server-utils.js";

// ==================== CONFIGURATION ====================
// Customize these for your app

const DIST_DIR = path.join(import.meta.dirname, "dist");
const RESOURCE_URI = "ui://get-time/mcp-app.html"; // Change to match your tool name

/**
 * Creates a new MCP server instance with tools and resources registered.
 * Each HTTP session needs its own server instance because McpServer only supports one transport.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "MCP App Server (Vanilla JS)", // Customize server name
    version: "1.0.0",
  });

  // ==================== TOOL REGISTRATION ====================
  // MCP Apps require two-part registration:
  // 1. A tool (what the LLM calls)
  // 2. A resource (the UI it renders)
  // The `_meta` field links them together.

  registerAppTool(server,
    "get-time", // <- CUSTOMIZE: Your tool name
    {
      title: "Get Time", // <- CUSTOMIZE: Human-readable title
      description: "Returns the current server time as an ISO 8601 string.", // <- CUSTOMIZE
      inputSchema: {}, // <- CUSTOMIZE: Add your parameters here
      _meta: { [RESOURCE_URI_META_KEY]: RESOURCE_URI }, // Links tool to UI
    },
    async (): Promise<CallToolResult> => {
      // <- CUSTOMIZE: Your tool logic here
      const time = new Date().toISOString();
      return {
        content: [{ type: "text", text: JSON.stringify({ time }) }],
      };
    },
  );

  // ==================== RESOURCE REGISTRATION ====================
  // The resource serves the bundled HTML UI to the host.

  registerAppResource(server,
    RESOURCE_URI, // URI that matches the _meta link above
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE }, // "text/html;profile=mcp-app"
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");

      return {
        contents: [
          // The MIME type signals to hosts that this is an MCP App UI
          { uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    },
  );

  return server;
}

// ==================== ENTRY POINT ====================

async function main() {
  if (process.argv.includes("--stdio")) {
    // Stdio transport for CLI integration
    await createServer().connect(new StdioServerTransport());
  } else {
    // HTTP transport for web/remote access
    const port = parseInt(process.env.PORT ?? "3102", 10);
    await startServer(createServer, { port, name: "MCP App Server (Vanilla JS)" });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
