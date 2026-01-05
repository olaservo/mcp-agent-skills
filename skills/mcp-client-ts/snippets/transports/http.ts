/**
 * StreamableHTTPClientTransport - Connect to Remote MCP Servers
 *
 * Source: Based on https://github.com/modelcontextprotocol/typescript-sdk
 *
 * Use StreamableHTTPClientTransport when connecting to MCP servers
 * exposed over HTTP/HTTPS. This transport supports:
 * - Remote server connections
 * - OAuth authentication
 * - Automatic reconnection
 * - Server-Sent Events (SSE) for streaming
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * Connect to a remote HTTP MCP server
 */
async function connectToHttpServer(serverUrl: string): Promise<Client> {
  const client = new Client(
    { name: "my-client", version: "1.0.0" },
    { capabilities: {} }
  );

  const transport = new StreamableHTTPClientTransport(new URL(serverUrl));

  await client.connect(transport);
  return client;
}

/**
 * Connect with custom headers (e.g., API keys)
 */
async function connectWithHeaders(
  serverUrl: string,
  headers: Record<string, string>
): Promise<Client> {
  const client = new Client(
    { name: "my-client", version: "1.0.0" },
    { capabilities: {} }
  );

  const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
    requestInit: {
      headers,
    },
  });

  await client.connect(transport);
  return client;
}

/**
 * Connect with OAuth authentication
 *
 * For OAuth-secured servers, you'll need to implement an OAuthClientProvider.
 * This example shows the basic structure.
 *
 * See also:
 * - simpleOAuthClient.ts in typescript-sdk examples
 * - simpleClientCredentials.ts for M2M OAuth
 */
async function connectWithOAuth(serverUrl: string): Promise<Client> {
  // OAuth requires implementing OAuthClientProvider interface
  // This is a placeholder showing the pattern

  const client = new Client(
    { name: "my-client", version: "1.0.0" },
    { capabilities: {} }
  );

  // For OAuth, you would create an authProvider:
  // const authProvider = new MyOAuthProvider({ ... });

  const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
    // authProvider, // Uncomment when using OAuth
  });

  await client.connect(transport);
  return client;
}

/**
 * Connect with SSE fallback for legacy servers
 *
 * Some older servers only support SSE transport.
 * This pattern tries Streamable HTTP first, then falls back to SSE.
 */
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function connectWithFallback(serverUrl: string): Promise<Client> {
  const client = new Client(
    { name: "my-client", version: "1.0.0" },
    { capabilities: {} }
  );

  const url = new URL(serverUrl);

  try {
    // Try modern Streamable HTTP first
    const transport = new StreamableHTTPClientTransport(url);
    await client.connect(transport);
    console.log("Connected via Streamable HTTP");
  } catch (error) {
    // Fall back to legacy SSE transport
    console.log("Falling back to SSE transport");
    const sseTransport = new SSEClientTransport(url);
    await client.connect(sseTransport);
    console.log("Connected via SSE");
  }

  return client;
}

// Example usage
async function main() {
  // Connect to a remote MCP server
  const client = await connectToHttpServer("https://example.com/mcp");

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
