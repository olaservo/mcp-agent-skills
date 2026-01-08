/**
 * Source: https://github.com/modelcontextprotocol/ext-apps/blob/main/examples/basic-host/src/implementation.ts
 *
 * Basic AppBridge setup for embedding MCP Apps.
 * Use this when building a host application that displays MCP App UIs.
 *
 * Customize:
 * - Update IMPLEMENTATION with your host's name and version
 * - Modify the handler implementations for your use case
 */

import {
  AppBridge,
  PostMessageTransport,
  RESOURCE_MIME_TYPE,
  getToolUiResourceUri,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

// Host implementation info
const IMPLEMENTATION = {
  name: "My MCP Host",
  version: "1.0.0",
};

// Logging helper
const log = {
  info: console.log.bind(console, "[HOST]"),
  error: console.error.bind(console, "[HOST]"),
};

/**
 * Create an AppBridge instance for managing an MCP App.
 *
 * @param mcpClient - Connected MCP client
 * @returns Configured AppBridge instance
 */
function createAppBridge(mcpClient: Client): AppBridge {
  const serverCapabilities = mcpClient.getServerCapabilities();

  const appBridge = new AppBridge(mcpClient, IMPLEMENTATION, {
    // Enable link opening from apps
    openLinks: {},
    // Pass server capabilities for tool/resource discovery
    serverTools: serverCapabilities?.tools,
    serverResources: serverCapabilities?.resources,
  });

  // Register basic handlers (see app-bridge-handlers.ts for full list)
  appBridge.onmessage = async (params) => {
    log.info("Message from app:", params);
    return {}; // Accept message
  };

  appBridge.onopenlink = async (params) => {
    log.info("Open link request:", params.url);
    window.open(params.url, "_blank", "noopener,noreferrer");
    return {}; // Accept request
  };

  return appBridge;
}

/**
 * Check if a tool has an associated UI resource.
 */
function toolHasUI(tool: Tool): boolean {
  return !!getToolUiResourceUri(tool);
}

/**
 * Fetch the UI resource HTML for a tool.
 */
async function fetchUIResource(
  mcpClient: Client,
  tool: Tool
): Promise<{ html: string; csp?: object } | null> {
  const uri = getToolUiResourceUri(tool);
  if (!uri) return null;

  log.info("Fetching UI resource:", uri);
  const resource = await mcpClient.readResource({ uri });

  if (!resource || resource.contents.length !== 1) {
    log.error("Invalid resource response");
    return null;
  }

  const content = resource.contents[0];

  // Verify it's an MCP App resource
  if (content.mimeType !== RESOURCE_MIME_TYPE) {
    log.error("Not an MCP App resource:", content.mimeType);
    return null;
  }

  // Extract HTML (text or base64)
  const html = "blob" in content ? atob(content.blob) : content.text;

  // Extract CSP metadata if present
  const csp = (content as any)._meta?.ui?.csp;

  return { html, csp };
}

/**
 * Connect AppBridge to an iframe and initialize the app.
 */
async function connectToIframe(
  appBridge: AppBridge,
  iframe: HTMLIFrameElement,
  uiResource: { html: string; csp?: object },
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
  // Pass iframe.contentWindow as both target and source for security
  await appBridge.connect(
    new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!)
  );

  // Send the HTML to the sandbox proxy
  log.info("Sending UI resource to sandbox");
  await appBridge.sendSandboxResourceReady({
    html: uiResource.html,
    csp: uiResource.csp,
  });

  // Wait for app to be ready
  log.info("Waiting for app to initialize...");
  await initializedPromise;
  log.info("App initialized");

  // Send tool input
  log.info("Sending tool input:", toolInput);
  appBridge.sendToolInput({ arguments: toolInput });

  // Send tool result when ready
  toolResultPromise.then(
    (result) => {
      log.info("Sending tool result");
      appBridge.sendToolResult(result);
    },
    (error) => {
      log.error("Tool failed, sending cancellation");
      appBridge.sendToolCancelled({
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  );
}

export {
  createAppBridge,
  toolHasUI,
  fetchUIResource,
  connectToIframe,
  IMPLEMENTATION,
};
