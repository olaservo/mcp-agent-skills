/**
 * Multi-Server Module - Connect to multiple MCP servers simultaneously
 *
 * Uses prefixed tool names (server__tool) to disambiguate between servers.
 * This is the recommended pattern when servers may have overlapping tool names.
 *
 * Usage:
 *   import {
 *     connectToAllServers,
 *     aggregateTools,
 *     callTool,
 *     disconnectAll,
 *     parseQualifiedName,
 *   } from './multi-server.js';
 *
 *   const clients = await connectToAllServers({
 *     "time": { url: "http://localhost:3001/mcp" },
 *     "weather": { url: "http://localhost:3002/mcp" },
 *   });
 *
 *   // Tools are prefixed with server name
 *   const tools = await aggregateTools(clients);
 *   // -> [{ name: "time__get-time", ... }, { name: "weather__get-forecast", ... }]
 *
 *   // Call using prefixed name
 *   const result = await callTool(clients, "time__get-time", {});
 *
 *   await disconnectAll(clients);
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool, Prompt, Resource, CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Separator between server name and tool/resource name */
export const SEPARATOR = "__";

// ============================================================================
// TYPES
// ============================================================================

/** HTTP server configuration */
export interface HttpServerConfig {
  url: string;
  headers?: Record<string, string>;
}

/** Server configurations keyed by name */
export type MultiServerConfig = Record<string, HttpServerConfig>;

/** Tool with qualified (prefixed) name */
export interface QualifiedTool extends Omit<Tool, "name"> {
  /** Qualified name: "server__tool" */
  name: string;
  /** Original tool name without prefix */
  originalName: string;
  /** Server this tool belongs to */
  serverName: string;
}

/** Prompt with qualified (prefixed) name */
export interface QualifiedPrompt extends Omit<Prompt, "name"> {
  name: string;
  originalName: string;
  serverName: string;
}

/** Resource with qualified (prefixed) URI */
export interface QualifiedResource extends Omit<Resource, "uri"> {
  /** Qualified URI: "server__original-uri" */
  uri: string;
  /** Original URI without prefix */
  originalUri: string;
  /** Server this resource belongs to */
  serverName: string;
}

/** Options for connecting to servers */
export interface ConnectOptions {
  /** Client info (name and version) */
  clientInfo?: { name: string; version: string };
  /** Client capabilities to declare */
  capabilities?: Record<string, unknown>;
  /** Continue connecting even if some servers fail */
  continueOnError?: boolean;
  /** Callback when a server connects successfully */
  onConnect?: (name: string, client: Client) => void;
  /** Callback when a server fails to connect */
  onError?: (name: string, error: Error) => void;
}

// ============================================================================
// NAME UTILITIES
// ============================================================================

/**
 * Create a qualified name by prefixing with server name.
 *
 * @example
 * qualifyName("weather", "get-forecast") // -> "weather__get-forecast"
 */
export function qualifyName(serverName: string, name: string): string {
  return `${serverName}${SEPARATOR}${name}`;
}

/**
 * Parse a qualified name into server and original name.
 *
 * @example
 * parseQualifiedName("weather__get-forecast")
 * // -> { serverName: "weather", name: "get-forecast" }
 *
 * @throws Error if name doesn't contain separator
 */
export function parseQualifiedName(qualifiedName: string): { serverName: string; name: string } {
  const separatorIndex = qualifiedName.indexOf(SEPARATOR);
  if (separatorIndex === -1) {
    throw new Error(
      `Invalid qualified name "${qualifiedName}": missing "${SEPARATOR}" separator. ` +
      `Expected format: "server${SEPARATOR}name"`
    );
  }
  return {
    serverName: qualifiedName.substring(0, separatorIndex),
    name: qualifiedName.substring(separatorIndex + SEPARATOR.length),
  };
}

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Connect to a single MCP server.
 */
