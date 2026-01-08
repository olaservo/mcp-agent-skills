/**
 * Source: https://github.com/modelcontextprotocol/ext-apps/blob/main/examples/basic-server-vanillajs/src/mcp-app.ts
 *
 * Basic MCP App using vanilla JavaScript.
 * This is the minimal setup to receive tool results and display them.
 *
 * Customize:
 * - Update the app name and version
 * - Modify ontoolresult to handle your tool's response format
 * - Add your UI update logic
 */

import { App } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Helper to extract text from tool result
function extractText(result: CallToolResult): string {
  const textContent = result.content?.find((c) => c.type === "text");
  return textContent ? textContent.text : "";
}

// Get DOM element references
const outputEl = document.getElementById("output")!;
const refreshBtn = document.getElementById("refresh-btn")!;

// Create app instance with name and version
const app = new App({
  name: "My MCP App",
  version: "1.0.0",
});

// Register the tool result handler BEFORE connecting
// This is called when the host sends the tool execution result
app.ontoolresult = (result: CallToolResult) => {
  console.log("Received tool result:", result);

  // Extract and display the result
  const text = extractText(result);
  outputEl.textContent = text;

  // If using structuredContent:
  // const data = result.structuredContent as YourType;
};

// Handle errors
app.onerror = (error: Error) => {
  console.error("App error:", error);
  outputEl.textContent = `Error: ${error.message}`;
};

// Wire up UI interactions
refreshBtn.addEventListener("click", async () => {
  try {
    // Call the server tool that triggered this app
    const result = await app.callServerTool({
      name: "get-time",  // Your tool name
      arguments: {},
    });

    // Update UI with result
    outputEl.textContent = extractText(result);
  } catch (error) {
    console.error("Tool call failed:", error);
    outputEl.textContent = "[ERROR]";
  }
});

// Connect to the host
// This initiates the handshake with the host application
app.connect();
