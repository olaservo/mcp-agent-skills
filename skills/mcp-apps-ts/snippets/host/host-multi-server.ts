/**
 * Multi-Server MCP Apps Host
 *
 * Combines multi-server connection patterns with MCP Apps UI embedding.
 * Uses qualified names (server__tool) to disambiguate between servers.
 *
 * Key features:
 * - Connect to multiple MCP servers
 * - Route tool calls using qualified names (server__tool)
 * - Fetch UI resources from the correct server
 * - Manage AppBridge per active app
 *
 * Prerequisites:
 * - See mcp-client-ts skill for multi-server.ts (connection patterns)
 * - See host-full-integration.ts for single-server AppBridge setup
 * - Use sandbox-proxy.html for the sandbox iframe
 *
 * Usage:
 *   const host = new MultiServerAppHost({ ... });
 *   await host.connectAll();
 *   const tools = await host.listAllTools();
 *   // Tools have qualified names: "everything__echo", "memory__create_entities"
 *   await host.callToolWithUI(container, "everything__echo", { message: "hi" });
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

// ============================================================================
// CONSTANTS
// ============================================================================

/** Separator between server name and tool/resource name */
export const SEPARATOR = "__";

// ============================================================================
// TYPES
// ============================================================================

export interface ServerConfig {
  url: string;
  headers?: Record<string, string>;
}

export interface MultiServerAppHostConfig {
  /** Server configurations keyed by name */
  servers: Record<string, ServerConfig>;
  /** URL to sandbox-proxy.html (must be different origin than host) */
  sandboxProxyUrl: string;
  /** Client info */
  clientInfo?: { name: string; version: string };
}

/** Tool with qualified (prefixed) name */
export interface QualifiedTool extends Omit<Tool, "name"> {
  /** Qualified name: "server__tool" */
  name: string;
  /** Original tool name for display */
  originalName: string;
  /** Server this tool belongs to */
  serverName: string;
}

interface ServerConnection {
  client: Client;
  tools: Map<string, Tool>; // keyed by original name
}

interface UIResource {
  html: string;
  csp?: {
    connectDomains?: string[];
    resourceDomains?: string[];
  };
}

// ============================================================================
// NAME UTILITIES
// ============================================================================

/** Create a qualified name: server__name */
export function qualifyName(serverName: string, name: string): string {
  return `${serverName}${SEPARATOR}${name}`;
}

/** Parse a qualified name into server and original name */
export function parseQualifiedName(qualifiedName: string): { serverName: string; name: string } {
  const idx = qualifiedName.indexOf(SEPARATOR);
  if (idx === -1) {
    throw new Error(`Invalid qualified name "${qualifiedName}": missing "${SEPARATOR}"`);
  }
  return {
    serverName: qualifiedName.substring(0, idx),
    name: qualifiedName.substring(idx + SEPARATOR.length),
  };
}

// ============================================================================
// MULTI-SERVER APP HOST CLASS
// ============================================================================

export class MultiServerAppHost {
  private config: MultiServerAppHostConfig;
  private connections = new Map<string, ServerConnection>();
  private activeAppBridges = new Map<HTMLIFrameElement, AppBridge>();

  constructor(config: MultiServerAppHostConfig) {
    this.config = config;
  }

  // --------------------------------------------------------------------------
  // CONNECTION MANAGEMENT
  // --------------------------------------------------------------------------

  async connectAll(): Promise<void> {
    const entries = Object.entries(this.config.servers);
    console.log(`[MultiServerAppHost] Connecting to ${entries.length} server(s)...`);

    const results = await Promise.allSettled(
      entries.map(([name, serverConfig]) => this.connectToServer(name, serverConfig))
    );

    let successCount = 0;
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const name = entries[i][0];

      if (result.status === "fulfilled") {
        successCount++;
        console.log(`[MultiServerAppHost]   Connected: ${name}`);
      } else {
        console.error(`[MultiServerAppHost]   Failed: ${name} - ${result.reason}`);
      }
    }

