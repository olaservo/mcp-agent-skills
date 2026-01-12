# TypeScript Client SDK Patterns

Quick reference for MCP TypeScript Client SDK patterns. For complete examples, see the snippets in this skill.

**Sources:**
- [TypeScript SDK Client Documentation](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/client.md)
- [Build an MCP Client Tutorial](https://modelcontextprotocol.io/docs/develop/build-client)

---

## Key Imports

```typescript
// Core client
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

// Transports
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"; // Legacy

// Types (optional, for type-safe requests)
import {
  CallToolResultSchema,
  ListToolsResultSchema,
  ListPromptsResultSchema,
  ListResourcesResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
```

---

## Client Initialization

```typescript
const client = new Client(
  {
    name: "my-mcp-client",
    version: "1.0.0",
  },
  {
    capabilities: {
      // Declare what your client supports
      roots: { listChanged: true },   // If providing filesystem roots
      sampling: {},                    // If supporting LLM sampling requests
    },
  }
);
```

---

## Transport Options

### stdio (Local Processes)

Use for CLI tools, desktop apps, and local development.

```typescript
const transport = new StdioClientTransport({
  command: "node",           // or "python", "python3", "npx"
  args: ["path/to/server.js"],
  env: {                     // Optional: environment variables
    API_KEY: "secret",
  },
});

await client.connect(transport);
```

### Streamable HTTP (Remote Servers)

Use for remote MCP servers exposed over HTTP/HTTPS.

```typescript
const transport = new StreamableHTTPClientTransport(
  new URL("https://example.com/mcp"),
  {
    requestInit: {
      headers: {
        Authorization: "Bearer token",
      },
    },
    // authProvider, // For OAuth authentication
  }
);

await client.connect(transport);
```

### SSE (Legacy)

For older servers that only support Server-Sent Events.

```typescript
const transport = new SSEClientTransport(new URL("https://example.com/sse"));
await client.connect(transport);
```

---

## High-Level API Methods

The Client class provides convenience methods for common operations:

```typescript
// Tools
const tools = await client.listTools();
const result = await client.callTool({
  name: "tool-name",
  arguments: { param1: "value1" },
});

// Prompts
const prompts = await client.listPrompts();
const prompt = await client.getPrompt({
  name: "prompt-name",
  arguments: { arg1: "value1" },
});

// Resources
const resources = await client.listResources();
const resource = await client.readResource({
  uri: "file:///path/to/resource",
});

// Server instructions (available after connection)
const instructions = client.getInstructions();
if (instructions) {
  // Include in LLM system prompt for better tool usage
  console.log("Server instructions:", instructions);
}
```

---

## Tool Annotations

Tools may include annotations that provide hints about their behavior. Use these for UI/UX decisions like showing warning icons or confirmation dialogs.

### Reading Annotations

```typescript
const { tools } = await client.listTools();

for (const tool of tools) {
  const annotations = tool.annotations;

  if (annotations) {
    console.log(`Tool: ${tool.name}`);
    console.log(`  Read-only: ${annotations.readOnlyHint ?? false}`);
    console.log(`  Destructive: ${annotations.destructiveHint ?? true}`);
    console.log(`  Idempotent: ${annotations.idempotentHint ?? false}`);
    console.log(`  Open world: ${annotations.openWorldHint ?? true}`);
  }
}
```

### Default Values

If annotations are not provided, assume the most dangerous behavior:

| Annotation | Default | Meaning |
|------------|---------|---------|
| `readOnlyHint` | `false` | Assumes tool modifies environment |
| `destructiveHint` | `true` | Assumes tool is destructive |
| `idempotentHint` | `false` | Assumes tool is NOT safe to retry |
| `openWorldHint` | `true` | Assumes tool interacts with external systems |

### UI/UX Patterns

```typescript
function getToolWarningLevel(tool: Tool): "safe" | "caution" | "danger" {
  const annotations = tool.annotations;

  // No annotations = assume dangerous
  if (!annotations) return "danger";

  // Read-only tools are safe
  if (annotations.readOnlyHint) return "safe";

  // Destructive, non-idempotent tools need confirmation
  if (annotations.destructiveHint && !annotations.idempotentHint) {
    return "danger";
  }

  // Non-destructive or idempotent tools are lower risk
  if (!annotations.destructiveHint || annotations.idempotentHint) {
    return "caution";
  }

  return "danger";
}

// Example: Show confirmation for dangerous tools
async function callToolWithConfirmation(client: Client, toolName: string, args: object) {
  const { tools } = await client.listTools();
  const tool = tools.find(t => t.name === toolName);

  if (tool && getToolWarningLevel(tool) === "danger") {
    const confirmed = await promptUser(`Tool "${toolName}" may be destructive. Continue?`);
    if (!confirmed) return null;
  }

  return client.callTool({ name: toolName, arguments: args });
}
```

### Security Warning

> **Important:** Tool annotations are **hints only**. Clients MUST NOT make security decisions based on annotations from untrusted servers. A malicious server could mark a destructive tool as `readOnlyHint: true`. Always verify server trustworthiness independently.

---

## Content Annotations

Content items (in tool results, resources, and prompts) may include annotations that help clients decide how to display or process the content.

### Annotation Fields

| Field | Type | Description |
|-------|------|-------------|
| `audience` | `Role[]` | Who should see: `["user"]`, `["assistant"]`, or both |
| `priority` | `number` | Importance: 0.0 (optional) to 1.0 (required) |
| `lastModified` | `string` | ISO 8601 timestamp |

### Reading Content Annotations

```typescript
const result = await client.callTool({ name: "my-tool", arguments: {} });

for (const item of result.content) {
  const annotations = item.annotations;

  if (annotations) {
    // Check audience
    const forUser = annotations.audience?.includes("user") ?? true;
    const forAssistant = annotations.audience?.includes("assistant") ?? true;

    // Check priority (default to medium if not specified)
    const priority = annotations.priority ?? 0.5;

    // Check modification time
    const lastModified = annotations.lastModified
      ? new Date(annotations.lastModified)
      : null;

    console.log(`Content for user: ${forUser}, priority: ${priority}`);
  }
}
```

### Filtering by Audience

```typescript
type Role = "user" | "assistant";

function filterContentByAudience(
  content: Content[],
  audience: Role
): Content[] {
  return content.filter((item) => {
    // If no audience specified, include for everyone
    if (!item.annotations?.audience) return true;
    return item.annotations.audience.includes(audience);
  });
}

// Show only user-facing content in UI
const result = await client.callTool({ name: "search", arguments: { query: "test" } });
const userContent = filterContentByAudience(result.content, "user");

// Include only assistant content in LLM context
const assistantContent = filterContentByAudience(result.content, "assistant");
```

### Sorting by Priority

```typescript
function sortByPriority(content: Content[]): Content[] {
  return [...content].sort((a, b) => {
    const priorityA = a.annotations?.priority ?? 0.5;
    const priorityB = b.annotations?.priority ?? 0.5;
    return priorityB - priorityA; // Highest priority first
  });
}

// When context is limited, include high-priority content first
const sorted = sortByPriority(result.content);
const topContent = sorted.slice(0, 5); // Take top 5 by priority
```

### Displaying Modification Times

```typescript
function formatLastModified(item: Content): string | null {
  if (!item.annotations?.lastModified) return null;

  const date = new Date(item.annotations.lastModified);
  return date.toLocaleString();
}

// Show "Last updated: Jan 12, 2025, 3:00 PM" in UI
for (const item of result.content) {
  const modified = formatLastModified(item);
  if (modified) {
    console.log(`Last updated: ${modified}`);
  }
}
```

---

## Server Instructions

MCP servers can provide optional instructions that describe how to use their tools effectively. Instructions are returned during the initialization handshake and can improve LLM tool usage when included in system prompts.

### Retrieving Instructions

```typescript
// Connect to server
await client.connect(transport);

// Get server instructions (may be undefined)
const instructions = client.getInstructions();

if (instructions) {
  console.log("Server provided instructions:", instructions);
}
```

### Using Instructions with LLMs

Include server instructions in your LLM's system prompt for better tool usage:

```typescript
// Basic pattern: combine with your own system prompt
function buildSystemPrompt(basePrompt: string, serverInstructions?: string): string {
  if (!serverInstructions) {
    return basePrompt;
  }
  return `${basePrompt}\n\n## MCP Server Instructions\n${serverInstructions}`;
}

