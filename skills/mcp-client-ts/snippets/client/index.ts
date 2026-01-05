/**
 * MCP Client Setup
 *
 * Source: Based on https://modelcontextprotocol.io/docs/develop/build-client
 * and https://github.com/modelcontextprotocol/typescript-sdk
 *
 * This snippet demonstrates basic MCP client initialization and usage.
 * Customize as needed for your use case.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * MCPClient - A wrapper class for MCP client operations
 *
 * Provides high-level methods for connecting to MCP servers
 * and interacting with tools, prompts, and resources.
 */
class MCPClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;

  constructor(name: string = "mcp-client", version: string = "1.0.0") {
    this.client = new Client(
      { name, version },
      {
        capabilities: {
          // Declare client capabilities here
          // roots: { listChanged: true },  // If you need to provide roots
          // sampling: {},                   // If you need sampling support
        },
      }
    );
  }

  /**
   * Connect to an MCP server via stdio transport
   */
  async connect(command: string, args: string[] = []): Promise<void> {
    this.transport = new StdioClientTransport({ command, args });
    await this.client.connect(this.transport);
  }

  /**
   * List all available tools from the server
   */
  async listTools() {
    return await this.client.listTools();
  }

  /**
   * Call a tool with the given name and arguments
   */
  async callTool(name: string, args: Record<string, unknown> = {}) {
    return await this.client.callTool({ name, arguments: args });
  }

  /**
   * List all available prompts from the server
   */
  async listPrompts() {
    return await this.client.listPrompts();
  }

  /**
   * Get a specific prompt by name with optional arguments
   */
  async getPrompt(name: string, args: Record<string, string> = {}) {
    return await this.client.getPrompt({ name, arguments: args });
  }

  /**
   * List all available resources from the server
   */
  async listResources() {
    return await this.client.listResources();
  }

  /**
   * Read a specific resource by URI
   */
  async readResource(uri: string) {
    return await this.client.readResource({ uri });
  }

  /**
   * Get server instructions (if provided during initialization)
   *
   * Server instructions describe how to use the server's tools effectively.
   * They can be included in LLM system prompts to improve tool usage.
   */
  getServerInstructions(): string | undefined {
    return this.client.getInstructions();
  }

  /**
   * Close the connection and clean up
   */
  async close(): Promise<void> {
    await this.client.close();
  }
}

// Example usage
async function main() {
  const client = new MCPClient("my-client", "1.0.0");

  try {
    // Connect to a local MCP server
    await client.connect("node", ["path/to/server.js"]);

    // Get server instructions (if provided)
    const instructions = client.getServerInstructions();
    if (instructions) {
      console.log("Server instructions:", instructions);
    }

    // List available tools
    const tools = await client.listTools();
    console.log("Available tools:", tools.tools.map((t) => t.name));

    // Call a tool
    const result = await client.callTool("tool-name", { arg1: "value1" });
    console.log("Tool result:", result);

    // List and read resources
    const resources = await client.listResources();
    console.log("Available resources:", resources.resources.map((r) => r.uri));

    // Get a prompt
    const prompts = await client.listPrompts();
    console.log("Available prompts:", prompts.prompts.map((p) => p.name));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
  }
}

main();
