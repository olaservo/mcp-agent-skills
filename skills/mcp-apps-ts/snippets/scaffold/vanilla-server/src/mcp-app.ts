/**
 * MCP App - Vanilla JavaScript UI
 *
 * This file demonstrates the MCP App SDK with vanilla JS (no framework).
 * The App class handles communication with the host via postMessage.
 *
 * Key pattern: Register handlers BEFORE calling connect()
 */

// ==================== IMPORTS ====================

import { App, type McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./global.css";
import "./mcp-app.css";

// ==================== HELPERS ====================

const log = {
  info: console.log.bind(console, "[APP]"),
  warn: console.warn.bind(console, "[APP]"),
  error: console.error.bind(console, "[APP]"),
};

function extractTime(result: CallToolResult): string {
  const { text } = result.content?.find((c) => c.type === "text")!;
  return text;
}

// ==================== DOM REFERENCES ====================
// Get references to all interactive elements

const mainEl = document.querySelector(".main") as HTMLElement;
const serverTimeEl = document.getElementById("server-time")!;
const getTimeBtn = document.getElementById("get-time-btn")!;
const messageText = document.getElementById("message-text") as HTMLTextAreaElement;
const sendMessageBtn = document.getElementById("send-message-btn")!;
const logText = document.getElementById("log-text") as HTMLInputElement;
const sendLogBtn = document.getElementById("send-log-btn")!;
const linkUrl = document.getElementById("link-url") as HTMLInputElement;
const openLinkBtn = document.getElementById("open-link-btn")!;

// ==================== HOST CONTEXT HANDLER ====================
// Responds to host context changes (safe area insets, theme, etc.)

function handleHostContextChanged(ctx: McpUiHostContext) {
  if (ctx.safeAreaInsets) {
    mainEl.style.paddingTop = `${ctx.safeAreaInsets.top}px`;
    mainEl.style.paddingRight = `${ctx.safeAreaInsets.right}px`;
    mainEl.style.paddingBottom = `${ctx.safeAreaInsets.bottom}px`;
    mainEl.style.paddingLeft = `${ctx.safeAreaInsets.left}px`;
  }
}

// ==================== APP SETUP ====================
// Create app instance and register lifecycle handlers

const app = new App({ name: "Get Time App", version: "1.0.0" });

// Called when host tears down the app (navigation, close, etc.)
app.onteardown = async () => {
  log.info("App is being torn down");
  return {};
};

// Called when tool is invoked with input parameters
app.ontoolinput = (params) => {
  log.info("Received tool call input:", params);
};

// Called when tool execution completes with result
app.ontoolresult = (result) => {
  log.info("Received tool call result:", result);
  serverTimeEl.textContent = extractTime(result);
};

// Called on any error
app.onerror = log.error;

// Called when host context changes (safe areas, theme, etc.)
app.onhostcontextchanged = handleHostContextChanged;

// ==================== EVENT HANDLERS ====================
// Wire up UI buttons to app methods

// Call server tool directly from the UI
getTimeBtn.addEventListener("click", async () => {
  try {
    log.info("Calling get-time tool...");
    const result = await app.callServerTool({ name: "get-time", arguments: {} });
    log.info("get-time result:", result);
    serverTimeEl.textContent = extractTime(result);
  } catch (e) {
    log.error(e);
    serverTimeEl.textContent = "[ERROR]";
  }
});

// Send a message to the host (for agentic workflows)
sendMessageBtn.addEventListener("click", async () => {
  const signal = AbortSignal.timeout(5000);
  try {
    log.info("Sending message text to Host:", messageText.value);
    const { isError } = await app.sendMessage(
      { role: "user", content: [{ type: "text", text: messageText.value }] },
      { signal },
    );
    log.info("Message", isError ? "rejected" : "accepted");
  } catch (e) {
    log.error("Message send error:", signal.aborted ? "timed out" : e);
  }
});

// Send a log entry to the host
sendLogBtn.addEventListener("click", async () => {
  log.info("Sending log text to Host:", logText.value);
  await app.sendLog({ level: "info", data: logText.value });
});

// Request host to open a link (host decides how)
openLinkBtn.addEventListener("click", async () => {
  log.info("Sending open link request to Host:", linkUrl.value);
  const { isError } = await app.openLink({ url: linkUrl.value });
  log.info("Open link request", isError ? "rejected" : "accepted");
});

// ==================== CONNECT ====================
// Connect to host and apply initial context

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) {
    handleHostContextChanged(ctx);
  }
});
