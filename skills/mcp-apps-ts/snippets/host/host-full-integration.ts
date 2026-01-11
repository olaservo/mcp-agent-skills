/**
 * Source: https://github.com/modelcontextprotocol/ext-apps/blob/main/examples/basic-host/src/implementation.ts
 *
 * Complete host integration showing the full flow:
 * 1. Connect MCP client to server
 * 2. Call a tool
 * 3. Detect if tool has UI
 * 4. Fetch UI resource
 * 5. Set up sandbox iframe
 * 6. Initialize AppBridge and connect
 * 7. Send tool input/result to app
 *
 * Customize:
 * - Update SERVER_URL to your MCP server endpoint
 * - Update SANDBOX_PROXY_URL to where you serve sandbox-proxy.html
 * - Modify handlers for your application's needs
 *
 * Prerequisites:
 * - See mcp-client-ts skill for MCP client patterns
 * - Use sandbox-proxy.html snippet for the sandbox iframe
 */

import {
  AppBridge,
  PostMessageTransport,
  RESOURCE_MIME_TYPE,
  getToolUiResourceUri,
  type McpUiSandboxProxyReadyNotification,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

// Configuration
const SERVER_URL = new URL("http://localhost:3001/mcp");
const SANDBOX_PROXY_URL = new URL("http://localhost:8081/sandbox.html");
const IMPLEMENTATION = { name: "My MCP Host", version: "1.0.0" };

const log = {
  info: console.log.bind(console, "[HOST]"),
  error: console.error.bind(console, "[HOST]"),
};

// ============================================================
// STEP 1: Connect MCP Client
// ============================================================

interface ServerConnection {
  client: Client;
  tools: Map<string, Tool>;
}

async function connectToServer(): Promise<ServerConnection> {
  const client = new Client(IMPLEMENTATION);

  log.info("Connecting to server:", SERVER_URL.href);
  await client.connect(new StreamableHTTPClientTransport(SERVER_URL));
  log.info("Connected successfully");

  // List available tools
  const toolsList = await client.listTools();
  const tools = new Map(toolsList.tools.map((tool) => [tool.name, tool]));
  log.info("Available tools:", Array.from(tools.keys()));

  return { client, tools };
}

// ============================================================
// STEP 2: Call Tool and Check for UI
// ============================================================

interface ToolCallInfo {
  tool: Tool;
  hasUI: boolean;
  uiResourceUri?: string;
  resultPromise: Promise<CallToolResult>;
}

function callToolWithUICheck(
  client: Client,
  tools: Map<string, Tool>,
  toolName: string,
  args: Record<string, unknown>
): ToolCallInfo {
  const tool = tools.get(toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  log.info("Calling tool:", toolName, "with args:", args);

  // Start tool call (async)
  const resultPromise = client.callTool({
    name: toolName,
    arguments: args,
  }) as Promise<CallToolResult>;

  // Check if tool has UI
  const uiResourceUri = getToolUiResourceUri(tool);
  const hasUI = !!uiResourceUri;

  log.info("Tool has UI:", hasUI, uiResourceUri ? `(${uiResourceUri})` : "");

  return { tool, hasUI, uiResourceUri, resultPromise };
}

// ============================================================
// STEP 3: Fetch UI Resource
// ============================================================

interface UIResource {
  html: string;
  csp?: {
    connectDomains?: string[];
    resourceDomains?: string[];
  };
}

async function fetchUIResource(
  client: Client,
  uri: string
): Promise<UIResource> {
  log.info("Fetching UI resource:", uri);

  const resource = await client.readResource({ uri });

  if (!resource || resource.contents.length !== 1) {
    throw new Error(`Invalid resource response for ${uri}`);
  }

  const content = resource.contents[0];

  // Verify MIME type
  if (content.mimeType !== RESOURCE_MIME_TYPE) {
    throw new Error(`Not an MCP App resource: ${content.mimeType}`);
  }

  // Extract HTML (text or base64)
  const html = "blob" in content ? atob(content.blob) : content.text;

  // Extract CSP metadata
  const csp = (content as any)._meta?.ui?.csp;

  return { html, csp };
}

// ============================================================
// STEP 4: Set Up Sandbox Iframe
// ============================================================

async function loadSandboxProxy(iframe: HTMLIFrameElement): Promise<void> {
  // Prevent reload if already loaded
  if (iframe.src) return;

  // Set sandbox attributes for outer iframe
  // Note: Browser warns about allow-scripts + allow-same-origin, but security is
  // maintained because sandbox proxy is on a DIFFERENT ORIGIN than the host.
  // The double-iframe model prevents the inner app from accessing host DOM.
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");

  const readyNotification: McpUiSandboxProxyReadyNotification["method"] =
    "ui/notifications/sandbox-proxy-ready";

  // Wait for sandbox proxy to signal ready
  const readyPromise = new Promise<void>((resolve) => {
    const listener = ({ source, data }: MessageEvent) => {
      if (source === iframe.contentWindow && data?.method === readyNotification) {
        log.info("Sandbox proxy ready");
        window.removeEventListener("message", listener);
        resolve();
      }
    };
    window.addEventListener("message", listener);
  });

  log.info("Loading sandbox proxy...");
  iframe.src = SANDBOX_PROXY_URL.href;

  await readyPromise;
}

// ============================================================
// STEP 5: Create and Configure AppBridge
// ============================================================

function createAppBridge(client: Client): AppBridge {
  const serverCapabilities = client.getServerCapabilities();

  const appBridge = new AppBridge(client, IMPLEMENTATION, {
    openLinks: {},
    serverTools: serverCapabilities?.tools,
    serverResources: serverCapabilities?.resources,
  });

  // Register handlers BEFORE connecting

  appBridge.onmessage = async (params) => {
    log.info("Message from app:", params);
    // Display in your chat UI
    return {};
  };

  appBridge.onopenlink = async (params) => {
    log.info("Open link request:", params.url);
    window.open(params.url, "_blank", "noopener,noreferrer");
    return {};
  };

  appBridge.onloggingmessage = (params) => {
    console.log(`[APP ${params.level}]`, params.data);
  };

  appBridge.onsizechange = async ({ width, height }) => {
    // Handle size change - see app-bridge-handlers.ts for full implementation
    log.info("Size change:", { width, height });
  };

  return appBridge;
}

// ============================================================
// STEP 6: Initialize App
// ============================================================

async function initializeApp(
  iframe: HTMLIFrameElement,
  appBridge: AppBridge,
  uiResource: UIResource,
  toolInput: Record<string, unknown>,
  toolResultPromise: Promise<CallToolResult>
): Promise<void> {
  // Hook to know when app is initialized
  const initializedPromise = new Promise<void>((resolve) => {
    const original = appBridge.oninitialized;
    appBridge.oninitialized = (...args) => {
      resolve();
      appBridge.oninitialized = original;
      original?.(...args);
    };
  });

  // Connect via PostMessageTransport
  log.info("Connecting AppBridge to sandbox...");
  await appBridge.connect(
    new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!)
  );

  // Send HTML to sandbox proxy
  log.info("Sending UI resource to sandbox...");
  await appBridge.sendSandboxResourceReady({
    html: uiResource.html,
    csp: uiResource.csp,
  });

  // Wait for app to initialize
  log.info("Waiting for app to initialize...");
  await initializedPromise;
  log.info("App initialized!");

  // Send tool input
  log.info("Sending tool input:", toolInput);
  appBridge.sendToolInput({ arguments: toolInput });

  // Send tool result when ready
  toolResultPromise.then(
    (result) => {
      log.info("Sending tool result to app");
      appBridge.sendToolResult(result);
    },
    (error) => {
      log.error("Tool failed:", error);
      appBridge.sendToolCancelled({
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  );
}

// ============================================================
// COMPLETE FLOW EXAMPLE
// ============================================================

async function runCompleteFlow(
  container: HTMLElement,
  toolName: string,
  toolArgs: Record<string, unknown>
): Promise<void> {
  // 1. Connect to server
  const { client, tools } = await connectToServer();

  // 2. Call tool and check for UI
  const toolCall = callToolWithUICheck(client, tools, toolName, toolArgs);

  if (!toolCall.hasUI || !toolCall.uiResourceUri) {
    // No UI - just wait for result
    const result = await toolCall.resultPromise;
    log.info("Tool result (no UI):", result);
    return;
  }

  // 3. Fetch UI resource
  const uiResource = await fetchUIResource(client, toolCall.uiResourceUri);

  // 4. Create sandbox iframe
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "width: 100%; height: 400px; border: 1px solid #ccc;";
  container.appendChild(iframe);

  await loadSandboxProxy(iframe);

  // 5. Create AppBridge
  const appBridge = createAppBridge(client);

  // 6. Initialize app
  await initializeApp(
    iframe,
    appBridge,
    uiResource,
    toolArgs,
    toolCall.resultPromise
  );

  log.info("MCP App is now running!");
}

// Usage:
// const container = document.getElementById("app-container")!;
// await runCompleteFlow(container, "get-time", {});

export {
  connectToServer,
  callToolWithUICheck,
  fetchUIResource,
  loadSandboxProxy,
  createAppBridge,
  initializeApp,
  runCompleteFlow,
};