// Use in Claude API call
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 1000,
  system: buildSystemPrompt("You are a helpful assistant with access to MCP tools.", client.getInstructions()),
  messages: [...],
  tools: [...],
});
```

### Example: server-everything Instructions

The `@modelcontextprotocol/server-everything` test server provides sample instructions:

```bash
npx -y @modelcontextprotocol/server-everything
# Server provides instructions describing its tools and usage patterns
```

---

## Low-Level Request API

For full control, use the `request()` method with schemas:

```typescript
import { ListToolsResultSchema, CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

// List tools
const toolsResponse = await client.request(
  { method: "tools/list" },
  ListToolsResultSchema
);

// Call a tool
const callResponse = await client.request(
  {
    method: "tools/call",
    params: {
      name: "my-tool",
      arguments: { foo: "bar" },
    },
  },
  CallToolResultSchema
);
```

---

## Handling Notifications

Subscribe to server notifications:

```typescript
// Listen for resource list changes
client.setNotificationHandler(
  { method: "notifications/resources/list_changed" },
  async () => {
    console.log("Resources changed, refreshing...");
    const resources = await client.listResources();
    // Update your UI/state
  }
);

// Listen for tool list changes
client.setNotificationHandler(
  { method: "notifications/tools/list_changed" },
  async () => {
    console.log("Tools changed, refreshing...");
    const tools = await client.listTools();
  }
);
```

---

## Error Handling

```typescript
try {
  const result = await client.callTool({
    name: "risky-tool",
    arguments: {},
  });

  if (result.isError) {
    console.error("Tool returned error:", result.content);
  } else {
    console.log("Success:", result.content);
  }
} catch (error) {
  // Connection or protocol errors
  console.error("Request failed:", error);
}
```

---

## Connection Management

```typescript
// Check connection status
const isConnected = client.transport !== null;

// Graceful shutdown
async function cleanup() {
  await client.close();
}

// Handle process exit
process.on("SIGINT", async () => {
  await cleanup();
  process.exit(0);
});
```

---

## Project Configuration

### package.json

```json
{
  "name": "my-mcp-client",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Best Practices

1. **Use ES modules**: Set `"type": "module"` in package.json, use `.js` extensions in imports

2. **Validate server responses**: Check for errors in tool call results before processing

3. **Graceful shutdown**: Always close the client connection when done

4. **Error handling**: Wrap tool calls in try-catch, provide meaningful error messages

5. **Capability declaration**: Only declare capabilities your client actually supports

6. **Resource cleanup**: Use try/finally or async cleanup handlers

---

## Additional Resources

- [TypeScript SDK Repository](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Specification](https://modelcontextprotocol.io/specification)
- [Client Examples](https://github.com/modelcontextprotocol/typescript-sdk/tree/main/examples/client)