    console.log(`[MultiServerAppHost] Connected to ${successCount}/${entries.length} server(s)`);
  }

  private async connectToServer(name: string, config: ServerConfig): Promise<void> {
    const clientInfo = this.config.clientInfo ?? { name: "multi-server-app-host", version: "1.0.0" };
    const client = new Client(clientInfo);

    const transport = new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: config.headers ? { headers: config.headers } : undefined,
    });

    await client.connect(transport);

    // List tools and cache them (by original name for lookup)
    const toolsList = await client.listTools();
    const tools = new Map(toolsList.tools.map((tool) => [tool.name, tool]));

    this.connections.set(name, { client, tools });
  }

  async disconnectAll(): Promise<void> {
    // Close all AppBridges first
    for (const appBridge of this.activeAppBridges.values()) {
      try {
        await appBridge.close();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    this.activeAppBridges.clear();

    // Then close all client connections
    const closePromises = Array.from(this.connections.entries()).map(async ([name, conn]) => {
      try {
        await conn.client.close();
      } catch (e) {
        console.warn(`[MultiServerAppHost] Error closing ${name}:`, e);
      }
    });

    await Promise.allSettled(closePromises);
    this.connections.clear();
  }

  // --------------------------------------------------------------------------
  // TOOL AGGREGATION
  // --------------------------------------------------------------------------

  /**
   * List all tools with qualified names (server__tool).
   */
  listAllTools(): QualifiedTool[] {
    const allTools: QualifiedTool[] = [];

    for (const [serverName, conn] of this.connections) {
      for (const tool of conn.tools.values()) {
        allTools.push({
          ...tool,
          name: qualifyName(serverName, tool.name),
          originalName: tool.name,
          serverName,
        });
      }
    }

    return allTools;
  }

  // --------------------------------------------------------------------------
  // TOOL CALLING WITH UI
  // --------------------------------------------------------------------------

  /**
   * Call a tool using its qualified name and embed UI if available.
   *
   * @param container - DOM element to embed the app iframe
   * @param qualifiedToolName - Qualified tool name (e.g., "weather__get-forecast")
   * @param args - Tool arguments
   */
  async callToolWithUI(
    container: HTMLElement,
    qualifiedToolName: string,
    args: Record<string, unknown> = {}
  ): Promise<{ serverName: string; result: CallToolResult; hasUI: boolean }> {
    const { serverName, name: toolName } = parseQualifiedName(qualifiedToolName);

    const conn = this.connections.get(serverName);
    if (!conn) {
      throw new Error(`Server "${serverName}" not found`);
    }

    const tool = conn.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool "${toolName}" not found on server "${serverName}"`);
    }

    console.log(`[MultiServerAppHost] Calling ${qualifiedToolName}`);

    // Start tool call
    const resultPromise = conn.client.callTool({
      name: toolName,
      arguments: args,
    }) as Promise<CallToolResult>;

    // Check if tool has UI
    const uiResourceUri = getToolUiResourceUri(tool);
    const hasUI = !!uiResourceUri;

    if (!hasUI) {
      const result = await resultPromise;
      return { serverName, result, hasUI: false };
    }

    // Has UI - fetch and embed it
    console.log(`[MultiServerAppHost] Tool has UI: ${uiResourceUri}`);

    const uiResource = await this.fetchUIResource(conn.client, uiResourceUri);

    // Create iframe and load sandbox
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "width: 100%; height: 400px; border: 1px solid #ccc;";
    container.innerHTML = "";
    container.appendChild(iframe);

    await this.loadSandboxProxy(iframe);

    // Create AppBridge
    const appBridge = this.createAppBridge(conn.client);
    this.activeAppBridges.set(iframe, appBridge);

    // Initialize app
    await this.initializeApp(iframe, appBridge, uiResource, args, resultPromise);

    const result = await resultPromise;
    return { serverName, result, hasUI: true };
  }

  /**
   * Call a tool without UI embedding.
   */
  async callTool(
    qualifiedToolName: string,
    args: Record<string, unknown> = {}
  ): Promise<{ serverName: string; result: CallToolResult }> {
    const { serverName, name: toolName } = parseQualifiedName(qualifiedToolName);

    const conn = this.connections.get(serverName);
    if (!conn) {
      throw new Error(`Server "${serverName}" not found`);
    }

    const result = (await conn.client.callTool({
      name: toolName,
      arguments: args,
    })) as CallToolResult;

    return { serverName, result };
  }

  // --------------------------------------------------------------------------
  // PRIVATE HELPERS
  // --------------------------------------------------------------------------

  private async fetchUIResource(client: Client, uri: string): Promise<UIResource> {
    const resource = await client.readResource({ uri });

    if (!resource || resource.contents.length !== 1) {
      throw new Error(`Invalid resource response for ${uri}`);
    }

    const content = resource.contents[0];

    if (content.mimeType !== RESOURCE_MIME_TYPE) {
      throw new Error(`Not an MCP App resource: ${content.mimeType}`);
    }

    const html = "blob" in content ? atob(content.blob) : content.text;
    const csp = (content as any)._meta?.ui?.csp;

    return { html, csp };
  }

  private async loadSandboxProxy(iframe: HTMLIFrameElement): Promise<void> {
    if (iframe.src) return;

    // Note: allow-scripts + allow-same-origin is safe because sandbox proxy
    // is on a DIFFERENT ORIGIN than the host.
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");

    const readyNotification: McpUiSandboxProxyReadyNotification["method"] =
      "ui/notifications/sandbox-proxy-ready";

    const readyPromise = new Promise<void>((resolve) => {
      const listener = ({ source, data }: MessageEvent) => {
        if (source === iframe.contentWindow && data?.method === readyNotification) {
          window.removeEventListener("message", listener);
          resolve();
        }
      };
      window.addEventListener("message", listener);
    });

    iframe.src = this.config.sandboxProxyUrl;
    await readyPromise;
  }

  private createAppBridge(client: Client): AppBridge {
    const serverCapabilities = client.getServerCapabilities();
    const clientInfo = this.config.clientInfo ?? { name: "multi-server-app-host", version: "1.0.0" };

    const appBridge = new AppBridge(client, clientInfo, {
      openLinks: {},
      serverTools: serverCapabilities?.tools,
      serverResources: serverCapabilities?.resources,
    });

    appBridge.onmessage = async (params) => {
      console.log("[MultiServerAppHost] Message from app:", params);
      return {};
    };

    appBridge.onopenlink = async (params) => {
      console.log("[MultiServerAppHost] Open link:", params.url);
      window.open(params.url, "_blank", "noopener,noreferrer");
      return {};
    };

    appBridge.onloggingmessage = (params) => {
      console.log(`[APP ${params.level}]`, params.data);
    };

    appBridge.onsizechange = async ({ width, height }) => {
      console.log("[MultiServerAppHost] Size change:", { width, height });
    };

    return appBridge;
  }

  private async initializeApp(
    iframe: HTMLIFrameElement,
    appBridge: AppBridge,
    uiResource: UIResource,
    toolInput: Record<string, unknown>,
    toolResultPromise: Promise<CallToolResult>
  ): Promise<void> {
    const initializedPromise = new Promise<void>((resolve) => {
      const original = appBridge.oninitialized;
      appBridge.oninitialized = (...args) => {
        resolve();
        appBridge.oninitialized = original;
        original?.(...args);
      };
    });

    await appBridge.connect(
      new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!)
    );

    await appBridge.sendSandboxResourceReady({
      html: uiResource.html,
      csp: uiResource.csp,
    });

    await initializedPromise;

    appBridge.sendToolInput({ arguments: toolInput });

    toolResultPromise.then(
      (result) => appBridge.sendToolResult(result),
      (error) => {
        appBridge.sendToolCancelled({
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    );
  }
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

/*
async function example() {
  const host = new MultiServerAppHost({
    servers: {
      "everything": { url: "http://localhost:3001/mcp" },
      "weather": { url: "http://localhost:3002/mcp" },
    },
    sandboxProxyUrl: "http://localhost:8081/sandbox-proxy.html",
    clientInfo: { name: "my-app-host", version: "1.0.0" },
  });

  try {
    await host.connectAll();

    // List all tools with qualified names
    const tools = host.listAllTools();
    console.log("Tools:", tools.map(t => `${t.name} (display: ${t.originalName})`));
    // ["everything__echo (display: echo)", "weather__get-forecast (display: get-forecast)"]

    // Call a tool with UI using qualified name
    const container = document.getElementById("app-container")!;
    const { serverName, result, hasUI } = await host.callToolWithUI(
      container,
      "everything__echo",
      { message: "Hello!" }
    );

    console.log(`Executed on ${serverName}, hasUI: ${hasUI}`);
    console.log("Result:", result);

  } finally {
    await host.disconnectAll();
  }
}
*/

export { getToolUiResourceUri, RESOURCE_MIME_TYPE };
