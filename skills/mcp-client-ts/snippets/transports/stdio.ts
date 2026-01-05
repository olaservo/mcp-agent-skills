/**
 * StdioClientTransport - Connect to Local MCP Servers
 *
 * Source: Based on https://github.com/modelcontextprotocol/typescript-sdk
 *
 * Use StdioClientTransport when connecting to MCP servers that run as
 * local processes (spawned subprocesses). This is the most common transport
 * for CLI tools and desktop applications like Claude Desktop.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Connect to a Node.js MCP server
 */
async function connectToNodeServer(serverPath: string): Promise<Client> {
  const client = new Client(
    { name: "my-client", version: "1.0.0" },
    { capabilities: {} }
  );

  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath],
  });

  await client.connect(transport);
  return client;
}

/**
 * Connect to a Python MCP server
 */
async function connectToPythonServer(serverPath: string): Promise<Client> {
  const client = new Client(
    { name: "my-client", version: "1.0.0" },
    { capabilities: {} }
  );

  // Use 'python3' on macOS/Linux, 'python' on Windows
  const command = process.platform === "win32" ? "python" : "python3";

  const transport = new StdioClientTransport({
    command,
    args: [serverPath],
  });

  await client.connect(transport);
  return client;
}

/**
 * Connect with environment variables
 *
 * Some servers require environment variables (e.g., API keys).
 * Pass them via the env option.
 */
async function connectWithEnv(
  command: string,
  args: string[],
  env: Record<string, string>
): Promise<Client> {
  const client = new Client(
    { name: "my-client", version: "1.0.0" },
    { capabilities: {} }
  );

  const transport = new StdioClientTransport({
    command,
    args,
    env: {
      ...process.env, // Inherit current environment
      ...env, // Add/override with custom variables
    },
  });

  await client.connect(transport);
  return client;
}

/**
 * Connect using npx (for npm packages)
 *
 * Useful for connecting to published MCP servers without local installation.
 */
async function connectViaNpx(packageName: string): Promise<Client> {
  const client = new Client(
    { name: "my-client", version: "1.0.0" },
    { capabilities: {} }
  );

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", packageName],
  });

  await client.connect(transport);
  return client;
}

// Example usage
async function main() {
  // Connect to a local Node.js server
  const client = await connectToNodeServer("./path/to/server.js");

  try {
    // Use the client
    const tools = await client.listTools();
    console.log(
      "Connected! Available tools:",
      tools.tools.map((t) => t.name)
    );
  } finally {
    await client.close();
  }
}

main().catch(console.error);