export async function connectToServer(
  name: string,
  config: HttpServerConfig,
  options: ConnectOptions = {}
): Promise<Client> {
  const clientInfo = options.clientInfo ?? { name: "mcp-client", version: "1.0.0" };

  const transport = new StreamableHTTPClientTransport(new URL(config.url), {
    requestInit: config.headers ? { headers: config.headers } : undefined,
  });

  const client = new Client(clientInfo, { capabilities: options.capabilities });
  await client.connect(transport);

  return client;
}

/**
 * Connect to all servers defined in configuration.
 *
 * Connections are made in parallel. By default throws on first error.
 * Use `continueOnError: true` to connect to as many servers as possible.
 *
 * @example
 * ```typescript
 * const clients = await connectToAllServers({
 *   "time": { url: "http://localhost:3001/mcp" },
 *   "weather": { url: "http://localhost:3002/mcp" },
 * });
 * ```
 */
export async function connectToAllServers(
  config: MultiServerConfig,
  options: ConnectOptions = {}
): Promise<Map<string, Client>> {
  const { continueOnError = false, onConnect, onError } = options;
  const entries = Object.entries(config);

  console.log(`[multi-server] Connecting to ${entries.length} server(s)...`);

  const results = await Promise.allSettled(
    entries.map(async ([name, serverConfig]) => {
      try {
        const client = await connectToServer(name, serverConfig, options);
        onConnect?.(name, client);
        return { name, client, error: null };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(name, err);
        return { name, client: null, error: err };
      }
    })
  );

  const clients = new Map<string, Client>();
  const failures: Array<{ name: string; error: Error }> = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      const { name, client, error } = result.value;
      if (client) {
        clients.set(name, client);
        console.log(`[multi-server]   Connected: ${name}`);
      } else if (error) {
        failures.push({ name, error });
        console.warn(`[multi-server]   Failed: ${name} - ${error.message}`);
      }
    }
  }

  if (failures.length > 0 && !continueOnError) {
    await disconnectAll(clients);
    const names = failures.map((f) => f.name).join(", ");
    throw new Error(`Failed to connect to server(s): ${names}`);
  }

  console.log(`[multi-server] Connected to ${clients.size}/${entries.length} server(s)`);
  return clients;
}

/**
 * Disconnect from all servers gracefully.
 */
export async function disconnectAll(clients: Map<string, Client>): Promise<void> {
  const closePromises = Array.from(clients.entries()).map(async ([name, client]) => {
    try {
      await client.close();
    } catch (error) {
      console.warn(`[multi-server] Warning during cleanup of ${name}:`, error);
    }
  });

  await Promise.allSettled(closePromises);
  clients.clear();
}

// ============================================================================
// AGGREGATION (with qualified names)
// ============================================================================

/**
 * Get all tools from all connected servers with qualified names.
 *
 * Tool names are prefixed with server name: "server__tool-name"
 *
 * @example
 * ```typescript
 * const tools = await aggregateTools(clients);
 * // [
 * //   { name: "time__get-time", originalName: "get-time", serverName: "time", ... },
 * //   { name: "weather__get-forecast", originalName: "get-forecast", serverName: "weather", ... }
 * // ]
 * ```
 */
