/**
 * Source: https://github.com/modelcontextprotocol/ext-apps/blob/main/examples/basic-server-vanillajs/src/mcp-app.ts
 *
 * Full-featured MCP App with all lifecycle handlers and messaging capabilities.
 *
 * Customize:
 * - Update app name and version
 * - Implement each handler for your use case
 * - Add your DOM element references
 */

import { App } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Logging helper for debugging
const log = {
  info: console.log.bind(console, "[APP]"),
  warn: console.warn.bind(console, "[APP]"),
  error: console.error.bind(console, "[APP]"),
};

// Helper to extract text content from tool result
function extractText(result: CallToolResult): string {
  const textContent = result.content?.find((c) => c.type === "text");
  return textContent ? textContent.text : "";
}

// DOM element references
const outputEl = document.getElementById("output")!;
const messageText = document.getElementById("message-text") as HTMLTextAreaElement;
const sendMessageBtn = document.getElementById("send-message-btn")!;
const logText = document.getElementById("log-text") as HTMLInputElement;
const sendLogBtn = document.getElementById("send-log-btn")!;
const linkUrl = document.getElementById("link-url") as HTMLInputElement;
const openLinkBtn = document.getElementById("open-link-btn")!;

// Create app instance
const app = new App({
  name: "Full Featured App",
  version: "1.0.0",
});

// ============================================================
// LIFECYCLE HANDLERS - Register BEFORE calling connect()
// ============================================================

/**
 * Called when the app is being torn down.
 * Use for cleanup: cancel pending requests, save state, etc.
 */
app.onteardown = async () => {
  log.info("App is being torn down");
  // Perform cleanup here
  return {};
};

/**
 * Called when tool input arguments are received.
 * This happens before the tool executes.
 */
app.ontoolinput = (params) => {
  log.info("Received tool input:", params);
  // params.arguments contains the tool call arguments
  // You can use this to show a loading state or preview
};

/**
 * Called when tool execution result is received.
 * This is the main handler for displaying tool output.
 */
app.ontoolresult = (result: CallToolResult) => {
  log.info("Received tool result:", result);

  // Handle text content
  const text = extractText(result);
  outputEl.textContent = text;

  // Handle structured content if available
  if (result.structuredContent) {
    log.info("Structured content:", result.structuredContent);
    // const data = result.structuredContent as YourType;
  }

  // Handle errors
  if (result.isError) {
    log.error("Tool returned error:", result);
    outputEl.textContent = "[Tool Error]";
  }
};

/**
 * Called on any error.
 */
app.onerror = (error: Error) => {
  log.error("App error:", error);
};

// ============================================================
// MESSAGING - Communicate with the host
// ============================================================

/**
 * Send a message to the host for display in the chat.
 */
sendMessageBtn.addEventListener("click", async () => {
  const signal = AbortSignal.timeout(5000);

  try {
    log.info("Sending message to host:", messageText.value);

    const { isError } = await app.sendMessage(
      {
        role: "user",
        content: [{ type: "text", text: messageText.value }],
      },
      { signal }
    );

    log.info("Message", isError ? "rejected" : "accepted");
  } catch (error) {
    log.error("Message send error:", signal.aborted ? "timed out" : error);
  }
});

/**
 * Send a log entry to the host.
 * Useful for debugging and audit trails.
 */
sendLogBtn.addEventListener("click", async () => {
  log.info("Sending log to host:", logText.value);

  await app.sendLog({
    level: "info",  // "debug" | "info" | "warning" | "error"
    data: logText.value,
  });
});

/**
 * Request the host to open a URL.
 * The host decides whether to allow this (security).
 */
openLinkBtn.addEventListener("click", async () => {
  log.info("Requesting host to open link:", linkUrl.value);

  const { isError } = await app.openLink({ url: linkUrl.value });

  log.info("Open link request", isError ? "rejected" : "accepted");
});

// ============================================================
// TOOL CALLING - Call server tools from the app
// ============================================================

// Example: Refresh button calls the tool again
document.getElementById("refresh-btn")?.addEventListener("click", async () => {
  try {
    log.info("Calling tool...");

    const result = await app.callServerTool({
      name: "get-time",
      arguments: {},
    });

    log.info("Tool result:", result);
    outputEl.textContent = extractText(result);
  } catch (error) {
    log.error("Tool call failed:", error);
    outputEl.textContent = "[ERROR]";
  }
});

// ============================================================
// CONNECT - Start the app
// ============================================================

// Connect to the host - this must be called after registering handlers
app.connect();