export async function aggregateTools(clients: Map<string, Client>): Promise<QualifiedTool[]> {
  const allTools: QualifiedTool[] = [];

  const results = await Promise.allSettled(
    Array.from(clients.entries()).map(async ([serverName, client]) => {
      const response = await client.listTools();
      return response.tools.map((tool) => ({
        ...tool,
        name: qualifyName(serverName, tool.name),
        originalName: tool.name,
        serverName,
      }));
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      allTools.push(...result.value);
    }
  }

  return allTools;
}

/**
 * Get all prompts from all connected servers with qualified names.
 */
export async function aggregatePrompts(clients: Map<string, Client>): Promise<QualifiedPrompt[]> {
  const allPrompts: QualifiedPrompt[] = [];

  const results = await Promise.allSettled(
    Array.from(clients.entries()).map(async ([serverName, client]) => {
      const response = await client.listPrompts();
      return response.prompts.map((prompt) => ({
        ...prompt,
        name: qualifyName(serverName, prompt.name),
        originalName: prompt.name,
        serverName,
      }));
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      allPrompts.push(...result.value);
    }
  }

  return allPrompts;
}

/**
 * Get all resources from all connected servers with qualified URIs.
 */
export async function aggregateResources(
  clients: Map<string, Client>
): Promise<QualifiedResource[]> {
  const allResources: QualifiedResource[] = [];

  const results = await Promise.allSettled(
    Array.from(clients.entries()).map(async ([serverName, client]) => {
      const response = await client.listResources();
      return response.resources.map((resource) => ({
        ...resource,
        uri: qualifyName(serverName, resource.uri),
        originalUri: resource.uri,
        serverName,
      }));
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      allResources.push(...result.value);
    }
  }

  return allResources;
}

// ============================================================================
// TOOL CALLING
// ============================================================================

/**
 * Call a tool using its qualified name (server__tool).
 *
 * @example
 * ```typescript
 * const result = await callTool(clients, "weather__get-forecast", { city: "Seattle" });
 * ```
 */
export async function callTool(
  clients: Map<string, Client>,
  qualifiedToolName: string,
  args: Record<string, unknown> = {}
): Promise<CallToolResult> {
  const { serverName, name: toolName } = parseQualifiedName(qualifiedToolName);

  const client = clients.get(serverName);
  if (!client) {
    throw new Error(
      `Server "${serverName}" not found. Available servers: ${Array.from(clients.keys()).join(", ")}`
    );
  }

  return (await client.callTool({
    name: toolName,
    arguments: args,
  })) as CallToolResult;
}

/**
 * Read a resource using its qualified URI (server__uri).
 *
 * @example
 * ```typescript
 * const content = await readResource(clients, "files__file:///data.json");
 * ```
 */
export async function readResource(
  clients: Map<string, Client>,
  qualifiedUri: string
): Promise<Awaited<ReturnType<Client["readResource"]>>> {
  const { serverName, name: uri } = parseQualifiedName(qualifiedUri);

  const client = clients.get(serverName);
  if (!client) {
    throw new Error(
      `Server "${serverName}" not found. Available servers: ${Array.from(clients.keys()).join(", ")}`
    );
  }

  return await client.readResource({ uri });
}

/**
 * Get a prompt using its qualified name (server__prompt).
 *
 * @example
 * ```typescript
 * const prompt = await getPrompt(clients, "templates__greeting", { name: "World" });
 * ```
 */
export async function getPrompt(
  clients: Map<string, Client>,
  qualifiedPromptName: string,
  args: Record<string, string> = {}
): Promise<Awaited<ReturnType<Client["getPrompt"]>>> {
  const { serverName, name: promptName } = parseQualifiedName(qualifiedPromptName);

  const client = clients.get(serverName);
  if (!client) {
    throw new Error(
      `Server "${serverName}" not found. Available servers: ${Array.from(clients.keys()).join(", ")}`
    );
  }

  return await client.getPrompt({ name: promptName, arguments: args });
}

// ============================================================================
// UTILITY
// ============================================================================

/**
 * Get a summary of all connected servers and their capabilities.
 */
export async function getServersSummary(clients: Map<string, Client>): Promise<
  Array<{
    name: string;
    serverVersion: ReturnType<Client["getServerVersion"]>;
    toolCount: number;
    promptCount: number;
    resourceCount: number;
  }>
> {
  const summaries = await Promise.all(
    Array.from(clients.entries()).map(async ([name, client]) => {
      const [tools, prompts, resources] = await Promise.allSettled([
        client.listTools(),
        client.listPrompts(),
        client.listResources(),
      ]);

      return {
        name,
        serverVersion: client.getServerVersion(),
        toolCount: tools.status === "fulfilled" ? tools.value.tools.length : 0,
        promptCount: prompts.status === "fulfilled" ? prompts.value.prompts.length : 0,
        resourceCount: resources.status === "fulfilled" ? resources.value.resources.length : 0,
      };
    })
  );

  return summaries;
}
